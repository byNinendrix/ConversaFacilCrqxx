import * as Sentry from "@sentry/node";
import BullQueue from "bull";
import { Mutex } from "async-mutex";
import { addSeconds } from "date-fns";
import { isEmpty, isNil } from "lodash";
import moment from "moment";
import path from "path";
import { Op, QueryTypes } from "sequelize";
import sequelize from "./database";
import GetDefaultWhatsApp from "./helpers/GetDefaultWhatsApp";
import GetWhatsappWbot from "./helpers/GetWhatsappWbot";
import formatBody from "./helpers/Mustache";
import { MessageData, SendMessage } from "./helpers/SendMessage";
import { getIO } from "./libs/socket";
import { getWbot } from "./libs/wbot";
import Campaign from "./models/Campaign";
import CampaignSetting from "./models/CampaignSetting";
import CampaignShipping from "./models/CampaignShipping";
import Company from "./models/Company";
import Contact from "./models/Contact";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";
import Plan from "./models/Plan";
import Schedule from "./models/Schedule";
import User from "./models/User";
import Whatsapp from "./models/Whatsapp";
import ShowFileService from "./services/FileServices/ShowService";
import { getMessageOptions } from "./services/WbotServices/SendWhatsAppMedia";
import { ClosedAllOpenTickets } from "./services/WbotServices/wbotClosedTickets";
import { logger } from "./utils/logger";


const nodemailer = require('nodemailer');
const CronJob = require('cron').CronJob;

const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;
const whatsappDispatchLocks = new Map<number, Mutex>();

interface ProcessCampaignData {
  id: number;
  delay: number;
}

interface PrepareContactData {
  contactId: number;
  campaignId: number;
  delay: number;
  variables: any[];
}

interface DispatchCampaignData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

interface FinalizeCampaignData {
  campaignId: number;
}

export const userMonitor = new BullQueue("UserMonitor", connection);

export const queueMonitor = new BullQueue("QueueMonitor", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: limiterMax as number,
    duration: limiterDuration as number
  }
});

export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const sendScheduledMessages = new BullQueue(
  "SendSacheduledMessages",
  connection
);

export const campaignQueue = new BullQueue("CampaignQueue", connection);

export const getCampaignProcessJobId = (campaignId: number | string) =>
  `campaign-process-${campaignId}`;

export const getCampaignPrepareJobId = (
  campaignId: number | string,
  contactId: number | string
) => `campaign-prepare-${campaignId}-${contactId}`;

export const getCampaignDispatchJobId = (
  campaignId: number | string,
  campaignShippingId: number | string
) => `campaign-dispatch-${campaignId}-${campaignShippingId}`;

export const getCampaignFinalizeJobId = (campaignId: number | string) =>
  `campaign-finalize-${campaignId}`;

export async function removeCampaignQueueJob(jobId?: number | string | null) {
  if (isNil(jobId)) return;

  const job = await campaignQueue.getJob(String(jobId));
  if (!job) return;

  try {
    await job.remove();
  } catch (err: any) {
    logger.info(
      `Job de campanha nao removido, possivelmente em execucao: Job=${jobId};Erro=${err.message}`
    );
  }
}

const campaignContactBatchSize = Math.min(
  Math.max(Number(process.env.CAMPAIGN_CONTACT_BATCH_SIZE) || 500, 1),
  1000
);

function getEnvInt(name: string, defaultValue: number, min: number, max: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return defaultValue;
  return Math.min(Math.max(Math.floor(value), min), max);
}

const campaignProcessConcurrency = getEnvInt(
  "CAMPAIGN_PROCESS_CONCURRENCY",
  1,
  1,
  3
);

const campaignPrepareConcurrency = getEnvInt(
  "CAMPAIGN_PREPARE_CONCURRENCY",
  2,
  1,
  10
);

const campaignDispatchConcurrency = getEnvInt(
  "CAMPAIGN_DISPATCH_CONCURRENCY",
  1,
  1,
  5
);

const campaignMemoryWarnMb = getEnvInt(
  "CAMPAIGN_MEMORY_WARN_MB",
  700,
  128,
  8192
);

const campaignFinalizeDebounceMs = getEnvInt(
  "CAMPAIGN_FINALIZE_DEBOUNCE_MS",
  30000,
  1000,
  300000
);

const campaignDispatchAttempts = getEnvInt(
  "CAMPAIGN_DISPATCH_ATTEMPTS",
  3,
  1,
  10
);

const campaignDispatchBackoffMs = getEnvInt(
  "CAMPAIGN_DISPATCH_BACKOFF_MS",
  60000,
  1000,
  600000
);

const campaignShippingRetentionDays = getEnvInt(
  "CAMPAIGN_SHIPPING_RETENTION_DAYS",
  90,
  0,
  3650
);

const campaignCleanupBatchSize = getEnvInt(
  "CAMPAIGN_CLEANUP_BATCH_SIZE",
  100,
  1,
  1000
);

const campaignReconcileStaleMinutes = getEnvInt(
  "CAMPAIGN_RECONCILE_STALE_MINUTES",
  30,
  5,
  1440
);

const campaignReconcileBatchSize = getEnvInt(
  "CAMPAIGN_RECONCILE_BATCH_SIZE",
  50,
  1,
  500
);

type QueueProcessMode = "all" | "api" | "worker";

type StartQueueProcessOptions = {
  mode?: QueueProcessMode;
};

function normalizeQueueProcessMode(mode?: string): QueueProcessMode {
  if (mode === "api" || mode === "worker" || mode === "all") return mode;
  return "all";
}

function formatCampaignMemory() {
  const memory = process.memoryUsage();

  return {
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
    externalMb: Math.round(memory.external / 1024 / 1024)
  };
}

