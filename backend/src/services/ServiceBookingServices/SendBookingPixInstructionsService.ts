import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ServiceBooking from "../../models/ServiceBooking";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import {
  getSchedulingPaymentSettings,
  SchedulingPaymentSettings
} from "../SchedulingServices/ServiceSchedulingPaymentSettingsService";
import {
  createPixCharge,
  resolvePixDetectionMode
} from "../SchedulingServices/PaymentProviderService";
import {
  buildPixPaymentMessageBlocks,
  isPixConfigurationReady,
  isPixPendingPaymentBooking
} from "../SchedulingServices/ServiceSchedulingPixService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";

type SendBookingPixInstructionsInput = {
  companyId: number;
  bookingId?: number | string;
  booking?: ServiceBooking;
  ticket?: Ticket;
  paymentSettings?: SchedulingPaymentSettings;
  forceRegeneration?: boolean;
  reason: "booking_created" | "admin_regeneration";
};

type SendBookingPixInstructionsOutput = {
  booking: ServiceBooking;
  sent: boolean;
  messageCount: number;
};

const appendPixRequestHistory = (
  booking: ServiceBooking,
  reason: SendBookingPixInstructionsInput["reason"],
  provider: string,
  detectionMode: "provider" | "manual",
  fallbackUsed: boolean
): any => {
  const contextJson =
    booking.contextJson && typeof booking.contextJson === "object"
      ? booking.contextJson
      : {};

  const paymentHistory = Array.isArray(contextJson.paymentHistory)
    ? contextJson.paymentHistory
    : [];

  paymentHistory.push({
    at: new Date().toISOString(),
    action: reason === "admin_regeneration" ? "pix_regeneration_requested" : "pix_payment_requested",
    paymentReference: booking.paymentReference || null,
    pixTxId: booking.pixTxId || null,
    provider: provider || null
  });

  contextJson.paymentHistory = paymentHistory.slice(-30);
  const paymentContext =
    contextJson.payment && typeof contextJson.payment === "object"
      ? contextJson.payment
      : {};
  paymentContext.pix = {
    ...(paymentContext.pix || {}),
    provider: provider || booking.pixProvider || "manual",
    detectionMode,
    autoConfirmationEligible: detectionMode === "provider",
    fallbackUsed
  };
  paymentContext.autoConfirmation = {
    ...(paymentContext.autoConfirmation || {}),
    detectionMode,
    eligible: detectionMode === "provider",
    provider: provider || booking.pixProvider || "manual",
    fallbackUsed
  };
  contextJson.payment = paymentContext;

  return contextJson;
};

const resolveBooking = async ({
  companyId,
  bookingId,
  booking
}: {
  companyId: number;
  bookingId?: number | string;
  booking?: ServiceBooking;
}): Promise<ServiceBooking> => {
  if (booking) {
    if (Number(booking.companyId) !== Number(companyId)) {
      throw new AppError("ERR_BOOKING_COMPANY_MISMATCH", 403);
    }
    return booking;
  }

  if (!bookingId) {
    throw new AppError("ERR_INVALID_BOOKING", 400);
  }

  const foundBooking = await ServiceBooking.findOne({
    where: {
      id: Number(bookingId),
      companyId
    }
  });

  if (!foundBooking) {
    throw new AppError("ERR_SERVICE_BOOKING_NOT_FOUND", 404);
  }

  return foundBooking;
};

const resolveTicketWithContact = async (
  booking: ServiceBooking,
  ticket?: Ticket
): Promise<Ticket | null> => {
  if (
    ticket &&
    Number(ticket.id) === Number(booking.ticketId) &&
    Number(ticket.companyId) === Number(booking.companyId) &&
    Boolean((ticket as any).contact)
  ) {
    return ticket;
  }

  if (!booking.ticketId) {
    return null;
  }

  return Ticket.findOne({
    where: {
      id: booking.ticketId,
      companyId: booking.companyId
    },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number"]
      }
    ]
  });
};

const SendBookingPixInstructionsService = async ({
  companyId,
  bookingId,
  booking: incomingBooking,
  ticket: incomingTicket,
  paymentSettings: providedPaymentSettings,
  forceRegeneration = false,
  reason
}: SendBookingPixInstructionsInput): Promise<SendBookingPixInstructionsOutput> => {
  const startedAt = Date.now();
  const booking = await resolveBooking({
    companyId,
    bookingId,
    booking: incomingBooking
  });

  if (!isPixPendingPaymentBooking(booking)) {
    return {
      booking,
      sent: false,
      messageCount: 0
    };
  }

  if (
    String(booking.status || "").toLowerCase() === "pending_payment" &&
    booking.paymentDueAt &&
    new Date(booking.paymentDueAt).getTime() < Date.now()
  ) {
    throw new AppError("ERR_PAYMENT_EXPIRED", 409);
  }

  const paymentSettings =
    providedPaymentSettings || (await getSchedulingPaymentSettings(companyId));

  if (!isPixConfigurationReady(paymentSettings.pix)) {
    return {
      booking,
      sent: false,
      messageCount: 0
    };
  }

  const charge = await createPixCharge({
    booking,
    pixSettings: paymentSettings.pix,
    amount: Number(booking.depositAmount || 0),
    customerName:
      booking.customerNameSnapshot ||
      (booking as any)?.contact?.name ||
      "Cliente",
    expiresAt: booking.paymentDueAt || null,
    forceRegeneration: Boolean(forceRegeneration)
  });

  await booking.update({
    paymentReference: booking.paymentReference || null,
    pixPayload: charge.payload || null,
    pixTxId: charge.txId || null,
    pixExpiresAt: charge.expiresAt || booking.paymentDueAt || null,
    pixProvider: charge.provider,
    pixLocationId: charge.locationId || null,
    pixQrCode: charge.qrCode || null
  });

  const ticket = await resolveTicketWithContact(booking, incomingTicket);
  if (!ticket || !ticket.contact) {
    return {
      booking,
      sent: false,
      messageCount: 0
    };
  }

  const customInstructions =
    String((booking.contextJson as any)?.payment?.instructions || "").trim() ||
    String(paymentSettings.paymentInstructions || "").trim();

  const messages = buildPixPaymentMessageBlocks({
    booking,
    pixSettings: paymentSettings.pix,
    customInstructions,
    optionalPayment: String(booking.status || "").toLowerCase() !== "pending_payment",
    detectionMode: charge.detectionMode || resolvePixDetectionMode(charge.provider)
  });

  for (const message of messages) {
    await SendWhatsAppMessage({
      ticket,
      body: message
    });
  }

  const contextJson = appendPixRequestHistory(
    booking,
    reason,
    charge.provider,
    charge.detectionMode || resolvePixDetectionMode(charge.provider),
    Boolean(charge.fallbackUsed)
  );
  await booking.update({ contextJson });

  logger.info(
    {
      event:
        reason === "admin_regeneration"
          ? "scheduling_pix_regeneration_requested"
          : "scheduling_pix_payment_requested",
      companyId: booking.companyId,
      bookingId: booking.id,
      serviceId: booking.companyServiceId,
      professionalId: booking.professionalId,
      pixProvider: charge.provider,
      pixLocationId: booking.pixLocationId || null,
      paymentReference: booking.paymentReference || null,
      pixTxId: booking.pixTxId || null,
      messageCount: messages.length,
      durationMs: Date.now() - startedAt
    },
    "PIX payment instructions sent"
  );

  return {
    booking,
    sent: messages.length > 0,
    messageCount: messages.length
  };
};

export default SendBookingPixInstructionsService;
