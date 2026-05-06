import moment, { Moment } from "moment";
import { Op, QueryTypes, Sequelize, UniqueConstraintError } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import CompanyService from "../../models/CompanyService";
import CompanyServiceAvailability from "../../models/CompanyServiceAvailability";
import CompanyServiceProfessional from "../../models/CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "../../models/CompanyServiceSpecificSlot";
import ServiceBooking from "../../models/ServiceBooking";
import ServiceBookingSlotLock from "../../models/ServiceBookingSlotLock";
import ServiceSchedulingSession from "../../models/ServiceSchedulingSession";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import {
  trackBookingAttemptMetric,
  trackBookingFailureMetric,
  trackSlotConflictMetric
} from "./ServiceSchedulingMetrics";
import {
  SchedulingDepositType,
  SchedulingPaymentMode,
  getSchedulingPaymentSettings
} from "./ServiceSchedulingPaymentSettingsService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendBookingPixInstructionsService from "../ServiceBookingServices/SendBookingPixInstructionsService";
import ListSlotsService from "../ServiceBookingServices/ListSlotsService";

interface RuntimeContext {
  companyId: number;
  ticket: Ticket;
  inputText: string;
}

interface SchedulingService extends CompanyService {
  availabilities: CompanyServiceAvailability[];
  specificSlots: CompanyServiceSpecificSlot[];
  professionals: Array<
    CompanyServiceProfessional & {
      professional?: User;
    }
  >;
}

type DateOption = {
  date: string;
  label: string;
  slots: Array<{
    startAtIso: string;
    endAtIso: string;
    label: string;
    capacity?: number;
    source?: "specific" | "recurring";
    availableProfessionalIds?: number[];
  }>;
};

const ACTIVE_BOOKING_STATUSES = ["scheduled", "confirmed", "pending_payment"];
const SESSION_TTL_MINUTES = 30;
const SLOT_LOCK_TTL_MINUTES = 2;
const MAX_DATE_OPTIONS = 7;
const MAX_TIME_OPTIONS = 12;
const SLOT_UNAVAILABLE_FALLBACK_MESSAGE =
  "Esse hor\u00e1rio acabou de ser reservado. Aqui est\u00e3o outras op\u00e7\u00f5es:";
const LOCK_WAIT_LOG_THRESHOLD_MS = 25;
const MAX_BOOKING_CONFIRM_ATTEMPTS = 2;
const ASSIGNMENT_MODES = ["automatic", "manual", "least_loaded"] as const;
const TERMINAL_SESSION_STEPS = ["completed", "cancelled", "expired"] as const;

type SlotUsageRow = {
  startAt: Date;
  usedCount: number | string;
};

type BookingArgs = {
  session: ServiceSchedulingSession;
  ticket: Ticket;
  service: SchedulingService;
  slotStartAt: Date;
  slotEndAt: Date;
};

type BookingPaymentSnapshot = {
  paymentMode: SchedulingPaymentMode;
  depositType: SchedulingDepositType;
  depositValue: number;
  depositAmount: number;
  paymentHoldMinutes: number;
  paymentInstructions: string;
  pixEnabled: boolean;
  pixSendMode: string;
  requiresPaymentHold: boolean;
};

const asDurationMs = (startedAtMs: number): number => Date.now() - startedAtMs;

const asSlotIso = (slotStartAt: Date): string => moment(slotStartAt).toISOString();

const asSlotMinute = (slotIso: string): number => {
  const parsed = moment(slotIso);
  return parsed.hours() * 60 + parsed.minutes();
};

const isRetryableConcurrencyError = (error: any): boolean => {
  if (error instanceof UniqueConstraintError) {
    return true;
  }

  if (error instanceof AppError && error.message === "ERR_SLOT_UNAVAILABLE") {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("deadlock") ||
    message.includes("lock wait timeout") ||
    message.includes("could not serialize")
  );
};

const normalizeText = (value: any): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const hasKeyword = (inputText: string, keywords: string[]): boolean => {
  const normalized = normalizeText(inputText);
  return keywords.some(keyword => normalized.includes(keyword));
};

const isTerminalSessionStep = (value: any): boolean =>
  TERMINAL_SESSION_STEPS.includes(String(value || "").toLowerCase() as any);

const parseChoice = (input: string): number | null => {
  const match = String(input || "").match(/\d+/);
  if (!match) return null;
  const choice = Number(match[0]);
  return Number.isInteger(choice) && choice > 0 ? choice : null;
};

const parseTimeMinutes = (value: string): number => {
  const [hour, minute] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hour * 60 + minute;
};