function logCampaignMetric(message: string, data: Record<string, any>) {
  const memory = formatCampaignMemory();
  const payload = {
    ...data,
    ...memory
  };

  const details = Object.entries(payload)
    .map(([key, value]) => `${key}=${value}`)
    .join(";");

  const logMessage = `${message}: ${details}`;

  if (memory.rssMb >= campaignMemoryWarnMb) {
    logger.warn(logMessage);
    return;
  }

  logger.info(logMessage);
}

function getWhatsappDispatchLock(whatsappId: number) {
  if (!whatsappDispatchLocks.has(whatsappId)) {
    whatsappDispatchLocks.set(whatsappId, new Mutex());
  }

  return whatsappDispatchLocks.get(whatsappId);
}

export function getCampaignDispatchJobOptions(
  campaignId: number | string,
  campaignShippingId: number | string,
  delay = 0
) {
  return {
    jobId: getCampaignDispatchJobId(campaignId, campaignShippingId),
    delay,
    attempts: campaignDispatchAttempts,
    backoff: {
      type: "exponential",
      delay: campaignDispatchBackoffMs
    },
    removeOnComplete: true,
    removeOnFail: false
  };
}

async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId);

    if (whatsapp == null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}

{/*async function handleVerifyQueue(job) {
  logger.info("Buscando atendimentos perdidos nas filas");
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'name'],
      where: {
        status: true,
        dueDate: {
          [Op.gt]: Sequelize.literal('CURRENT_DATE')
        }
      },
      include: [
        {
          model: Whatsapp, attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"], where: {
            timeSendQueue: {
              [Op.gt]: 0
            }
          }
        },
      ]
    }); */}

{/*    companies.map(async c => {
      c.whatsapps.map(async w => {

        if (w.status === "CONNECTED") {

          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {

            if (!isNaN(idQueue) && Number.isInteger(idQueue) && !isNaN(timeQueue) && Number.isInteger(timeQueue)) {

              const tempoPassado = moment().subtract(timeQueue, "minutes").utc().format();
              // const tempoAgora = moment().utc().format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  }
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "number", "email", "profilePicUrl"],
                    include: ["extraInfo"]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await ticket.reload();

                  const io = getIO();
                  io.to(ticket.status)
                    .to("notification")
                    .to(ticket.id.toString())
                    .emit(`company-${companyId}-ticket`, {
                      action: "update",
                      ticket,
                      ticketId: ticket.id
                    });

                  // io.to("pending").emit(`company-${companyId}-ticket`, {
                  //   action: "update",
                  //   ticket,
                  // });

                  logger.info(`Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`);
                });
              } else {
                logger.info(`Nenhum atendimento perdido encontrado - Empresa: ${companyId}`);
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}; */}

async function handleCloseTicketsAutomatic() {
  const job = new CronJob('*/1 * * * *', async () => {
    const companies = await Company.findAll();
    companies.map(async c => {

      try {
        const companyId = c.id;
        await ClosedAllOpenTickets(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
        throw e;
      }

    });
  });
  job.start()
}

async function handleVerifySchedules(job) {
  try {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.gte]: moment().format("YYYY-MM-DD HH:mm:ss"),
          [Op.lte]: moment().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [{ model: Contact, as: "contact" }]
    });
    if (count > 0) {
      schedules.map(async schedule => {
        await schedule.update({
          status: "AGENDADA"
        });
        sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          { delay: 40000 }
        );
        logger.info(`Disparo agendado para: ${schedule.contact.name}`);
      });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendScheduledMessage -> Verify: error", e.message);
    throw e;
  }
}

async function handleSendScheduledMessage(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    const whatsapp = await GetDefaultWhatsApp(schedule.companyId);

    let filePath = null;
    if (schedule.mediaPath) {
      filePath = path.resolve("public", schedule.mediaPath);
    }

    await SendMessage(whatsapp, {
      number: schedule.contact.number,
      body: formatBody(schedule.body, schedule.contact),
      mediaPath: filePath
    });

    await scheduleRecord?.update({
      sentAt: moment().format("YYYY-MM-DD HH:mm"),
      status: "ENVIADA"
    });

    logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      status: "ERRO"
    });
    logger.error("SendScheduledMessage -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifyCampaigns(job) {
  /**
   * @todo
   * Implementar filtro de campanhas
   */
  const campaigns: { id: number; scheduledAt: string }[] =
    await sequelize.query(
      `select id, "scheduledAt" from "Campaigns" c
    where "scheduledAt" between now() and now() + '1 hour'::interval and status = 'PROGRAMADA'`,
      { type: QueryTypes.SELECT }
    );

  if (campaigns.length > 0)
    logger.info(`Campanhas encontradas: ${campaigns.length}`);
  
  for (let campaign of campaigns) {
    try {
      const now = moment();
      const scheduledAt = moment(campaign.scheduledAt);
      const delay = scheduledAt.diff(now, "milliseconds");
      logger.info(
        `Campanha enviada para a fila de processamento: Campanha=${campaign.id}, Delay Inicial=${delay}`
      );
      campaignQueue.add(
        "ProcessCampaign",
        {
          id: campaign.id,
          delay
        },
        {
          jobId: getCampaignProcessJobId(campaign.id),
          delay: Math.max(0, delay),
          removeOnComplete: true,
          removeOnFail: true
        }
      );
    } catch (err: any) {
      Sentry.captureException(err);
    }
  }
}

async function getCampaign(id) {
  return await Campaign.findByPk(id, {
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ]
  });
}

