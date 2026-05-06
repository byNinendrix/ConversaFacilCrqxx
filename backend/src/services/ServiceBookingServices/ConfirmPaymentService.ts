import moment from "moment";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ServiceBooking from "../../models/ServiceBooking";
import ServiceSchedulingSession from "../../models/ServiceSchedulingSession";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";

type ConfirmPaymentInput = {
  companyId: number;
  bookingId?: number | string;
  paymentReference?: string | null;
  pixTxId?: string | null;
  source: "manual" | "webhook" | "internal";
};

type ConfirmPaymentResult = {
  booking: ServiceBooking;
  alreadyProcessed: boolean;
};

const appendPaymentHistory = (
  context: any,
  payload: Record<string, any>
): Record<string, any> => {
  const contextJson = context && typeof context === "object" ? context : {};
  const history = Array.isArray(contextJson.paymentHistory)
    ? contextJson.paymentHistory
    : [];

  history.push({
    at: new Date().toISOString(),
    ...payload
  });

  contextJson.paymentHistory = history.slice(-30);
  return contextJson;
};

const setPaymentOrigin = (
  context: any,
  source: ConfirmPaymentInput["source"],
  paid = false
): Record<string, any> => {
  const contextJson = context && typeof context === "object" ? context : {};
  const paymentContext =
    contextJson.payment && typeof contextJson.payment === "object"
      ? contextJson.payment
      : {};

  paymentContext.lastConfirmationSource = source;
  paymentContext.lastConfirmationAt = new Date().toISOString();

  if (paid) {
    paymentContext.status = "paid";
  }

  contextJson.payment = paymentContext;
  return contextJson;
};