const formatCurrency = (value: number): string => {
  const parsed = Number(value || 0);
  return parsed.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

const computeDepositAmount = ({
  servicePrice,
  depositType,
  depositValue
}: {
  servicePrice: number;
  depositType: SchedulingDepositType;
  depositValue: number;
}): number => {
  const safePrice = Number.isFinite(servicePrice) ? Math.max(servicePrice, 0) : 0;
  const safeValue = Number.isFinite(depositValue) ? Math.max(depositValue, 0) : 0;

  if (depositType === "percentage") {
    const safePercentage = Math.min(Math.max(safeValue, 0), 100);
    return Number(((safePrice * safePercentage) / 100).toFixed(2));
  }

  return Number(safeValue.toFixed(2));
};

const buildPaymentLine = (booking: ServiceBooking): string => {
  const amount = Number(booking.depositAmount || 0);
  if (!amount || amount <= 0) {
    return "";
  }
  return `\nSinal: *${formatCurrency(amount)}*`;
};

const buildPaymentInstructionText = (
  booking: ServiceBooking,
  fallbackInstructions: string
): string => {
  const pixEnabled = Boolean((booking.contextJson as any)?.payment?.pix?.enabled);
  if (pixEnabled && String(booking.paymentStatus || "").toLowerCase() === "pending") {
    return "";
  }

  const customInstructions =
    String((booking.contextJson as any)?.payment?.instructions || "").trim() ||
    String(fallbackInstructions || "").trim();

  const reference = String(booking.paymentReference || "").trim();
  if (customInstructions) {
    return `\n${customInstructions}${reference ? `\nReferencia: *${reference}*` : ""}`;
  }

  if (reference) {
    return `\nUse a referencia *${reference}* para concluir o pagamento.`;
  }

  return "";
};

const formatDateLabel = (date: Moment): string => {
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  return `${date.format("DD/MM/YYYY")} (${weekdays[date.day()]})`;
};

const ensureSessionContext = (session: ServiceSchedulingSession): any => {
  const contextJson =
    session.contextJson && typeof session.contextJson === "object"
      ? session.contextJson
      : {};

  if (!Array.isArray(contextJson.history)) {
    contextJson.history = [];
  }

  return contextJson;
};

const pushHistory = (
  contextJson: any,
  event: string,
  payload: Record<string, any> = {}
) => {
  const entry = {
    at: new Date().toISOString(),
    event,
    payload
  };

  contextJson.history.push(entry);
  if (contextJson.history.length > 100) {
    contextJson.history = contextJson.history.slice(-100);
  }
};

const buildServiceMenuMessage = (
  services: SchedulingService[],
  whatsapp: Whatsapp
): string => {
  const offerMessage =
    String(whatsapp.schedulingOfferMessage || "").trim() ||
    "Olá! Posso te ajudar com agendamento. Escolha o serviço desejado:";

  const showPrice = Boolean(whatsapp.schedulingShowPrice);

  const optionsText = services
    .map((service, index) => {
      const base = `${index + 1} - ${service.name}`;
      if (!showPrice || service.showPrice === false) return base;
      return `${base} (${formatCurrency(Number(service.price || 0))})`;
    })
    .join("\n");

  return `${offerMessage}\n\n${optionsText}`;
};

const buildDateMenuMessage = (serviceName: string, options: DateOption[]): string => {
  const rows = options.map((option, index) => `${index + 1} - ${option.label}`).join("\n");
  return `Perfeito! Escolha uma data para *${serviceName}*:\n\n${rows}`;
};

const buildProfessionalMenuMessage = (
  serviceName: string,
  professionals: Array<{ id: number; name: string }>
): string => {
  const rows = professionals
    .map((professional, index) => `${index + 1} - ${professional.name}`)
    .join("\n");
  return `Perfeito! Escolha o profissional para *${serviceName}*:\n\n${rows}`;
};

const buildTimeMenuMessage = (serviceName: string, dateLabel: string, options: DateOption["slots"]): string => {
  const rows = options.map((option, index) => `${index + 1} - ${option.label}`).join("\n");
  return `Horários disponíveis para *${serviceName}* em *${dateLabel}*:\n\n${rows}`;
};

const buildConfirmationMessage = (
  serviceName: string,
  dateLabel: string,
  hourLabel: string
): string =>
  `Confirma o agendamento de *${serviceName}* para *${dateLabel}* às *${hourLabel}*?\n\n1 - Confirmar\n2 - Cancelar`;

const buildBookingCreatedMessage = ({
  booking,
  serviceName,
  dateLabel,
  hourLabel,
  professionalLine
}: {
  booking: ServiceBooking;
  serviceName: string;
  dateLabel: string;
  hourLabel: string;
  professionalLine: string;
}): string => {
  const status = String(booking.status || "").toLowerCase();
  const paymentStatus = String(booking.paymentStatus || "").toLowerCase();
  const paymentLine = buildPaymentLine(booking);
  const paymentInstructionLine = buildPaymentInstructionText(booking, "");

  if (status === "pending_payment") {
    const dueAtText = booking.paymentDueAt
      ? moment(booking.paymentDueAt).format("DD/MM/YYYY HH:mm")
      : "em breve";
    return `Reserva criada com sucesso!\n\nServico: *${serviceName}*\nData: *${dateLabel}*\nHorario: *${hourLabel}*${professionalLine}${paymentLine}\nStatus: *Aguardando pagamento*\nPrazo para pagamento: *${dueAtText}*${paymentInstructionLine}`;
  }

  if (paymentStatus === "pending") {
    return `Agendamento confirmado com sucesso!\n\nServico: *${serviceName}*\nData: *${dateLabel}*\nHorario: *${hourLabel}*${professionalLine}${paymentLine}\nPagamento: *Opcional (pendente)*${paymentInstructionLine}`;
  }

  return `Agendamento confirmado com sucesso!\n\nServico: *${serviceName}*\nData: *${dateLabel}*\nHorario: *${hourLabel}*${professionalLine}`;
};

const sendPixInstructionsIfRequired = async ({
  booking,
  ticket
}: {
  booking: ServiceBooking;
  ticket: Ticket;
}): Promise<void> => {
  const pixEnabled = Boolean((booking.contextJson as any)?.payment?.pix?.enabled);
  const paymentPending = String(booking.paymentStatus || "").toLowerCase() === "pending";
  const hasDepositAmount = Number(booking.depositAmount || 0) > 0;

  if (!pixEnabled || !paymentPending || !hasDepositAmount) {
    return;
  }

  try {
    await SendBookingPixInstructionsService({
      companyId: ticket.companyId,
      booking,
      ticket,
      reason: "booking_created"
    });
  } catch (error) {
    logger.warn(
      {
        event: "scheduling_pix_payment_notify_failed",
        companyId: booking.companyId,
        bookingId: booking.id,
        serviceId: booking.companyServiceId,
        professionalId: booking.professionalId,
        paymentReference: booking.paymentReference || null,
        pixTxId: booking.pixTxId || null,
        error
      },
      "Failed to send PIX payment instructions"
    );
  }
};
const normalizeAssignmentMode = (value: any): "automatic" | "manual" | "least_loaded" => {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  if (ASSIGNMENT_MODES.includes(mode as any)) {
    return mode as "automatic" | "manual" | "least_loaded";
  }
  return "automatic";
};

const asResourceKey = (professionalId: number | null): string =>
  professionalId ? `professional:${professionalId}` : "service";

const getServiceProfessionals = (
  service: SchedulingService
): Array<{ id: number; name: string; priority: number; isActive: boolean }> => {
  return (service.professionals || [])
    .filter(binding => {
      if (!binding || binding.isActive === false) {
        return false;
      }
      const professional = (binding as any).professional as User | undefined;
      return Boolean(professional && Number(professional.companyId) === Number(service.companyId));
    })
    .map(binding => ({
      id: Number(binding.userId),
      name:
        String(((binding as any).professional?.name || "")).trim() ||
        `Profissional #${binding.userId}`,
      priority: Number(binding.priority || 0),
      isActive: binding.isActive !== false
    }))
    .sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority;
      }
      return first.name.localeCompare(second.name);
    });
};

const getProfessionalAvailabilities = (
  availabilities: CompanyServiceAvailability[],
  professionalId: number | null
): CompanyServiceAvailability[] => {
  const activeAvailabilities = (availabilities || []).filter(
    availability => availability.isActive !== false
  );

  if (!professionalId) {
    return activeAvailabilities.filter(
      availability => availability.professionalId === null || availability.professionalId === undefined
    );
  }

  const specific = activeAvailabilities.filter(
    availability => Number(availability.professionalId || 0) === professionalId
  );
  if (specific.length > 0) {
    return specific;
  }

  return activeAvailabilities.filter(
    availability => availability.professionalId === null || availability.professionalId === undefined
  );
};

const isSlotInsideAvailabilities = ({
  availabilities,
  weekday,
  slotMinute,
  slotEndMinute
}: {
  availabilities: CompanyServiceAvailability[];
  weekday: number;
  slotMinute: number;
  slotEndMinute: number;
}): boolean => {
  return availabilities.some(availability => {
    if (Number(availability.weekday) !== weekday) {
      return false;
    }

    const start = parseTimeMinutes(availability.startTime);
    const end = parseTimeMinutes(availability.endTime);
    if (end <= start) {
      return false;
    }

    return slotMinute >= start && slotEndMinute <= end;
  });
};

const loadSchedulableServices = async (companyId: number): Promise<SchedulingService[]> => {
  const services = (await CompanyService.findAll({
    where: {
      companyId,
      isActive: true
    },
    include: [
      {
        model: CompanyServiceAvailability,
        as: "availabilities",
        where: { isActive: true, companyId },
        required: false
      },
      {
        model: CompanyServiceSpecificSlot,
        as: "specificSlots",
        where: { isActive: true, companyId },
        required: false
      },
      {
        model: CompanyServiceProfessional,
        as: "professionals",
        where: { companyId, isActive: true },
        required: false,
        include: [
          {
            model: User,
            as: "professional",
            where: { companyId },
            required: false,
            attributes: ["id", "name", "companyId"]
          }
        ]
      }
    ],
    order: [
      ["displayOrder", "ASC"],
      ["name", "ASC"]
    ]
  })) as SchedulingService[];

  return services.filter(service => {
    const availabilityCount = Array.isArray(service?.availabilities)
      ? service.availabilities.length
      : 0;
    const specificSlotCount = Array.isArray(service?.specificSlots)
      ? service.specificSlots.length
      : 0;

    if (!service || (availabilityCount === 0 && specificSlotCount === 0)) {
      return false;
    }
    if (Number(service.durationMinutes || 0) <= 0) {
      return false;
    }
    return true;
  });
};

const cleanupExpiredSlotLocks = async ({
  companyId,
  transaction
}: {
  companyId: number;
  transaction?: any;
}): Promise<void> => {
  await ServiceBookingSlotLock.destroy({
    where: {
      companyId,
      expiresAt: {
        [Op.lte]: new Date()
      }
    },
    transaction
  });
};