async function getCampaignContacts(
  campaign,
  lastContactId = 0,
  limit = campaignContactBatchSize
) {
  if (!campaign?.contactListId) return [];

  return await ContactListItem.findAll({
    where: {
      contactListId: campaign.contactListId,
      isWhatsappValid: true,
      id: {
        [Op.gt]: lastContactId
      }
    },
    attributes: ["id", "name", "number", "email", "isWhatsappValid"],
    limit,
    order: [["id", "ASC"]]
  });
}

async function getCampaignContactCount(campaign) {
  if (!campaign?.contactListId) return 0;

  return await ContactListItem.count({
    where: {
      contactListId: campaign.contactListId,
      isWhatsappValid: true
    }
  });
}

async function getCampaignShippingStats(campaign) {
  const [
    validContacts,
    delivered,
    confirmationRequested,
    confirmed,
    failed
  ] = await Promise.all([
    getCampaignContactCount(campaign),
    CampaignShipping.count({
      where: {
        campaignId: campaign.id,
        deliveredAt: { [Op.not]: null }
      }
    }),
    CampaignShipping.count({
      where: {
        campaignId: campaign.id,
        confirmationRequestedAt: { [Op.not]: null }
      }
    }),
    CampaignShipping.count({
      where: {
        campaignId: campaign.id,
        confirmedAt: { [Op.not]: null }
      }
    }),
    CampaignShipping.count({
      where: {
        campaignId: campaign.id,
        failedAt: { [Op.not]: null }
      }
    })
  ]);

  const previous = campaign.toJSON ? campaign.toJSON() : campaign;
  const canUseCached =
    campaign.status === "FINALIZADA" || campaign.status === "CANCELADA";

  return {
    validContacts:
      validContacts || (canUseCached ? previous.validContactsCount || 0 : 0),
    delivered: canUseCached
      ? Math.max(delivered, previous.deliveredCount || 0)
      : delivered,
    confirmationRequested: canUseCached
      ? Math.max(
          confirmationRequested,
          previous.confirmationRequestedCount || 0
        )
      : confirmationRequested,
    confirmed: canUseCached
      ? Math.max(confirmed, previous.confirmedCount || 0)
      : confirmed,
    failed: canUseCached
      ? Math.max(failed, previous.failedCount || 0)
      : failed
  };
}

async function updateCampaignStats(campaign, stats) {
  await campaign.update({
    validContactsCount: stats.validContacts,
    deliveredCount: stats.delivered,
    confirmationRequestedCount: stats.confirmationRequested,
    confirmedCount: stats.confirmed,
    failedCount: stats.failed,
    lastStatsAt: moment()
  });
}

async function getContact(id) {
  return await ContactListItem.findByPk(id, {
    attributes: ["id", "name", "number", "email"]
  });
}

async function getSettings(campaign) {
  const settings = await CampaignSetting.findAll({
    where: { companyId: campaign.companyId },
    attributes: ["key", "value"]
  });

  let messageInterval: number = 20;
  let longerIntervalAfter: number = 20;
  let greaterInterval: number = 60;
  let variables: any[] = [];

  settings.forEach(setting => {
    if (setting.key === "messageInterval") {
      messageInterval = JSON.parse(setting.value);
    }
    if (setting.key === "longerIntervalAfter") {
      longerIntervalAfter = JSON.parse(setting.value);
    }
    if (setting.key === "greaterInterval") {
      greaterInterval = JSON.parse(setting.value);
    }
    if (setting.key === "variables") {
      variables = JSON.parse(setting.value);
    }
  });

  return {
    messageInterval,
    longerIntervalAfter,
    greaterInterval,
    variables
  };
}

export function parseToMilliseconds(seconds) {
  return seconds * 1000;
}

async function sleep(seconds) {
  logger.info(
    `Sleep de ${seconds} segundos iniciado: ${moment().format("HH:mm:ss")}`
  );
  return new Promise(resolve => {
    setTimeout(() => {
      logger.info(
        `Sleep de ${seconds} segundos finalizado: ${moment().format(
          "HH:mm:ss"
        )}`
      );
      resolve(true);
    }, parseToMilliseconds(seconds));
  });
}

function getCampaignValidMessages(campaign) {
  const messages = [];

  if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
    messages.push(campaign.message1);
  }

  if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
    messages.push(campaign.message2);
  }

  if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
    messages.push(campaign.message3);
  }

  if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
    messages.push(campaign.message4);
  }

  if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
    messages.push(campaign.message5);
  }

  return messages;
}

function getCampaignValidConfirmationMessages(campaign) {
  const messages = [];

  if (
    !isEmpty(campaign.confirmationMessage1) &&
    !isNil(campaign.confirmationMessage1)
  ) {
    messages.push(campaign.confirmationMessage1);
  }

  if (
    !isEmpty(campaign.confirmationMessage2) &&
    !isNil(campaign.confirmationMessage2)
  ) {
    messages.push(campaign.confirmationMessage2);
  }

  if (
    !isEmpty(campaign.confirmationMessage3) &&
    !isNil(campaign.confirmationMessage3)
  ) {
    messages.push(campaign.confirmationMessage3);
  }

  if (
    !isEmpty(campaign.confirmationMessage4) &&
    !isNil(campaign.confirmationMessage4)
  ) {
    messages.push(campaign.confirmationMessage4);
  }

  if (
    !isEmpty(campaign.confirmationMessage5) &&
    !isNil(campaign.confirmationMessage5)
  ) {
    messages.push(campaign.confirmationMessage5);
  }

  return messages;
}