const notifyBookingPaymentConfirmed = async (
  booking: ServiceBooking
): Promise<void> => {
  if (!booking.ticketId) {
    return;
  }

  const ticket = await Ticket.findOne({
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

  if (!ticket || !ticket.contact) {
    return;
  }

  try {
    const reference = String(booking.paymentReference || "").trim();
    await SendWhatsAppMessage({
      ticket,
      body: `Pagamento aprovado com sucesso! Seu agendamento foi confirmado.${reference ? `\nReferencia: *${reference}*` : ""}`
    });
  } catch (error) {
    logger.warn(
      {
        event: "scheduling_payment_confirmation_notify_failed",
        companyId: booking.companyId,
        bookingId: booking.id,
        error
      },
      "Failed to send payment confirmation message"
    );
  }
};

const finalizeActiveSchedulingSessionsForBooking = async (
  booking: ServiceBooking,
  source: ConfirmPaymentInput["source"]
): Promise<void> => {
  if (!booking.ticketId || !booking.whatsappId) {
    return;
  }

  const activeSessions = await ServiceSchedulingSession.findAll({
    where: {
      companyId: booking.companyId,
      whatsappId: booking.whatsappId,
      ticketId: booking.ticketId,
      status: "active"
    }
  });

  if (!activeSessions.length) {
    return;
  }

  const nowIso = new Date().toISOString();

  for (const session of activeSessions) {
    const contextJson =
      session.contextJson && typeof session.contextJson === "object"
        ? session.contextJson
        : {};
    const history = Array.isArray(contextJson.history) ? contextJson.history : [];
    history.push({
      at: nowIso,
      event: "session_completed_after_payment_confirmation",
      payload: {
        source,
        bookingId: booking.id,
        paymentStatus: booking.paymentStatus
      }
    });

    await session.update({
      status: "completed",
      currentStep: "completed",
      lastInteractionAt: new Date(),
      expiresAt: null,
      contextJson: {
        ...contextJson,
        history: history.slice(-100)
      }
    });
  }

  logger.info(
    {
      event: "scheduling_sessions_finalized_after_payment_confirmation",
      companyId: booking.companyId,
      bookingId: booking.id,
      ticketId: booking.ticketId,
      whatsappId: booking.whatsappId,
      sessionCount: activeSessions.length,
      source
    },
    "Active scheduling sessions finalized after payment confirmation"
  );
};

const resolveBookingForConfirmation = async ({
  companyId,
  bookingId,
  paymentReference,
  pixTxId,
  transaction
}: {
  companyId: number;
  bookingId?: number | string;
  paymentReference?: string | null;
  pixTxId?: string | null;
  transaction: any;
}): Promise<ServiceBooking> => {
  const normalizedReference = String(paymentReference || "").trim();
  const normalizedPixTxId = String(pixTxId || "").trim();
  const normalizedBookingId = bookingId ? Number(bookingId) : null;

  if (normalizedBookingId && Number.isInteger(normalizedBookingId) && normalizedBookingId > 0) {
    const booking = await ServiceBooking.findOne({
      where: {
        id: normalizedBookingId,
        companyId
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (booking) {
      return booking;
    }
  }

  if (normalizedReference) {
    const booking = await ServiceBooking.findOne({
      where: {
        companyId,
        paymentReference: normalizedReference
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (booking) {
      return booking;
    }
  }

  if (normalizedPixTxId) {
    const booking = await ServiceBooking.findOne({
      where: {
        companyId,
        pixTxId: normalizedPixTxId
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (booking) {
      return booking;
    }
  }

  throw new AppError("ERR_SERVICE_BOOKING_NOT_FOUND", 404);
};

const ConfirmPaymentService = async ({
  companyId,
  bookingId,
  paymentReference,
  pixTxId,
  source
}: ConfirmPaymentInput): Promise<ConfirmPaymentResult> => {
  const startedAt = Date.now();

  const result = await sequelize.transaction(async transaction => {
    const booking = await resolveBookingForConfirmation({
      companyId,
      bookingId,
      paymentReference,
      pixTxId,
      transaction
    });

    if (["cancelled", "expired"].includes(String(booking.status || "").toLowerCase())) {
      throw new AppError("ERR_BOOKING_NOT_PAYABLE", 409);
    }

    if (String(booking.paymentStatus) === "paid") {
      const updatedContext = appendPaymentHistory(booking.contextJson, {
        source,
        action: "duplicate_payment_confirmation_ignored",
        paymentReference: paymentReference || booking.paymentReference || null,
        pixTxId: pixTxId || booking.pixTxId || null
      });
      const enrichedContext = setPaymentOrigin(updatedContext, source, true);

      if (enrichedContext !== booking.contextJson) {
        await booking.update({ contextJson: enrichedContext }, { transaction });
      }

      logger.info(
        {
          event:
            (pixTxId || booking.pixTxId)
              ? "scheduling_duplicate_pix_confirmation_ignored"
              : "scheduling_duplicate_payment_notification_ignored",
          companyId,
          bookingId: booking.id,
          serviceId: booking.companyServiceId,
          professionalId: booking.professionalId,
          paymentReference: booking.paymentReference || null,
          pixTxId: booking.pixTxId || null,
          paymentStatus: booking.paymentStatus,
          durationMs: Date.now() - startedAt
        },
        "Duplicate payment confirmation ignored"
      );

      return {
        booking,
        alreadyProcessed: true
      };
    }

    const now = new Date();
    if (
      booking.paymentDueAt &&
      moment(booking.paymentDueAt).isValid() &&
      new Date(booking.paymentDueAt).getTime() < now.getTime() &&
      String(booking.status) === "pending_payment"
    ) {
      const expiredContext = appendPaymentHistory(booking.contextJson, {
        source,
        action: "payment_rejected_after_deadline",
        paymentReference: paymentReference || booking.paymentReference || null,
        pixTxId: pixTxId || booking.pixTxId || null
      });
      const enrichedExpiredContext = setPaymentOrigin(expiredContext, source, false);

      await booking.update(
        {
          status: "expired",
          paymentStatus: "expired",
          activeSlotStartAt: null,
          activeSlotResourceKey: null,
          cancelledAt: now,
          contextJson: enrichedExpiredContext
        },
        { transaction }
      );

      throw new AppError("ERR_PAYMENT_EXPIRED", 409);
    }

    const nextStatus =
      String(booking.status) === "pending_payment" ? "confirmed" : booking.status;

    const nextPaymentStatus = "paid";
    const nextContext = appendPaymentHistory(booking.contextJson, {
      source,
      action: "payment_confirmed",
      paymentReference: paymentReference || booking.paymentReference || null,
      pixTxId: pixTxId || booking.pixTxId || null
    });
    const enrichedNextContext = setPaymentOrigin(nextContext, source, true);

    await booking.update(
      {
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        paidAt: now,
        paymentReference: paymentReference || booking.paymentReference || null,
        pixTxId: pixTxId || booking.pixTxId || null,
        confirmedAt: nextStatus === "confirmed" ? now : booking.confirmedAt,
        contextJson: enrichedNextContext
      },
      { transaction }
    );

    logger.info(
      {
        event:
          (pixTxId || booking.pixTxId)
            ? "scheduling_pix_payment_confirmed"
            : "scheduling_payment_confirmed",
        companyId,
        bookingId: booking.id,
        serviceId: booking.companyServiceId,
        professionalId: booking.professionalId,
        paymentReference: paymentReference || booking.paymentReference || null,
        pixTxId: pixTxId || booking.pixTxId || null,
        paymentStatus: nextPaymentStatus,
        bookingStatus: nextStatus,
        source,
        durationMs: Date.now() - startedAt
      },
      "Booking payment confirmed"
    );

    return {
      booking,
      alreadyProcessed: false
    };
  });

  if (!result.alreadyProcessed) {
    await notifyBookingPaymentConfirmed(result.booking);
  }
  await finalizeActiveSchedulingSessionsForBooking(result.booking, source);

  return result;
};

export default ConfirmPaymentService;