const fetchBookedSlotUsage = async ({
  companyId,
  companyServiceId,
  rangeStart,
  rangeEnd
}: {
  companyId: number;
  companyServiceId: number;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<Map<string, number>> => {
  const dialect = sequelize.getDialect();
  const query =
    dialect === "postgres"
      ? `
        SELECT "startAt" AS "startAt", COUNT(*)::int AS "usedCount"
        FROM "ServiceBookings"
        WHERE "companyId" = :companyId
          AND "companyServiceId" = :companyServiceId
          AND "status" IN ('scheduled', 'confirmed', 'pending_payment')
          AND "startAt" BETWEEN :rangeStart AND :rangeEnd
        GROUP BY "startAt"
      `
      : `
        SELECT startAt AS startAt, COUNT(*) AS usedCount
        FROM ServiceBookings
        WHERE companyId = :companyId
          AND companyServiceId = :companyServiceId
          AND status IN ('scheduled', 'confirmed', 'pending_payment')
          AND startAt BETWEEN :rangeStart AND :rangeEnd
        GROUP BY startAt
      `;

  const rows = (await sequelize.query(query, {
    type: QueryTypes.SELECT,
    replacements: {
      companyId,
      companyServiceId,
      rangeStart,
      rangeEnd
    }
  })) as SlotUsageRow[];

  const bookedByStartAt = new Map<string, number>();
  rows.forEach(row => {
    bookedByStartAt.set(
      moment(row.startAt).toISOString(),
      Number(row.usedCount || 0)
    );
  });

  return bookedByStartAt;
};

const prioritizeAlternativeSlots = ({
  dateOptions,
  preferredStartAt,
  preferredProfessionalId
}: {
  dateOptions: DateOption[];
  preferredStartAt?: Date;
  preferredProfessionalId?: number | null;
}): { dateOption: DateOption; slots: DateOption["slots"] } => {
  const preferred = preferredStartAt ? moment(preferredStartAt) : null;
  const preferredDate = preferred ? preferred.format("YYYY-MM-DD") : null;
  const preferredMinutes = preferred ? preferred.hours() * 60 + preferred.minutes() : null;

  const rankedDateOptions = [...dateOptions].sort((first, second) => {
    if (!preferred) {
      return first.date.localeCompare(second.date);
    }

    const firstSameDay = first.date === preferredDate ? 0 : 1;
    const secondSameDay = second.date === preferredDate ? 0 : 1;
    if (firstSameDay !== secondSameDay) {
      return firstSameDay - secondSameDay;
    }

    const firstDistance = moment(first.date, "YYYY-MM-DD", true).diff(
      preferred.clone().startOf("day"),
      "days"
    );
    const secondDistance = moment(second.date, "YYYY-MM-DD", true).diff(
      preferred.clone().startOf("day"),
      "days"
    );
    if (firstDistance !== secondDistance) {
      return firstDistance - secondDistance;
    }

    return first.date.localeCompare(second.date);
  });

  const bestDateOption = rankedDateOptions[0];
  const slots = [...bestDateOption.slots].sort((first, second) => {
    if (preferredProfessionalId) {
      const firstSameProfessional = first.availableProfessionalIds?.includes(
        preferredProfessionalId
      )
        ? 0
        : 1;
      const secondSameProfessional = second.availableProfessionalIds?.includes(
        preferredProfessionalId
      )
        ? 0
        : 1;
      if (firstSameProfessional !== secondSameProfessional) {
        return firstSameProfessional - secondSameProfessional;
      }
    }

    if (
      preferred &&
      preferredMinutes !== null &&
      bestDateOption.date === preferredDate
    ) {
      const firstDistance = Math.abs(asSlotMinute(first.startAtIso) - preferredMinutes);
      const secondDistance = Math.abs(asSlotMinute(second.startAtIso) - preferredMinutes);
      if (firstDistance !== secondDistance) {
        return firstDistance - secondDistance;
      }
    }

    return first.startAtIso.localeCompare(second.startAtIso);
  });

  return {
    dateOption: bestDateOption,
    slots: slots.slice(0, MAX_TIME_OPTIONS)
  };
};

const buildSlotOptionsForService = async (
  service: SchedulingService,
  options: {
    professionalId?: number | null;
    includeOtherProfessionals?: boolean;
  } = {}
): Promise<DateOption[]> => {
  const shouldFilterToSingleProfessional =
    Boolean(options.professionalId) && options.includeOtherProfessionals === false;

  const slotResponse = await ListSlotsService({
    companyId: service.companyId,
    companyServiceId: service.id,
    days: String(MAX_DATE_OPTIONS),
    professionalId: shouldFilterToSingleProfessional
      ? String(options.professionalId)
      : undefined
  });

  return slotResponse.dateOptions as DateOption[];
};

const markSessionAsFinished = async (
  session: ServiceSchedulingSession,
  status: "completed" | "cancelled" | "expired",
  contextJson?: any
) => {
  await session.update({
    status,
    currentStep: status,
    expiresAt: null,
    lastInteractionAt: new Date(),
    contextJson: contextJson || session.contextJson
  });
};

const acquireSlotLock = async ({
  companyId,
  companyServiceId,
  slotStartAt,
  professionalId,
  transaction
}: {
  companyId: number;
  companyServiceId: number;
  slotStartAt: Date;
  professionalId: number | null;
  transaction: any;
}): Promise<void> => {
  const lockStartedAt = Date.now();
  await cleanupExpiredSlotLocks({ companyId, transaction });

  const dialect = sequelize.getDialect();
  const expiresAt = moment().add(SLOT_LOCK_TTL_MINUTES, "minutes").toDate();
  const resourceKey = asResourceKey(professionalId);

  if (dialect === "postgres") {
    await sequelize.query(
      `
        INSERT INTO "ServiceBookingSlotLocks" ("companyId", "companyServiceId", "professionalId", "resourceKey", "startAt", "expiresAt", "createdAt", "updatedAt")
        VALUES (:companyId, :companyServiceId, :professionalId, :resourceKey, :startAt, :expiresAt, NOW(), NOW())
        ON CONFLICT ("companyId", "companyServiceId", "startAt", "resourceKey")
        DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", "expiresAt" = EXCLUDED."expiresAt"
      `,
      {
        replacements: {
          companyId,
          companyServiceId,
          professionalId,
          resourceKey,
          startAt: slotStartAt,
          expiresAt
        },
        transaction
      }
    );
  } else {
    await sequelize.query(
      `
        INSERT INTO ServiceBookingSlotLocks (companyId, companyServiceId, professionalId, resourceKey, startAt, expiresAt, createdAt, updatedAt)
        VALUES (:companyId, :companyServiceId, :professionalId, :resourceKey, :startAt, :expiresAt, NOW(), NOW())
        ON DUPLICATE KEY UPDATE updatedAt = VALUES(updatedAt), expiresAt = VALUES(expiresAt)
      `,
      {
        replacements: {
          companyId,
          companyServiceId,
          professionalId,
          resourceKey,
          startAt: slotStartAt,
          expiresAt
        },
        transaction
      }
    );
  }

  const lockWaitStartedAt = Date.now();
  await ServiceBookingSlotLock.findOne({
    where: {
      companyId,
      companyServiceId,
      resourceKey,
      startAt: slotStartAt,
      expiresAt: {
        [Op.gt]: new Date()
      }
    },
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  const lockWaitMs = asDurationMs(lockWaitStartedAt);
  logger.info(
    {
        event: "scheduling_slot_lock_acquired",
        companyId,
        serviceId: companyServiceId,
        professionalId,
        resourceKey,
        slotStartAt: asSlotIso(slotStartAt),
        lockWaitMs,
        durationMs: asDurationMs(lockStartedAt)
    },
    "Slot lock acquired"
  );

  if (lockWaitMs >= LOCK_WAIT_LOG_THRESHOLD_MS) {
    logger.info(
      {
        event: "scheduling_slot_lock_waited",
        companyId,
        serviceId: companyServiceId,
        professionalId,
        resourceKey,
        slotStartAt: asSlotIso(slotStartAt),
        lockWaitMs
      },
      "Slot lock wait detected"
    );
  }
};

const confirmBooking = async ({
  session,
  ticket,
  service,
  slotStartAt,
  slotEndAt,
  attemptNumber = 1
}: {
  session: ServiceSchedulingSession;
  ticket: Ticket;
  service: SchedulingService;
  slotStartAt: Date;
  slotEndAt: Date;
  attemptNumber?: number;
}): Promise<ServiceBooking> => {
  const confirmStartedAt = Date.now();
  trackBookingAttemptMetric({
    companyId: ticket.companyId,
    serviceId: service.id
  });

  try {
    const booking = await sequelize.transaction(async transaction => {
      const lockedServiceBase = await CompanyService.findOne({
        where: {
          id: service.id,
          companyId: ticket.companyId,
          isActive: true
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedServiceBase) {
        throw new AppError("ERR_SERVICE_NOT_FOUND", 404);
      }

      const [availabilities, specificSlots, professionals] = await Promise.all([
        CompanyServiceAvailability.findAll({
          where: {
            companyId: ticket.companyId,
            companyServiceId: lockedServiceBase.id,
            isActive: true
          },
          transaction
        }),
        CompanyServiceSpecificSlot.findAll({
          where: {
            companyId: ticket.companyId,
            companyServiceId: lockedServiceBase.id,
            isActive: true
          },
          transaction
        }),
        CompanyServiceProfessional.findAll({
          where: {
            companyId: ticket.companyId,
            companyServiceId: lockedServiceBase.id,
            isActive: true
          },
          include: [
            {
              model: User,
              as: "professional",
              where: { companyId: ticket.companyId },
              required: false,
              attributes: ["id", "name", "companyId"]
            }
          ],
          transaction
        })
      ]);

      const lockedService = lockedServiceBase as SchedulingService;
      (lockedService as any).availabilities = availabilities;
      (lockedService as any).specificSlots = specificSlots;
      (lockedService as any).professionals = professionals as any;

      const slotMoment = moment(slotStartAt);
      const assignmentMode = normalizeAssignmentMode(lockedService.assignmentMode);
      const serviceProfessionals = getServiceProfessionals(lockedService);
      const hasProfessionals = serviceProfessionals.length > 0;

      const selectedProfessionalId = session.selectedProfessionalId
        ? Number(session.selectedProfessionalId)
        : null;
      const slotPreview = await ListSlotsService({
        companyId: ticket.companyId,
        companyServiceId: lockedService.id,
        days: String(Math.max(Number(lockedService.maxAdvanceDays || 1), 1)),
        professionalId:
          assignmentMode === "manual" && selectedProfessionalId
            ? String(selectedProfessionalId)
            : undefined
      });

      const targetSlotIso = slotMoment.toISOString();
      const selectedSlot = (slotPreview.dateOptions || [])
        .flatMap(option => option.slots || [])
        .find(slot => slot.startAtIso === targetSlotIso);

      if (!selectedSlot) {
        throw new AppError("ERR_SLOT_OUTSIDE_AVAILABILITY", 409);
      }

      const slotCapacity = Math.max(
        Number(
          selectedSlot.capacity ||
            Number(lockedService.maxBookingsPerSlot || 1)
        ),
        1
      );

      let candidateProfessionalIds: Array<number | null> = hasProfessionals
        ? Array.from(
            new Set((selectedSlot.availableProfessionalIds || []).map(Number))
          ).filter(id => Number.isInteger(id) && id > 0)
        : [null];

      if (hasProfessionals && assignmentMode === "manual" && selectedProfessionalId) {
        candidateProfessionalIds = candidateProfessionalIds.filter(
          professionalId => professionalId === selectedProfessionalId
        );
      }

      if (!candidateProfessionalIds.length) {
        throw new AppError("ERR_SLOT_OUTSIDE_AVAILABILITY", 409);
      }

      const professionalWhereClause = hasProfessionals
        ? {
            professionalId: {
              [Op.in]: candidateProfessionalIds.filter(
                professionalId => professionalId !== null
              ) as number[]
            }
          }
        : {
            professionalId: {
              [Op.is]: null
            }
          };

      const bookingsForSlot = await ServiceBooking.findAll({
        where: {
          companyId: ticket.companyId,
          companyServiceId: lockedService.id,
          status: {
            [Op.in]: ACTIVE_BOOKING_STATUSES
          },
          startAt: slotStartAt,
          ...professionalWhereClause
        },
        attributes: ["id", "professionalId"],
        raw: true,
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (bookingsForSlot.length >= slotCapacity) {
        throw new AppError("ERR_SLOT_UNAVAILABLE", 409);
      }

      const lockWhereClause = hasProfessionals
        ? {
            professionalId: {
              [Op.in]: candidateProfessionalIds.filter(
                professionalId => professionalId !== null
              ) as number[]
            }
          }
        : {
            professionalId: {
              [Op.is]: null
            }
          };

      const slotLocks = await ServiceBookingSlotLock.findAll({
        where: {
          companyId: ticket.companyId,
          companyServiceId: lockedService.id,
          startAt: slotStartAt,
          expiresAt: {
            [Op.gt]: new Date()
          },
          ...lockWhereClause
        },
        attributes: ["professionalId", "resourceKey"],
        raw: true,
        transaction
      });

      const occupiedResources = new Set<string>();
      bookingsForSlot.forEach((bookingRow: any) => {
        occupiedResources.add(
          asResourceKey(
            bookingRow.professionalId !== null && bookingRow.professionalId !== undefined
              ? Number(bookingRow.professionalId)
              : null
          )
        );
      });
      slotLocks.forEach((lockRow: any) => {
        const key =
          String(lockRow.resourceKey || "").trim() ||
          asResourceKey(
            lockRow.professionalId !== null && lockRow.professionalId !== undefined
              ? Number(lockRow.professionalId)
              : null
          );
        occupiedResources.add(key);
      });

      const availableCandidates = candidateProfessionalIds.filter(
        professionalId => !occupiedResources.has(asResourceKey(professionalId))
      );

      if (!availableCandidates.length) {
        trackSlotConflictMetric({
          companyId: ticket.companyId,
          serviceId: lockedService.id
        });
        logger.warn(
          {
            event: "scheduling_slot_conflict_detected",
            companyId: ticket.companyId,
            serviceId: lockedService.id,
            slotStartAt: asSlotIso(slotStartAt),
            attemptNumber,
            durationMs: asDurationMs(confirmStartedAt)
          },
          "Slot conflict detected before booking insert"
        );
        throw new AppError("ERR_SLOT_UNAVAILABLE", 409);
      }

      let chosenProfessionalId: number | null = null;
      if (hasProfessionals) {
        if (assignmentMode === "manual") {
          chosenProfessionalId = Number(availableCandidates[0]);
        } else if (assignmentMode === "least_loaded") {
          const rangeStartDay = slotMoment.clone().startOf("day").toDate();
          const rangeEndDay = slotMoment.clone().endOf("day").toDate();
          const loadRows = await ServiceBooking.findAll({
            where: {
              companyId: ticket.companyId,
              companyServiceId: lockedService.id,
              status: {
                [Op.in]: ACTIVE_BOOKING_STATUSES
              },
              professionalId: {
                [Op.in]: availableCandidates as number[]
              },
              startAt: {
                [Op.between]: [rangeStartDay, rangeEndDay]
              } as any
            },
            attributes: [
              "professionalId",
              [Sequelize.fn("COUNT", Sequelize.col("id")), "loadCount"]
            ],
            group: ["professionalId"],
            raw: true,
            transaction
          });

          const loadByProfessional = new Map<number, number>();
          loadRows.forEach((row: any) => {
            loadByProfessional.set(
              Number(row.professionalId),
              Number(row.loadCount || 0)
            );
          });

          const sorted = (availableCandidates as number[]).sort((first, second) => {
            const firstLoad = loadByProfessional.get(first) || 0;
            const secondLoad = loadByProfessional.get(second) || 0;
            if (firstLoad !== secondLoad) {
              return firstLoad - secondLoad;
            }

            const firstPriority =
              serviceProfessionals.find(professional => professional.id === first)
                ?.priority || 0;
            const secondPriority =
              serviceProfessionals.find(professional => professional.id === second)
                ?.priority || 0;
            if (firstPriority !== secondPriority) {
              return firstPriority - secondPriority;
            }

            return first - second;
          });

          chosenProfessionalId = Number(sorted[0]);
        } else {
          const sorted = (availableCandidates as number[]).sort((first, second) => {
            const firstPriority =
              serviceProfessionals.find(professional => professional.id === first)
                ?.priority || 0;
            const secondPriority =
              serviceProfessionals.find(professional => professional.id === second)
                ?.priority || 0;

            if (firstPriority !== secondPriority) {
              return firstPriority - secondPriority;
            }
            return first - second;
          });
          chosenProfessionalId = Number(sorted[0]);
        }
      }

      await acquireSlotLock({
        companyId: ticket.companyId,
        companyServiceId: service.id,
        slotStartAt,
        professionalId: chosenProfessionalId,
        transaction
      });

      const existingBookingForResource = await ServiceBooking.findOne({
        where: {
          companyId: ticket.companyId,
          companyServiceId: lockedService.id,
          status: {
            [Op.in]: ACTIVE_BOOKING_STATUSES
          },
          startAt: slotStartAt,
          professionalId:
            chosenProfessionalId === null
              ? {
                  [Op.is]: null
                }
              : chosenProfessionalId
        },
        attributes: ["id"],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (existingBookingForResource) {
        throw new AppError("ERR_SLOT_UNAVAILABLE", 409);
      }

      const paymentSettings = await getSchedulingPaymentSettings(ticket.companyId, {
        transaction
      });
      const servicePrice = Number(lockedService.price || 0);
      const depositAmount = computeDepositAmount({
        servicePrice,
        depositType: paymentSettings.depositType,
        depositValue: paymentSettings.depositValue
      });
      const requiresPaymentHold =
        paymentSettings.paymentMode === "required" && depositAmount > 0;
      const bookingStatus = requiresPaymentHold ? "pending_payment" : "confirmed";
      const paymentStatus =
        paymentSettings.paymentMode === "disabled"
          ? "not_required"
          : depositAmount > 0
            ? "pending"
            : "not_required";
      const paymentDueAt = requiresPaymentHold
        ? moment().add(paymentSettings.paymentHoldMinutes, "minutes").toDate()
        : null;
      const paymentReference =
        paymentStatus === "pending"
          ? `SB-${ticket.companyId}-${ticket.id}-${slotMoment.valueOf()}`
          : null;

      const paymentSnapshot: BookingPaymentSnapshot = {
        paymentMode: paymentSettings.paymentMode,
        depositType: paymentSettings.depositType,
        depositValue: paymentSettings.depositValue,
        depositAmount,
        paymentHoldMinutes: paymentSettings.paymentHoldMinutes,
        paymentInstructions: paymentSettings.paymentInstructions,
        pixEnabled: paymentSettings.pix.enabled,
        pixSendMode: paymentSettings.pix.sendMode,
        requiresPaymentHold
      };

      const createdBooking = await ServiceBooking.create(
        {
          companyId: ticket.companyId,
          whatsappId: ticket.whatsappId,
          contactId: ticket.contactId,
          ticketId: ticket.id,
          companyServiceId: lockedService.id,
          professionalId: chosenProfessionalId,
          startAt: slotStartAt,
          endAt: slotEndAt,
          status: bookingStatus,
          paymentStatus,
          depositAmount,
          paymentDueAt,
          paymentReference,
          source: "whatsapp",
          customerNameSnapshot: ticket.contact?.name || null,
          customerNumberSnapshot: ticket.contact?.number || null,
          confirmedAt: bookingStatus === "confirmed" ? new Date() : null,
          contextJson: {
            sessionId: session.id,
            channel: "whatsapp",
            payment: {
              mode: paymentSnapshot.paymentMode,
              status: paymentStatus,
              depositType: paymentSnapshot.depositType,
              depositValue: paymentSnapshot.depositValue,
              depositAmount: paymentSnapshot.depositAmount,
              paymentDueAt: paymentDueAt ? paymentDueAt.toISOString() : null,
              instructions: paymentSnapshot.paymentInstructions || null,
              pix: {
                enabled: paymentSnapshot.pixEnabled,
                sendMode: paymentSnapshot.pixSendMode,
                keyType: paymentSettings.pix.keyType
              }
            }
          }
        },
        { transaction }
      );

      logger.info(
        {
          event: "scheduling_booking_created",
          companyId: ticket.companyId,
          serviceId: lockedService.id,
          professionalId: chosenProfessionalId,
          slotStartAt: asSlotIso(slotStartAt),
          bookingId: createdBooking.id,
          bookingStatus,
          paymentStatus,
          paymentReference,
          attemptNumber,
          durationMs: asDurationMs(confirmStartedAt)
        },
        "Booking created successfully"
      );

      return createdBooking;
    });

    return booking;
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      trackSlotConflictMetric({
        companyId: ticket.companyId,
        serviceId: service.id
      });
      logger.warn(
        {
          event: "scheduling_booking_rejected",
          reason: "unique_constraint_conflict",
          companyId: ticket.companyId,
          serviceId: service.id,
          slotStartAt: asSlotIso(slotStartAt),
          attemptNumber,
          durationMs: asDurationMs(confirmStartedAt)
        },
        "Booking rejected by database unique constraint"
      );
      throw new AppError("ERR_SLOT_UNAVAILABLE", 409);
    }

    if (error instanceof AppError && error.message === "ERR_SLOT_UNAVAILABLE") {
      trackSlotConflictMetric({
        companyId: ticket.companyId,
        serviceId: service.id
      });
    }
    if (error instanceof AppError) {
      logger.warn(
        {
          event: "scheduling_booking_rejected",
          reason: error.message,
          companyId: ticket.companyId,
          serviceId: service.id,
          slotStartAt: asSlotIso(slotStartAt),
          attemptNumber,
          durationMs: asDurationMs(confirmStartedAt)
        },
        "Booking rejected"
      );
    }

    if (!(error instanceof AppError)) {
      logger.error(
        {
          event: "scheduling_booking_failed_unexpected",
          companyId: ticket.companyId,
          serviceId: service.id,
          slotStartAt: asSlotIso(slotStartAt),
          attemptNumber,
          errorMessage: String((error as any)?.message || error),
          errorCode: (error as any)?.code || null,
          errorName: (error as any)?.name || null,
          durationMs: asDurationMs(confirmStartedAt)
        },
        "Unexpected booking error"
      );
    }

    throw error;
  }
};

const confirmBookingWithSingleRetry = async (
  args: BookingArgs
): Promise<ServiceBooking> => {
  let lastError: any;

  for (let attemptNumber = 1; attemptNumber <= MAX_BOOKING_CONFIRM_ATTEMPTS; attemptNumber += 1) {
    try {
      return await confirmBooking({
        ...args,
        attemptNumber
      });
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attemptNumber < MAX_BOOKING_CONFIRM_ATTEMPTS &&
        isRetryableConcurrencyError(error);

      if (!shouldRetry) {
        trackBookingFailureMetric({
          companyId: args.ticket.companyId,
          serviceId: args.service.id
        });
        throw error;
      }

      logger.warn(
        {
          event: "scheduling_booking_retry",
          companyId: args.ticket.companyId,
          serviceId: args.service.id,
          slotStartAt: asSlotIso(args.slotStartAt),
          attemptNumber
        },
        "Retrying booking confirmation after concurrency failure"
      );
    }
  }

  throw lastError;
};

class ServiceSchedulingRuntimeService {
  public static async tryHandleInbound({
    companyId,
    ticket,
    inputText
  }: RuntimeContext): Promise<boolean> {
    try {
      const ticketWhatsappId = Number(ticket.whatsappId || 0);
      if (!ticketWhatsappId || ticket.companyId !== companyId) {
        return false;
      }

      const whatsapp = await Whatsapp.findOne({
        where: {
          id: ticketWhatsappId,
          companyId
        },
        attributes: [
          "id",
          "companyId",
          "schedulingAutomationEnabled",
          "schedulingOfferMessage",
          "schedulingShowPrice",
          "schedulingRequireConfirmation"
        ]
      });

      if (!whatsapp || !Boolean(whatsapp.schedulingAutomationEnabled)) {
        const staleSession = await ServiceSchedulingSession.findOne({
          where: {
            companyId,
            whatsappId: ticketWhatsappId,
            ticketId: ticket.id,
            status: "active"
          },
          order: [["id", "DESC"]]
        });

        if (staleSession) {
          const contextJson = ensureSessionContext(staleSession);
          pushHistory(contextJson, "stopped_disabled_connection");
          await markSessionAsFinished(staleSession, "completed", contextJson);
        }

        return false;
      }

      const now = new Date();
      let sessionExpired = false;
      let session = await ServiceSchedulingSession.findOne({
        where: {
          companyId,
          whatsappId: ticketWhatsappId,
          ticketId: ticket.id,
          status: "active"
        },
        order: [["id", "DESC"]]
      });

      if (session && isTerminalSessionStep(session.currentStep)) {
        const contextJson = ensureSessionContext(session);
        pushHistory(contextJson, "active_session_with_terminal_step_detected", {
          currentStep: session.currentStep
        });
        await markSessionAsFinished(
          session,
          String(session.currentStep || "").toLowerCase() as
            | "completed"
            | "cancelled"
            | "expired",
          contextJson
        );
        session = null;
      }

      if (session?.expiresAt && new Date(session.expiresAt).getTime() < now.getTime()) {
        const contextJson = ensureSessionContext(session);
        pushHistory(contextJson, "session_expired", {
          errorCode: "ERR_SESSION_TIMEOUT"
        });
        await markSessionAsFinished(session, "expired", contextJson);
        sessionExpired = true;
        session = null;
      }

      if (session && !session.expiresAt) {
        const lastInteractionBase =
          session.lastInteractionAt || session.updatedAt || session.createdAt;
        if (
          lastInteractionBase &&
          moment(lastInteractionBase)
            .add(SESSION_TTL_MINUTES, "minutes")
            .isBefore(now)
        ) {
          const contextJson = ensureSessionContext(session);
          pushHistory(contextJson, "session_expired_without_expires_at", {
            lastInteractionAt: moment(lastInteractionBase).toISOString()
          });
          await markSessionAsFinished(session, "expired", contextJson);
          sessionExpired = true;
          session = null;
        }
      }

      const normalizedInput = normalizeText(inputText);
      const requestHumanIntent = /\b(atendente|humano|pessoa|suporte)\b/i.test(
        String(inputText || "")
      );
      const startByKeyword = /\b(agendar|agenda|agendamento|servi[cç]o|marcar)\b/i.test(
        String(inputText || "")
      );
      const restartByKeyword =
        startByKeyword ||
        hasKeyword(inputText, ["novo agendamento", "reiniciar", "recomecar", "recomeçar"]);

      if (!session) {
        const lastSession = await ServiceSchedulingSession.findOne({
          where: {
            companyId,
            whatsappId: ticketWhatsappId,
            ticketId: ticket.id,
            status: {
              [Op.in]: ["completed", "cancelled", "expired"]
            }
          },
          order: [["id", "DESC"]]
        });

        if (requestHumanIntent) {
          return false;
        }

        const services = await loadSchedulableServices(companyId);
        if (!services.length) {
          return false;
        }

        const contextJson = {
          offeredServiceIds: services.map(service => service.id),
          history: []
        };
        pushHistory(contextJson, "session_started_auto_offer", {
          offeredServiceIds: contextJson.offeredServiceIds
        });

        session = await ServiceSchedulingSession.create({
          companyId,
          whatsappId: ticketWhatsappId,
          ticketId: ticket.id,
          contactId: ticket.contactId,
          status: "active",
          currentStep: "service_selection",
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        const shouldRestartFromPreviousSession = Boolean(lastSession) && !sessionExpired;
        const restartPrefix = shouldRestartFromPreviousSession
          ? "Vamos iniciar um novo agendamento.\n\n"
          : "";
        const offerMessage = sessionExpired
          ? `Sua sessao expirou por tempo de inatividade. Vamos recomecar.\n\n${buildServiceMenuMessage(
              services,
              whatsapp
            )}`
          : `${restartPrefix}${buildServiceMenuMessage(services, whatsapp)}`;

        if (shouldRestartFromPreviousSession) {
          logger.info(
            {
              event: "scheduling_session_restarted_new_cycle",
              companyId,
              ticketId: ticket.id,
              whatsappId: ticketWhatsappId,
              previousSessionId: lastSession?.id || null,
              previousSessionStatus: lastSession?.status || null,
              previousSessionStep: lastSession?.currentStep || null,
              startByKeyword,
              inputText
            },
            "Scheduling restarted from previous finalized session"
          );
        }

        await SendWhatsAppMessage({
          body: offerMessage,
          ticket
        });

        return true;
      }

      const contextJson = ensureSessionContext(session);

      if (requestHumanIntent) {
        pushHistory(contextJson, "handoff_requested", { inputText });
        await markSessionAsFinished(session, "completed", contextJson);
        return false;
      }

      if (restartByKeyword && session.currentStep !== "service_selection") {
        const services = await loadSchedulableServices(companyId);
        if (!services.length) {
          await markSessionAsFinished(session, "completed", contextJson);
          await SendWhatsAppMessage({
            body: "No momento nao ha servicos disponiveis para agendamento.",
            ticket
          });
          return true;
        }

        const previousStep = session.currentStep;
        pushHistory(contextJson, "restart_requested_by_customer", {
          previousStep,
          inputText
        });

        await session.update({
          currentStep: "service_selection",
          selectedServiceId: null,
          selectedProfessionalId: null,
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        logger.info(
          {
            event: "scheduling_session_restarted_by_keyword",
            companyId,
            ticketId: ticket.id,
            whatsappId: ticketWhatsappId,
            sessionId: session.id,
            previousStep,
            inputText
          },
          "Scheduling restarted by customer keyword"
        );

        await SendWhatsAppMessage({
          body: `Vamos iniciar um novo agendamento.\n\n${buildServiceMenuMessage(
            services,
            whatsapp
          )}`,
          ticket
        });
        return true;
      }

      if (["0", "cancelar", "sair", "parar"].includes(normalizedInput)) {
        pushHistory(contextJson, "booking_flow_cancelled");
        await markSessionAsFinished(session, "cancelled", contextJson);
        await SendWhatsAppMessage({
          body: "Fluxo de agendamento encerrado. Se quiser, posso iniciar novamente quando voce pedir.",
          ticket
        });
        return true;
      }
      const services = await loadSchedulableServices(companyId);

      if (!services.length) {
        pushHistory(contextJson, "no_schedulable_services");
        await markSessionAsFinished(session, "completed", contextJson);
        await SendWhatsAppMessage({
          body: "No momento não há serviços disponíveis para agendamento.",
          ticket
        });
        return true;
      }

      const sendInvalidAndRepeat = async (
        message: string,
        reasonCode = "ERR_INVALID_INPUT"
      ) => {
        pushHistory(contextJson, "invalid_input", {
          errorCode: reasonCode,
          currentStep: session.currentStep,
          inputText
        });
        await SendWhatsAppMessage({ body: message, ticket });
        await session.update({
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });
      };

      if (session.currentStep === "service_selection") {
        const choice = parseChoice(inputText);
        if (!choice || !services[choice - 1]) {
          pushHistory(contextJson, "invalid_service_choice", { inputText });
          await sendInvalidAndRepeat(
            `Opcao invalida. Escolha um servico pelo numero.\n\n${buildServiceMenuMessage(
              services,
              whatsapp
            )}`
          );
          return true;
        }

        const selectedService = services[choice - 1];
        const assignmentMode = normalizeAssignmentMode(selectedService.assignmentMode);
        const serviceProfessionals = getServiceProfessionals(selectedService);
        const requiresProfessionalSelection =
          assignmentMode === "manual" && serviceProfessionals.length > 0;

        if (requiresProfessionalSelection) {
          contextJson.professionalOptions = serviceProfessionals.map(professional => ({
            id: professional.id,
            name: professional.name
          }));
          pushHistory(contextJson, "service_selected_requires_professional", {
            serviceId: selectedService.id,
            assignmentMode
          });

          await session.update({
            selectedServiceId: selectedService.id,
            selectedProfessionalId: null,
            currentStep: "professional_selection",
            selectedDate: null,
            selectedStartAt: null,
            selectedEndAt: null,
            lastInteractionAt: now,
            expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
            contextJson
          });

          await SendWhatsAppMessage({
            body: buildProfessionalMenuMessage(
              selectedService.name,
              serviceProfessionals.map(professional => ({
                id: professional.id,
                name: professional.name
              }))
            ),
            ticket
          });
          return true;
        }

        const dateOptions = await buildSlotOptionsForService(selectedService, {
          professionalId: null,
          includeOtherProfessionals: true
        });

        if (!dateOptions.length) {
          pushHistory(contextJson, "service_without_available_slots", {
            serviceId: selectedService.id
          });
          await sendInvalidAndRepeat(
            `No momento nao encontrei horarios para *${selectedService.name}*.\nEscolha outro servico:\n\n${buildServiceMenuMessage(
              services,
              whatsapp
            )}`
          );
          return true;
        }

        contextJson.dateOptions = dateOptions.map(option => ({
          date: option.date,
          label: option.label
        }));
        pushHistory(contextJson, "service_selected", { serviceId: selectedService.id });

        await session.update({
          selectedServiceId: selectedService.id,
          selectedProfessionalId: null,
          currentStep: "date_selection",
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: buildDateMenuMessage(selectedService.name, dateOptions),
          ticket
        });
        return true;
      }

      const selectedService = services.find(
        service => Number(service.id) === Number(session.selectedServiceId)
      );

      if (!selectedService) {
        pushHistory(contextJson, "selected_service_not_found", {
          errorCode: "ERR_SERVICE_NOT_FOUND"
        });
        await session.update({
          currentStep: "service_selection",
          selectedServiceId: null,
          selectedProfessionalId: null,
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: `O servico escolhido nao esta mais disponivel.\n\n${buildServiceMenuMessage(
            services,
            whatsapp
          )}`,
          ticket
        });
        return true;
      }

      const assignmentMode = normalizeAssignmentMode(selectedService.assignmentMode);
      const serviceProfessionals = getServiceProfessionals(selectedService);
      const requiresProfessionalSelection =
        assignmentMode === "manual" && serviceProfessionals.length > 0;

      if (requiresProfessionalSelection && session.currentStep === "professional_selection") {
        const professionalChoice = parseChoice(inputText);
        if (!professionalChoice || !serviceProfessionals[professionalChoice - 1]) {
          pushHistory(contextJson, "invalid_professional_choice", { inputText });
          await sendInvalidAndRepeat(
            `Opcao invalida. Escolha um profissional pelo numero.\n\n${buildProfessionalMenuMessage(
              selectedService.name,
              serviceProfessionals.map(professional => ({
                id: professional.id,
                name: professional.name
              }))
            )}`
          );
          return true;
        }

        const selectedProfessional = serviceProfessionals[professionalChoice - 1];
        const dateOptionsForProfessional = await buildSlotOptionsForService(selectedService, {
          professionalId: selectedProfessional.id,
          includeOtherProfessionals: false
        });

        if (!dateOptionsForProfessional.length) {
          pushHistory(contextJson, "professional_without_available_slots", {
            serviceId: selectedService.id,
            professionalId: selectedProfessional.id
          });
          await sendInvalidAndRepeat(
            `No momento nao encontrei horarios para *${selectedProfessional.name}*.\nEscolha outro profissional:\n\n${buildProfessionalMenuMessage(
              selectedService.name,
              serviceProfessionals.map(professional => ({
                id: professional.id,
                name: professional.name
              }))
            )}`,
            "ERR_SLOT_UNAVAILABLE"
          );
          return true;
        }

        contextJson.dateOptions = dateOptionsForProfessional.map(option => ({
          date: option.date,
          label: option.label
        }));
        pushHistory(contextJson, "professional_selected", {
          serviceId: selectedService.id,
          professionalId: selectedProfessional.id
        });

        await session.update({
          selectedProfessionalId: selectedProfessional.id,
          currentStep: "date_selection",
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: buildDateMenuMessage(selectedService.name, dateOptionsForProfessional),
          ticket
        });
        return true;
      }

      if (requiresProfessionalSelection && !session.selectedProfessionalId) {
        contextJson.professionalOptions = serviceProfessionals.map(professional => ({
          id: professional.id,
          name: professional.name
        }));
        await session.update({
          currentStep: "professional_selection",
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });
        await SendWhatsAppMessage({
          body: buildProfessionalMenuMessage(
            selectedService.name,
            serviceProfessionals.map(professional => ({
              id: professional.id,
              name: professional.name
            }))
          ),
          ticket
        });
        return true;
      }

      const selectedProfessionalId = session.selectedProfessionalId
        ? Number(session.selectedProfessionalId)
        : null;

      if (
        selectedProfessionalId &&
        !serviceProfessionals.some(professional => professional.id === selectedProfessionalId)
      ) {
        await session.update({
          currentStep: "professional_selection",
          selectedProfessionalId: null,
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });
        await SendWhatsAppMessage({
          body: `O profissional selecionado nao esta mais disponivel.\n\n${buildProfessionalMenuMessage(
            selectedService.name,
            serviceProfessionals.map(professional => ({
              id: professional.id,
              name: professional.name
            }))
          )}`,
          ticket
        });
        return true;
      }

      const dateOptions = await buildSlotOptionsForService(selectedService, {
        professionalId: requiresProfessionalSelection ? selectedProfessionalId : null,
        includeOtherProfessionals: !requiresProfessionalSelection
      });
      if (!dateOptions.length) {
        pushHistory(contextJson, "selected_service_without_slots", {
          serviceId: selectedService.id
        });
        await session.update({
          currentStep: "service_selection",
          selectedServiceId: null,
          selectedProfessionalId: null,
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: `No momento nao encontrei horarios para *${selectedService.name}*.\nEscolha outro servico:\n\n${buildServiceMenuMessage(
            services,
            whatsapp
          )}`,
          ticket
        });
        return true;
      }
      const restartFromServiceSelection = async ({
        message,
        reasonCode
      }: {
        message: string;
        reasonCode: string;
      }): Promise<boolean> => {
        pushHistory(contextJson, "flow_restarted", { reasonCode });
        await session.update({
          currentStep: "service_selection",
          selectedServiceId: null,
          selectedProfessionalId: null,
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: `${message}\n\n${buildServiceMenuMessage(services, whatsapp)}`,
          ticket
        });

        return true;
      };

      const suggestAlternativeSlots = async (
        preferredStartAt?: Date,
        preferredProfessionalId?: number | null
      ): Promise<boolean> => {
        const assignmentMode = normalizeAssignmentMode(selectedService.assignmentMode);
        const lockedProfessionalId = session.selectedProfessionalId
          ? Number(session.selectedProfessionalId)
          : null;
        const refreshedDateOptions = await buildSlotOptionsForService(selectedService, {
          professionalId: lockedProfessionalId,
          includeOtherProfessionals: assignmentMode !== "manual"
        });

        if (!refreshedDateOptions.length) {
          return restartFromServiceSelection({
            message: `No momento nao encontrei mais horarios para *${selectedService.name}*.`,
            reasonCode: "ERR_SLOT_UNAVAILABLE"
          });
        }

        const { dateOption: alternativeDate, slots: alternativeSlots } =
          prioritizeAlternativeSlots({
            dateOptions: refreshedDateOptions,
            preferredStartAt,
            preferredProfessionalId:
              preferredProfessionalId || lockedProfessionalId || null
          });

        contextJson.timeOptions = alternativeSlots;
        pushHistory(contextJson, "slot_alternatives_suggested", {
          errorCode: "ERR_SLOT_UNAVAILABLE",
          selectedDate: alternativeDate.date,
          optionsCount: alternativeSlots.length,
          preferredStartAt: preferredStartAt
            ? asSlotIso(preferredStartAt)
            : null
        });

        await session.update({
          currentStep: "time_selection",
          selectedDate: alternativeDate.date,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: `${SLOT_UNAVAILABLE_FALLBACK_MESSAGE}\n\n${buildTimeMenuMessage(
            selectedService.name,
            alternativeDate.label,
            alternativeSlots
          )}`,
          ticket
        });

        return true;
      };

      const handleFlowError = async (
        error: any,
        preferredStartAt?: Date,
        preferredProfessionalId?: number | null
      ): Promise<boolean> => {
        if (!(error instanceof AppError)) {
          throw error;
        }

        if (
          ["ERR_SLOT_UNAVAILABLE", "ERR_SLOT_OUTSIDE_AVAILABILITY"].includes(
            error.message
          )
        ) {
          return suggestAlternativeSlots(preferredStartAt, preferredProfessionalId);
        }

        if (error.message === "ERR_SERVICE_NOT_FOUND") {
          return restartFromServiceSelection({
            message: "O servico selecionado nao esta mais disponivel.",
            reasonCode: "ERR_SERVICE_NOT_FOUND"
          });
        }

        if (error.message === "ERR_INVALID_INPUT") {
          await sendInvalidAndRepeat(
            "Opcao invalida. Revise e tente novamente.",
            "ERR_INVALID_INPUT"
          );
          return true;
        }

        throw error;
      };

      if (session.currentStep === "date_selection") {
        const choice = parseChoice(inputText);
        if (!choice || !dateOptions[choice - 1]) {
          pushHistory(contextJson, "invalid_date_choice", { inputText });
          await sendInvalidAndRepeat(
            `Opcao invalida. Escolha uma data pelo numero.\n\n${buildDateMenuMessage(
              selectedService.name,
              dateOptions
            )}`
          );
          return true;
        }

        const selectedDateOption = dateOptions[choice - 1];
        const timeOptions = selectedDateOption.slots.slice(0, MAX_TIME_OPTIONS);
        contextJson.timeOptions = timeOptions;
        pushHistory(contextJson, "date_selected", {
          serviceId: selectedService.id,
          selectedDate: selectedDateOption.date
        });

        await session.update({
          selectedDate: selectedDateOption.date,
          currentStep: "time_selection",
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: buildTimeMenuMessage(
            selectedService.name,
            selectedDateOption.label,
            timeOptions
          ),
          ticket
        });
        return true;
      }

      const selectedDateOption = dateOptions.find(
        option => option.date === session.selectedDate
      );
      const timeOptions = selectedDateOption
        ? selectedDateOption.slots.slice(0, MAX_TIME_OPTIONS)
        : [];

      if (!selectedDateOption || !timeOptions.length) {
        pushHistory(contextJson, "selected_date_without_slots", {
          selectedDate: session.selectedDate
        });
        await session.update({
          currentStep: "date_selection",
          selectedDate: null,
          selectedStartAt: null,
          selectedEndAt: null,
          lastInteractionAt: now,
          expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
          contextJson
        });

        await SendWhatsAppMessage({
          body: `Essa data nao esta mais disponivel. Escolha outra data:\n\n${buildDateMenuMessage(
            selectedService.name,
            dateOptions
          )}`,
          ticket
        });
        return true;
      }

      if (session.currentStep === "time_selection") {
        const choice = parseChoice(inputText);
        if (!choice || !timeOptions[choice - 1]) {
          pushHistory(contextJson, "invalid_time_choice", { inputText });
          await sendInvalidAndRepeat(
            `Opcao invalida. Escolha um horario pelo numero.\n\n${buildTimeMenuMessage(
              selectedService.name,
              selectedDateOption.label,
              timeOptions
            )}`
          );
          return true;
        }

        const selectedSlot = timeOptions[choice - 1];
        const selectedStartAt = new Date(selectedSlot.startAtIso);
        const selectedEndAt = new Date(selectedSlot.endAtIso);
        const requireConfirmation = Boolean(
          whatsapp.schedulingRequireConfirmation
        );

        pushHistory(contextJson, "time_selected", {
          selectedDate: selectedDateOption.date,
          selectedStartAt: selectedSlot.startAtIso
        });

        if (requireConfirmation) {
          await session.update({
            selectedStartAt,
            selectedEndAt,
            currentStep: "confirmation",
            lastInteractionAt: now,
            expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
            contextJson
          });

          await SendWhatsAppMessage({
            body: buildConfirmationMessage(
              selectedService.name,
              selectedDateOption.label,
              selectedSlot.label
            ),
            ticket
          });
          return true;
        }

        try {
          const booking = await confirmBookingWithSingleRetry({
            session,
            ticket,
            service: selectedService,
            slotStartAt: selectedStartAt,
            slotEndAt: selectedEndAt
          });
          const professionalLine = booking.professionalId
            ? `\nProfissional: *${
                serviceProfessionals.find(
                  professional => professional.id === Number(booking.professionalId)
                )?.name || `#${booking.professionalId}`
              }*`
            : "";
          pushHistory(contextJson, "booking_confirmed", { bookingId: booking.id });
          await markSessionAsFinished(session, "completed", contextJson);
          await SendWhatsAppMessage({
            body: buildBookingCreatedMessage({
              booking,
              serviceName: selectedService.name,
              dateLabel: selectedDateOption.label,
              hourLabel: selectedSlot.label,
              professionalLine
            }),
            ticket
          });
          await sendPixInstructionsIfRequired({
            booking,
            ticket
          });
          return true;
        } catch (error) {
          const preferredProfessionalId = session.selectedProfessionalId
            ? Number(session.selectedProfessionalId)
            : selectedSlot.availableProfessionalIds?.[0] || null;
          return handleFlowError(error, selectedStartAt, preferredProfessionalId);
        }
      }

      if (session.currentStep === "confirmation") {
        const confirmIntent = ["1", "sim", "s", "ok", "confirmar"];
        const cancelIntent = ["2", "nao", "não", "n", "cancelar"];
        logger.info(
          {
            event: "scheduling_confirmation_input_received",
            companyId,
            ticketId: ticket.id,
            sessionId: session.id,
            currentStep: session.currentStep,
            inputText,
            normalizedInput,
            selectedServiceId: session.selectedServiceId || null,
            selectedDate: session.selectedDate || null,
            selectedStartAt: session.selectedStartAt
              ? moment(session.selectedStartAt).toISOString()
              : null,
            selectedProfessionalId: session.selectedProfessionalId || null
          },
          "Processing scheduling final confirmation input"
        );

        if (cancelIntent.includes(normalizedInput)) {
          pushHistory(contextJson, "booking_cancelled_by_customer");
          await markSessionAsFinished(session, "cancelled", contextJson);
          await SendWhatsAppMessage({
            body: "Tudo bem! O agendamento foi cancelado.",
            ticket
          });
          return true;
        }

        if (!confirmIntent.includes(normalizedInput)) {
          await sendInvalidAndRepeat(
            "Opcao invalida. Responda com:\n1 - Confirmar\n2 - Cancelar"
          );
          return true;
        }

        if (!session.selectedStartAt || !session.selectedEndAt) {
          pushHistory(contextJson, "confirmation_without_slot");
          await session.update({
            currentStep: "time_selection",
            lastInteractionAt: now,
            expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
            contextJson
          });

          await SendWhatsAppMessage({
            body: `Nao consegui validar o horario anterior. Escolha novamente:\n\n${buildTimeMenuMessage(
              selectedService.name,
              selectedDateOption.label,
              timeOptions
            )}`,
            ticket
          });
          return true;
        }

        const selectedTime = timeOptions.find(
          option => option.startAtIso === moment(session.selectedStartAt).toISOString()
        );
        const hourLabel = selectedTime?.label || moment(session.selectedStartAt).format("HH:mm");

        try {
          logger.info(
            {
              event: "scheduling_confirmation_booking_start",
              companyId,
              ticketId: ticket.id,
              sessionId: session.id,
              serviceId: selectedService.id,
              selectedDate: session.selectedDate || null,
              selectedStartAt: moment(session.selectedStartAt).toISOString(),
              selectedEndAt: moment(session.selectedEndAt).toISOString(),
              selectedProfessionalId: session.selectedProfessionalId || null
            },
            "Starting booking creation from final confirmation"
          );
          const booking = await confirmBookingWithSingleRetry({
            session,
            ticket,
            service: selectedService,
            slotStartAt: new Date(session.selectedStartAt),
            slotEndAt: new Date(session.selectedEndAt)
          });
          const professionalLine = booking.professionalId
            ? `\nProfissional: *${
                serviceProfessionals.find(
                  professional => professional.id === Number(booking.professionalId)
                )?.name || `#${booking.professionalId}`
              }*`
            : "";
          pushHistory(contextJson, "booking_confirmed", { bookingId: booking.id });
          logger.info(
            {
              event: "scheduling_confirmation_booking_success",
              companyId,
              ticketId: ticket.id,
              sessionId: session.id,
              bookingId: booking.id,
              bookingStatus: booking.status,
              paymentStatus: booking.paymentStatus,
              paymentReference: booking.paymentReference || null,
              pixTxId: booking.pixTxId || null
            },
            "Booking successfully created from final confirmation"
          );
          await markSessionAsFinished(session, "completed", contextJson);
          await SendWhatsAppMessage({
            body: buildBookingCreatedMessage({
              booking,
              serviceName: selectedService.name,
              dateLabel: selectedDateOption.label,
              hourLabel,
              professionalLine
            }),
            ticket
          });
          await sendPixInstructionsIfRequired({
            booking,
            ticket
          });
          return true;
        } catch (error) {
          logger.error(
            {
              event: "scheduling_confirmation_booking_error",
              companyId,
              ticketId: ticket.id,
              sessionId: session.id,
              serviceId: selectedService.id,
              selectedDate: session.selectedDate || null,
              selectedStartAt: session.selectedStartAt
                ? moment(session.selectedStartAt).toISOString()
                : null,
              selectedEndAt: session.selectedEndAt
                ? moment(session.selectedEndAt).toISOString()
                : null,
              selectedProfessionalId: session.selectedProfessionalId || null,
              errorMessage: String((error as any)?.message || error),
              errorCode: (error as any)?.code || null,
              errorName: (error as any)?.name || null
            },
            "Failed to create booking from final confirmation"
          );
          if (!(error instanceof AppError)) {
            await SendWhatsAppMessage({
              body: "Tive um problema tecnico para confirmar agora. Responda *1* novamente em alguns segundos.",
              ticket
            });
            await session.update({
              lastInteractionAt: now,
              expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
              contextJson
            });
            return true;
          }

          const preferredProfessionalId = session.selectedProfessionalId
            ? Number(session.selectedProfessionalId)
            : selectedTime?.availableProfessionalIds?.[0] || null;
          return handleFlowError(
            error,
            new Date(session.selectedStartAt),
            preferredProfessionalId
          );
        }
      }

      await session.update({
        currentStep: "service_selection",
        selectedServiceId: null,
        selectedProfessionalId: null,
        selectedDate: null,
        selectedStartAt: null,
        selectedEndAt: null,
        lastInteractionAt: now,
        expiresAt: moment(now).add(SESSION_TTL_MINUTES, "minutes").toDate(),
        contextJson
      });

      await SendWhatsAppMessage({
        body: buildServiceMenuMessage(services, whatsapp),
        ticket
      });
      return true;
    } catch (error) {
      logger.error(
        {
          event: "scheduling_runtime_unhandled_error",
          companyId,
          ticketId: ticket?.id || null,
          whatsappId: ticket?.whatsappId || null,
          inputText,
          errorMessage: String((error as any)?.message || error),
          errorCode: (error as any)?.code || null,
          errorName: (error as any)?.name || null
        },
        "ServiceSchedulingRuntimeService error"
      );
      return false;
    }
  }
}

export default ServiceSchedulingRuntimeService;