function getProcessedMessage(msg: string, variables: any[], contact: any) {
  let finalMessage = msg;

  if (finalMessage.includes("{nome}")) {
    finalMessage = finalMessage.replace(/{nome}/g, contact.name);
  }

  if (finalMessage.includes("{email}")) {
    finalMessage = finalMessage.replace(/{email}/g, contact.email);
  }

  if (finalMessage.includes("{numero}")) {
    finalMessage = finalMessage.replace(/{numero}/g, contact.number);
  }

  variables.forEach(variable => {
    if (finalMessage.includes(`{${variable.key}}`)) {
      const regex = new RegExp(`{${variable.key}}`, "g");
      finalMessage = finalMessage.replace(regex, variable.value);
    }
  });

  return finalMessage;
}

function buildCampaignShipping(campaign, contact, variables: any[]) {
  const messages = getCampaignValidMessages(campaign);
  if (!messages.length && !campaign.mediaPath && isNil(campaign.fileListId)) {
    return null;
  }

  const campaignShipping: any = {
    number: contact.number,
    contactId: contact.id,
    campaignId: campaign.id
  };

  if (messages.length) {
    const messageIndex = getMessageIndex(campaign.id, contact.id, messages.length);
    const message = getProcessedMessage(
      messages[messageIndex],
      variables,
      contact
    );
    campaignShipping.message = `\u200c ${message}`;
  }

  if (campaign.confirmation) {
    const confirmationMessages =
      getCampaignValidConfirmationMessages(campaign);
    if (confirmationMessages.length) {
      const radomIndex = randomValue(0, confirmationMessages.length);
      const message = getProcessedMessage(
        confirmationMessages[radomIndex],
        variables,
        contact
      );
      campaignShipping.confirmationMessage = `\u200c ${message}`;
    }
  }

  return campaignShipping;
}

async function prepareCampaignShippingBatch(
  campaign,
  contacts: ContactListItem[],
  variables: any[]
) {
  const rows = contacts
    .map(contact => buildCampaignShipping(campaign, contact, variables))
    .filter(Boolean);

  if (!rows.length) return [];

  const contactIds = rows.map(row => row.contactId);
  const existingRecords = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      contactId: { [Op.in]: contactIds }
    },
    attributes: [
      "id",
      "contactId",
      "deliveredAt",
      "confirmationRequestedAt",
      "failedAt",
      "jobId"
    ]
  });

  const existingByContactId = new Map(
    existingRecords.map(record => [record.contactId, record])
  );
  const rowsByContactId = new Map(rows.map(row => [row.contactId, row]));
  const rowsToCreate = rows.filter(
    row => !existingByContactId.has(row.contactId)
  );

  if (rowsToCreate.length) {
    await CampaignShipping.bulkCreate(rowsToCreate, { ignoreDuplicates: true });
  }

  for (const record of existingRecords) {
    if (record.deliveredAt || record.confirmationRequestedAt || record.failedAt) continue;

    const nextValues = rowsByContactId.get(record.contactId);
    if (!nextValues) continue;

    record.set(nextValues);
    await record.save();
  }

  return await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      contactId: { [Op.in]: contactIds },
      deliveredAt: null,
      confirmationRequestedAt: null,
      failedAt: null
    },
    attributes: ["id", "contactId", "jobId"]
  });
}

function getMessageIndex(campaignId: number | string, contactId: number | string, length: number) {
  if (length <= 1) return 0;

  const seed = Number(campaignId) + Number(contactId);
  if (Number.isNaN(seed)) return 0;

  return Math.abs(seed) % length;
}

export function randomValue(min, max) {
  return Math.floor(Math.random() * max) + min;
}

function randomBetween(min: number, max: number) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function campaignShouldStop(campaign) {
  return !campaign || ["CANCELADA", "FINALIZADA"].includes(campaign.status);
}

async function campaignShouldStopById(campaignId: number | string) {
  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "status"]
  });

  return campaignShouldStop(campaign);
}

async function scheduleCampaignFinalization(campaignId: number | string) {
  await campaignQueue.add(
    "FinalizeCampaign",
    { campaignId },
    {
      jobId: getCampaignFinalizeJobId(campaignId),
      delay: campaignFinalizeDebounceMs,
      removeOnComplete: true,
      removeOnFail: true
    }
  );
}

async function verifyAndFinalizeCampaign(campaign) {
  if (!campaign?.contactListId) {
    return { totalContacts: 0, deliveredContacts: 0, finalized: false };
  }

  const stats = await getCampaignShippingStats(campaign);

  const finalized =
    stats.validContacts > 0 &&
    stats.validContacts <= stats.delivered + stats.failed &&
    campaign.status !== "CANCELADA";

  if (finalized) {
    await campaign.update({
      status: "FINALIZADA",
      completedAt: moment(),
      validContactsCount: stats.validContacts,
      deliveredCount: stats.delivered,
      confirmationRequestedCount: stats.confirmationRequested,
      confirmedCount: stats.confirmed,
      failedCount: stats.failed,
      lastStatsAt: moment()
    });
  } else {
    await updateCampaignStats(campaign, stats);
  }

  try {
    const io = getIO();
    io.to(`company-${campaign.companyId}-mainchannel`).emit(`company-${campaign.companyId}-campaign`, {
      action: "update",
      record: campaign
    });
  } catch (err: any) {
    logger.debug(`Socket indisponivel para atualizar campanha ${campaign.id}: ${err.message}`);
  }

  return {
    totalContacts: stats.validContacts,
    deliveredContacts: stats.delivered,
    failedContacts: stats.failed,
    finalized
  };
}

function getIntervalForContact(
  index: number,
  messageInterval: number,
  longerIntervalAfter: number,
  greaterInterval: number
) {
  const shouldUseGreaterInterval =
    longerIntervalAfter > 0 && index + 1 > longerIntervalAfter;

  const configuredInterval = shouldUseGreaterInterval
    ? greaterInterval
    : messageInterval;

  if (configuredInterval <= 0) return 0;

  return randomBetween(1, configuredInterval);
}

