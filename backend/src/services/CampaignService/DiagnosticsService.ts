import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import ContactListItem from "../../models/ContactListItem";
import {
  campaignQueue,
  getCampaignFinalizeJobId,
  getCampaignProcessJobId
} from "../../queues";

type Request = {
  id: number | string;
  companyId: number | string;
};

async function describeJob(jobId: string) {
  const job: any = await campaignQueue.getJob(jobId);
  if (!job) {
    return { jobId, found: false };
  }

  const state = await job.getState();

  return {
    jobId,
    found: true,
    state,
    name: job.name,
    attemptsMade: job.attemptsMade || 0,
    attempts: job.opts?.attempts || 1,
    delay: job.delay || 0,
    timestamp: job.timestamp || null,
    processedOn: job.processedOn || null,
    finishedOn: job.finishedOn || null,
    failedReason: job.failedReason || null,
    progress: job._progress || 0
  };
}

async function getCampaignQueueSample(campaignId: number | string) {
  const jobs: any[] = await campaignQueue.getJobs(
    ["waiting", "delayed", "active", "failed"],
    0,
    500
  );
  const filtered = jobs.filter(job => {
    const data = job?.data || {};
    return String(data.campaignId || data.id) === String(campaignId);
  });

  const states = await Promise.all(
    filtered.slice(0, 50).map(async job => ({
      id: String(job.id),
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade || 0,
      failedReason: job.failedReason || null,
      campaignShippingId: job.data?.campaignShippingId || null
    }))
  );

  return {
    scanned: jobs.length,
    matched: filtered.length,
    states
  };
}

const DiagnosticsService = async ({ id, companyId }: Request): Promise<any> => {
  const campaign = await Campaign.findOne({
    where: { id, companyId },
    attributes: [
      "id",
      "name",
      "status",
      "companyId",
      "contactListId",
      "validContactsCount",
      "deliveredCount",
      "confirmationRequestedCount",
      "confirmedCount",
      "failedCount",
      "lastStatsAt",
      "scheduledAt",
      "completedAt",
      "updatedAt"
    ]
  });

  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  const [
    validContacts,
    shippingTotal,
    delivered,
    pending,
    failed,
    confirmationRequested,
    confirmed,
    pendingJobs,
    queueCounts,
    campaignQueueSample,
    processJob,
    finalizeJob
  ] = await Promise.all([
    campaign.contactListId
      ? ContactListItem.count({
          where: {
            contactListId: campaign.contactListId,
            isWhatsappValid: true
          }
        })
      : Promise.resolve(0),
    CampaignShipping.count({ where: { campaignId: campaign.id } }),
    CampaignShipping.count({
      where: { campaignId: campaign.id, deliveredAt: { [Op.not]: null } }
    }),
    CampaignShipping.count({
      where: {
        campaignId: campaign.id,
        deliveredAt: null,
        confirmationRequestedAt: null,
        failedAt: null
      }
    }),
    CampaignShipping.count({
      where: { campaignId: campaign.id, failedAt: { [Op.not]: null } }
    }),
    CampaignShipping.count({
      where: {
        campaignId: campaign.id,
        confirmationRequestedAt: { [Op.not]: null }
      }
    }),
    CampaignShipping.count({
      where: { campaignId: campaign.id, confirmedAt: { [Op.not]: null } }
    }),
    CampaignShipping.findAll({
      where: {
        campaignId: campaign.id,
        deliveredAt: null,
        failedAt: null,
        jobId: { [Op.not]: null }
      },
      attributes: ["id", "contactId", "jobId", "updatedAt", "attempts"],
      limit: 20,
      order: [["updatedAt", "ASC"]]
    }),
    campaignQueue.getJobCounts(),
    getCampaignQueueSample(campaign.id),
    describeJob(getCampaignProcessJobId(campaign.id)),
    describeJob(getCampaignFinalizeJobId(campaign.id))
  ]);

  const sampledDispatchJobs = await Promise.all(
    pendingJobs.map(record => describeJob(String(record.jobId)))
  );

  const campaignJson: any = campaign.toJSON();
  const canUseCached =
    campaign.status === "FINALIZADA" || campaign.status === "CANCELADA";

  return {
    campaign: campaignJson,
    stats: {
      validContacts:
        validContacts ||
        (canUseCached ? campaignJson.validContactsCount || 0 : 0),
      shippingTotal,
      delivered: canUseCached
        ? Math.max(delivered, campaignJson.deliveredCount || 0)
        : delivered,
      pending,
      failed: canUseCached
        ? Math.max(failed, campaignJson.failedCount || 0)
        : failed,
      confirmationRequested: canUseCached
        ? Math.max(
            confirmationRequested,
            campaignJson.confirmationRequestedCount || 0
          )
        : confirmationRequested,
      confirmed: canUseCached
        ? Math.max(confirmed, campaignJson.confirmedCount || 0)
        : confirmed
    },
    queue: {
      counts: queueCounts,
      campaignSample: campaignQueueSample,
      processJob,
      finalizeJob,
      sampledDispatchJobs
    }
  };
};

export default DiagnosticsService;