function getCampaignBaseDelay(scheduledAt?: Date | string | null) {
  const now = new Date();
  if (!scheduledAt) return now;

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return now;

  return scheduledDate.getTime() > now.getTime() ? scheduledDate : now;
}

async function handleProcessCampaign(job) {
  const startedAt = Date.now();
  let campaignId: number | string | undefined;

  try {
    const { id }: ProcessCampaignData = job.data;
    campaignId = id;
    const campaign = await getCampaign(id);
    if (campaignShouldStop(campaign)) {
      return;
    }

    const settings = await getSettings(campaign);
    await campaign.update({ status: "EM_ANDAMENTO" });
    const totalContacts = await getCampaignContactCount(campaign);

    const longerIntervalAfter = Number(settings.longerIntervalAfter) || 0;
    const greaterInterval = Number(settings.greaterInterval) || 0;
    const messageInterval = Number(settings.messageInterval) || 0;

    let baseDelay = getCampaignBaseDelay(campaign.scheduledAt);
    let processedContacts = 0;
    let lastContactId = 0;

    logCampaignMetric("Campanha iniciada para preparo", {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      totalContacts,
      batchSize: campaignContactBatchSize,
      messageInterval,
      longerIntervalAfter,
      greaterInterval
    });

    while (true) {
      if (await campaignShouldStopById(campaign.id)) {
        logger.info(`Processamento de campanha interrompido: Campanha=${campaign.id}`);
        break;
      }

      const contacts = await getCampaignContacts(campaign, lastContactId);

      if (!contacts.length) break;

      const batchStartedAt = Date.now();
      const firstContactId = contacts[0].id;
      const delayByContactId = new Map<number, number>();

      for (const contact of contacts) {
        const intervalSeconds = getIntervalForContact(
          processedContacts,
          messageInterval,
          longerIntervalAfter,
          greaterInterval
        );
        baseDelay = addSeconds(baseDelay, intervalSeconds);

        delayByContactId.set(
          contact.id,
          Math.max(0, baseDelay.getTime() - Date.now())
        );

        processedContacts += 1;
        lastContactId = contact.id;
      }

      const dispatchRecords = await prepareCampaignShippingBatch(
        campaign,
        contacts,
        settings.variables
      );

      for (const record of dispatchRecords) {
        const delay = delayByContactId.get(record.contactId) || 0;
        const nextJob = await campaignQueue.add(
          "DispatchCampaign",
          {
            campaignId: campaign.id,
            campaignShippingId: record.id,
            contactListItemId: record.contactId
          },
          getCampaignDispatchJobOptions(campaign.id, record.id, delay)
        );

        if (record.jobId !== String(nextJob.id)) {
          await record.update({ jobId: nextJob.id });
        }
      }

      await job.progress(totalContacts > 0
        ? Math.min(Math.round((processedContacts / totalContacts) * 100), 100)
        : 100);

      logCampaignMetric("Lote de campanha preparado", {
        campaignId: campaign.id,
        companyId: campaign.companyId,
        batchContacts: contacts.length,
        processedContacts,
        totalContacts,
        dispatchJobs: dispatchRecords.length,
        firstContactId,
        lastContactId,
        durationMs: Date.now() - batchStartedAt
      });
    }

    logCampaignMetric("Campanha finalizada para preparo", {
      campaignId: campaign.id,
      companyId: campaign.companyId,
      processedContacts,
      totalContacts,
      durationMs: Date.now() - startedAt
    });
  } catch (err: any) {
    Sentry.captureException(err);
    logCampaignMetric("Erro ao preparar campanha", {
      campaignId,
      durationMs: Date.now() - startedAt,
      error: err.message
    });
  }
}

async function handlePrepareContact(job) {
  try {
    const { contactId, campaignId, delay, variables }: PrepareContactData =
      job.data;
    const campaign = await getCampaign(campaignId);
    if (campaignShouldStop(campaign)) {
      logger.info(`Preparo ignorado por status da campanha: Campanha=${campaignId};Contato=${contactId}`);
      return;
    }

    const contact = await getContact(contactId);
    if (!contact) {
      logger.info(`Preparo ignorado por contato inexistente: Campanha=${campaignId};Contato=${contactId}`);
      return;
    }

    const campaignShipping: any = {};
    campaignShipping.number = contact.number;
    campaignShipping.contactId = contactId;
    campaignShipping.campaignId = campaignId;

    const messages = getCampaignValidMessages(campaign);
    if (!messages.length && !campaign.mediaPath && isNil(campaign.fileListId)) {
      logger.info(`Preparo ignorado por campanha sem mensagem ou midia: Campanha=${campaignId};Contato=${contactId}`);
      return;
    }

    if (messages.length) {
      const messageIndex = getMessageIndex(campaignId, contactId, messages.length);
      const message = getProcessedMessage(
        messages[messageIndex],
        variables,
        contact
      );
      campaignShipping.message = `\u200c ${message}`;
    }

    if (campaign.confirmation) {
      const confirmationMessages =
        getCampaignValidConfirmationMessages(campaign);
      if (confirmationMessages.length) {
        const radomIndex = randomValue(0, confirmationMessages.length);
        const message = getProcessedMessage(
          confirmationMessages[radomIndex],
          variables,
          contact
        );
        campaignShipping.confirmationMessage = `\u200c ${message}`;
      }
    }

    const [record, created] = await CampaignShipping.findOrCreate({
      where: {
        campaignId: campaignShipping.campaignId,
        contactId: campaignShipping.contactId
      },
      defaults: campaignShipping
    });

    if (
      !created &&
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null &&
      record.failedAt === null
    ) {
      record.set(campaignShipping);
      await record.save();
    }

    if (
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null &&
      record.failedAt === null
    ) {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: record.id,
          contactListItemId: contactId
        },
        getCampaignDispatchJobOptions(campaign.id, record.id, delay)
      );

      await record.update({ jobId: nextJob.id });
    }
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
  }
}

async function markCampaignShippingFailed(
  campaignId: number | string,
  campaignShippingId: number | string,
  error: any,
  attemptsMade: number
) {
  const failReason = String(error?.message || error || "Erro desconhecido")
    .slice(0, 2000);

  await CampaignShipping.update(
    {
      failedAt: moment(),
      failReason,
      attempts: attemptsMade
    },
    {
      where: {
        id: campaignShippingId,
        campaignId,
        deliveredAt: null
      }
    }
  );

  await scheduleCampaignFinalization(campaignId);
}

async function handleDispatchCampaign(job) {
  const startedAt = Date.now();

  try {
    const { data } = job;
    const { campaignShippingId, campaignId }: DispatchCampaignData = data;
    const campaign = await getCampaign(campaignId);
    if (campaignShouldStop(campaign)) {
      logger.info(`Disparo ignorado por status da campanha: Campanha=${campaignId};Registro=${campaignShippingId}`);
      return;
    }

    if (!campaign.whatsapp) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: whatsapp not found`);
      return;
    }

    const wbot = await GetWhatsappWbot(campaign.whatsapp);

    if (!wbot) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: wbot not found`);
      return;
    }

    if (!wbot?.user?.id) {
      logger.error(`campaignQueue -> DispatchCampaign -> error: wbot user not found`);
      return;
    }

    logger.info(
      `Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId}`
    );

    const campaignShipping = await CampaignShipping.findByPk(
      campaignShippingId,
      {
        include: [{ model: ContactListItem, as: "contact" }]
      }
    );
    if (!campaignShipping || campaignShipping.deliveredAt) {
      logger.info(`Disparo ignorado por registro ausente ou ja entregue: Campanha=${campaignId};Registro=${campaignShippingId}`);
      return;
    }

    const chatId = `${campaignShipping.number}@s.whatsapp.net`;

    let sentMessages = 0;
    let skipDispatch = false;

    await getWhatsappDispatchLock(campaign.whatsappId).runExclusive(async () => {
      let body = campaignShipping.message;

      if (campaign.confirmation && campaignShipping.confirmation === null) {
        body = campaignShipping.confirmationMessage
      }

      if (!isNil(campaign.fileListId)) {
        try {
          const publicFolder = path.resolve(__dirname, "..", "public");
          const files = await ShowFileService(campaign.fileListId, campaign.companyId)
          const folder = path.resolve(publicFolder, "fileList", String(files.id))
          for (const [index, file] of files.options.entries()) {
            const options = await getMessageOptions(file.path, path.resolve(folder, file.path), file.name);
            if (options && Object.keys(options).length) {
              await wbot.sendMessage(chatId, { ...options });
              sentMessages += 1;
            }
          }
        } catch (error: any) {
          logger.error(`campaignQueue -> DispatchCampaign -> fileList error: ${error.message}`);
          throw error;
        }
      }

      if (campaign.mediaPath) {
        const publicFolder = path.resolve(__dirname, "..", "public");
        const filePath = path.join(publicFolder, campaign.mediaPath);

        const options = await getMessageOptions(campaign.mediaName, filePath, body);
        if (options && Object.keys(options).length) {
          await wbot.sendMessage(chatId, { ...options });
          sentMessages += 1;
        }
      }
      else {
        if (!body) {
          if (sentMessages === 0) {
            logger.info(`Disparo ignorado por mensagem vazia: Campanha=${campaignId};Registro=${campaignShippingId}`);
            skipDispatch = true;
            return;
          }
        } else if (campaign.confirmation && campaignShipping.confirmation === null) {
            await wbot.sendMessage(chatId, {
              text: body
            });
            sentMessages += 1;
            await campaignShipping.update({ confirmationRequestedAt: moment() });
          } else {

            await wbot.sendMessage(chatId, {
              text: body
            });
            sentMessages += 1;
        }
      }

      if (sentMessages === 0) {
        skipDispatch = true;
        return;
      }

      await campaignShipping.update({
        deliveredAt: moment(),
        attempts: (job.attemptsMade || 0) + 1,
        failedAt: null,
        failReason: null
      });
    });

    if (skipDispatch) {
      logger.info(`Disparo ignorado sem conteudo enviado: Campanha=${campaignId};Registro=${campaignShippingId}`);
      return;
    }

    await scheduleCampaignFinalization(campaign.id);

    const io = getIO();
    io.to(`company-${campaign.companyId}-mainchannel`).emit(`company-${campaign.companyId}-campaign`, {
      action: "update",
      record: campaign
    });

    logger.info(
      `Campanha enviada para: Campanha=${campaignId};Contato=${campaignShipping.contact.name}`
    );

    logCampaignMetric("Disparo de campanha concluido", {
      campaignId,
      companyId: campaign.companyId,
      campaignShippingId,
      attemptsMade: job.attemptsMade || 0,
      sentMessages,
      durationMs: Date.now() - startedAt
    });
  } catch (err: any) {
    Sentry.captureException(err);
    const attemptsMade = (job?.attemptsMade || 0) + 1;
    const maxAttempts = job?.opts?.attempts || 1;
    const isFinalAttempt = attemptsMade >= maxAttempts;

    if (isFinalAttempt && job?.data?.campaignId && job?.data?.campaignShippingId) {
      await markCampaignShippingFailed(
        job.data.campaignId,
        job.data.campaignShippingId,
        err,
        attemptsMade
      );
    }

    logCampaignMetric("Erro no disparo de campanha", {
      campaignId: job?.data?.campaignId,
      campaignShippingId: job?.data?.campaignShippingId,
      attemptsMade,
      maxAttempts,
      finalAttempt: isFinalAttempt,
      durationMs: Date.now() - startedAt,
      error: err.message
    });
    throw err;
  }
}

async function handleFinalizeCampaign(job) {
  const startedAt = Date.now();
  const { campaignId }: FinalizeCampaignData = job.data;

  try {
    const campaign = await getCampaign(campaignId);
    if (campaignShouldStop(campaign)) {
      return;
    }

    const result = await verifyAndFinalizeCampaign(campaign);

    logCampaignMetric("Finalizacao de campanha verificada", {
      campaignId,
      companyId: campaign.companyId,
      totalContacts: result.totalContacts,
      deliveredContacts: result.deliveredContacts,
      failedContacts: result.failedContacts,
      finalized: result.finalized,
      durationMs: Date.now() - startedAt
    });
  } catch (err: any) {
    Sentry.captureException(err);
    logCampaignMetric("Erro ao finalizar campanha", {
      campaignId,
      durationMs: Date.now() - startedAt,
      error: err.message
    });
  }
}

async function handleCleanupCampaignShipping(job) {
  const startedAt = Date.now();

  if (campaignShippingRetentionDays <= 0) {
    logger.info("Limpeza de CampaignShipping desativada por configuracao");
    return;
  }

  try {
    const cutoff = moment()
      .subtract(campaignShippingRetentionDays, "days")
      .toDate();

    const campaigns = await Campaign.findAll({
      where: {
        status: { [Op.in]: ["FINALIZADA", "CANCELADA"] },
        updatedAt: { [Op.lt]: cutoff }
      },
      limit: campaignCleanupBatchSize,
      order: [["updatedAt", "ASC"]]
    });

    let deletedRecords = 0;

    for (const campaign of campaigns) {
      const stats = await getCampaignShippingStats(campaign);
      await updateCampaignStats(campaign, stats);

      deletedRecords += await CampaignShipping.destroy({
        where: { campaignId: campaign.id }
      });
    }

    logCampaignMetric("Limpeza de envios antigos de campanha concluida", {
      campaigns: campaigns.length,
      deletedRecords,
      retentionDays: campaignShippingRetentionDays,
      durationMs: Date.now() - startedAt
    });
  } catch (err: any) {
    Sentry.captureException(err);
    logCampaignMetric("Erro na limpeza de envios antigos de campanha", {
      durationMs: Date.now() - startedAt,
      error: err.message
    });
  }
}

async function handleReconcileCampaigns(job) {
  const startedAt = Date.now();

  try {
    const staleBefore = moment()
      .subtract(campaignReconcileStaleMinutes, "minutes")
      .toDate();

    const campaigns = await Campaign.findAll({
      where: {
        status: "EM_ANDAMENTO",
        updatedAt: { [Op.lt]: staleBefore }
      },
      limit: campaignReconcileBatchSize,
      order: [["updatedAt", "ASC"]]
    });

    let finalized = 0;
    let requeued = 0;

    for (const campaign of campaigns) {
      const stats = await getCampaignShippingStats(campaign);
      const processed = stats.delivered + stats.failed;

      if (stats.validContacts > 0 && processed >= stats.validContacts) {
        await verifyAndFinalizeCampaign(campaign);
        finalized += 1;
        continue;
      }

      const processJobId = getCampaignProcessJobId(campaign.id);
      const processJob = await campaignQueue.getJob(processJobId);
      const processJobState = processJob ? await processJob.getState() : null;

      if (!processJob || ["completed", "failed"].includes(processJobState)) {
        if (processJobState === "failed") {
          await removeCampaignQueueJob(processJobId);
        }

        await campaignQueue.add(
          "ProcessCampaign",
          { id: campaign.id, delay: 0 },
          {
            jobId: processJobId,
            delay: 0,
            removeOnComplete: true,
            removeOnFail: true
          }
        );

        requeued += 1;
      }
    }

    logCampaignMetric("Reconciliacao de campanhas concluida", {
      campaigns: campaigns.length,
      finalized,
      requeued,
      staleMinutes: campaignReconcileStaleMinutes,
      durationMs: Date.now() - startedAt
    });
  } catch (err: any) {
    Sentry.captureException(err);
    logCampaignMetric("Erro na reconciliacao de campanhas", {
      durationMs: Date.now() - startedAt,
      error: err.message
    });
  }
}

async function handleLoginStatus(job) {
  const users: { id: number }[] = await sequelize.query(
    `select id from "Users" where "updatedAt" < now() - '5 minutes'::interval and online = true`,
    { type: QueryTypes.SELECT }
  );
  for (let item of users) {
    try {
      const user = await User.findByPk(item.id);
      await user.update({ online: false });
      logger.info(`Usuário passado para offline: ${item.id}`);
    } catch (e: any) {
      Sentry.captureException(e);
    }
  }
}


async function handleInvoiceCreate() {
  logger.info("GERENDO RECEITA...");
  const job = new CronJob('*/5 * * * * *', async () => {
    const companies = await Company.findAll();
    companies.map(async c => {
    
      const status = c.status;
      const dueDate = c.dueDate; 
      const date = moment(dueDate).format();
      const timestamp = moment().format();
      const hoje = moment().format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");
      const diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
      const dias = moment.duration(diff).asDays();
    
      if(status === true){

      	//logger.info(`EMPRESA: ${c.id} está ATIVA com vencimento em: ${vencimento} | ${dias}`);
      
      	//Verifico se a empresa está a mais de 10 dias sem pagamento
        
        if(dias <= -3){
       
          logger.info(`EMPRESA: ${c.id} está VENCIDA A MAIS DE 3 DIAS... INATIVANDO... ${dias}`);
          c.status = false;
          await c.save(); // Save the updated company record
          logger.info(`EMPRESA: ${c.id} foi INATIVADA.`);
          logger.info(`EMPRESA: ${c.id} Desativando conexões com o WhatsApp...`);
          
          try {
    		const whatsapps = await Whatsapp.findAll({
      		where: {
        		companyId: c.id,
      		},
      			attributes: ['id','status','session'],
    		});

    		for (const whatsapp of whatsapps) {

            	if (whatsapp.session) {
    				await whatsapp.update({ status: "DISCONNECTED", session: "" });
    				const wbot = getWbot(whatsapp.id);
    				await wbot.logout();
                	logger.info(`EMPRESA: ${c.id} teve o WhatsApp ${whatsapp.id} desconectado...`);
  				}
    		}
          
  		  } catch (error) {
    		// Lidar com erros, se houver
    		console.error('Erro ao buscar os IDs de WhatsApp:', error);
    		throw error;
  		  }

        
        }else{ // ELSE if(dias <= -3){
        
          const plan = await Plan.findByPk(c.planId);
        
          const sql = `SELECT * FROM "Invoices" WHERE "companyId" = ${c.id} AND "status" = 'open';`
          const openInvoices = await sequelize.query(sql, { type: QueryTypes.SELECT }) as { id: number, dueDate: Date }[];

          const existingInvoice = openInvoices.find(invoice => moment(invoice.dueDate).format("DD/MM/yyyy") === vencimento);
        
          if (existingInvoice) {
            // Due date already exists, no action needed
            //logger.info(`Fatura Existente`);
        
          } else if (openInvoices.length > 0) {
            const updateSql = `UPDATE "Invoices" SET "dueDate" = '${date}', "updatedAt" = '${timestamp}' WHERE "id" = ${openInvoices[0].id};`;

            await sequelize.query(updateSql, { type: QueryTypes.UPDATE });
        
            logger.info(`Fatura Atualizada ID: ${openInvoices[0].id}`);
        
          } else {
          
            const sql = `INSERT INTO "Invoices" (detail, status, value, "updatedAt", "createdAt", "dueDate", "companyId")
            VALUES ('${plan.name}', 'open', '${plan.value}', '${timestamp}', '${timestamp}', '${date}', ${c.id});`

            const invoiceInsert = await sequelize.query(sql, { type: QueryTypes.INSERT });
        
            logger.info(`Fatura Gerada para o cliente: ${c.id}`);

            // Rest of the code for sending email
          }
        
          
        
        
        } // if(dias <= -6){
        

      }else{ // ELSE if(status === true){
      
      	//logger.info(`EMPRESA: ${c.id} está INATIVA`);
      
      }
    
    

    });
  });

  job.start();
}

export async function startQueueProcess(options: StartQueueProcessOptions = {}) {
  const mode = normalizeQueueProcessMode(
    options.mode || process.env.QUEUE_PROCESS_MODE
  );
  const shouldRunApiQueues = mode === "all" || mode === "api";
  const shouldRunWorkerQueues = mode === "all" || mode === "worker";

  logger.info(`Iniciando processamento de filas: modo=${mode}`);

  if (shouldRunApiQueues) {
    messageQueue.process("SendMessage", handleSendMessage);

    scheduleMonitor.process("Verify", handleVerifySchedules);

    sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);

    campaignQueue.process(
      "DispatchCampaign",
      campaignDispatchConcurrency,
      handleDispatchCampaign
    );

    userMonitor.process("VerifyLoginStatus", handleLoginStatus);

    //queueMonitor.process("VerifyQueueStatus", handleVerifyQueue);

    handleCloseTicketsAutomatic();

    handleInvoiceCreate();

    scheduleMonitor.add(
      "Verify",
      {},
      {
        repeat: { cron: "*/5 * * * * *", key: "verify" },
        removeOnComplete: true
      }
    );

    userMonitor.add(
      "VerifyLoginStatus",
      {},
      {
        repeat: { cron: "* * * * *", key: "verify-login" },
        removeOnComplete: true
      }
    );

    queueMonitor.add(
      "VerifyQueueStatus",
      {},
      {
        repeat: { cron: "*/20 * * * * *" },
        removeOnComplete: true
      }
    );
  }

  if (shouldRunWorkerQueues) {
    campaignQueue.process("VerifyCampaigns", handleVerifyCampaigns);

    campaignQueue.process(
      "ProcessCampaign",
      campaignProcessConcurrency,
      handleProcessCampaign
    );

    campaignQueue.process(
      "PrepareContact",
      campaignPrepareConcurrency,
      handlePrepareContact
    );

    campaignQueue.process("FinalizeCampaign", handleFinalizeCampaign);
    campaignQueue.process(
      "CleanupCampaignShipping",
      handleCleanupCampaignShipping
    );
    campaignQueue.process(
      "ReconcileCampaigns",
      handleReconcileCampaigns
    );

    campaignQueue.add(
      "VerifyCampaigns",
      {},
      {
        repeat: { cron: "*/20 * * * * *", key: "verify-campaing" },
        removeOnComplete: true
      }
    );

    campaignQueue.add(
      "CleanupCampaignShipping",
      {},
      {
        repeat: { cron: "15 3 * * *", key: "cleanup-campaign-shipping" },
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    campaignQueue.add(
      "ReconcileCampaigns",
      {},
      {
        repeat: { cron: "*/10 * * * *", key: "reconcile-campaigns" },
        removeOnComplete: true,
        removeOnFail: true
      }
    );
  }
}
