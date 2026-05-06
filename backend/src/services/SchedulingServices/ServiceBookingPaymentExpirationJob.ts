import cron from "node-cron";

import { Op } from "sequelize";
import sequelize from "../../database";
import Contact from "../../models/Contact";
import ServiceBooking from "../../models/ServiceBooking";
import ServiceSchedulingSession from "../../models/ServiceSchedulingSession";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";

let expirationTask: cron.ScheduledTask | null = null;
const BATCH_SIZE = 100;

const appendExpirationHistory = (booking: ServiceBooking): Record<string, any> => {
  const context = booking.contextJson;
  const contextJson = context && typeof context === "object" ? context : {};
  const paymentHistory = Array.isArray(contextJson.paymentHistory)
    ? contextJson.paymentHistory
    : [];

  paymentHistory.push({
    at: new Date().toISOString(),
    action: "payment_expired",
    paymentReference: booking.paymentReference || null,
    pixTxId: booking.pixTxId || null
  });

  contextJson.paymentHistory = paymentHistory.slice(-30);
  return contextJson;
};

const notifyPaymentExpired = async (booking: ServiceBooking): Promise<void> => {
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
      body:
        `O prazo para pagamento${reference ? ` da referencia *${reference}*` : ""} expirou e o horario foi liberado. Se quiser, posso buscar novos horarios para voce.`
    });
  } catch (error) {
    logger.warn(
      {
        event: "scheduling_payment_expired_notify_failed",
        companyId: booking.companyId,
        bookingId: booking.id,
        error
      },
      "Failed to send payment expiration message"
    );
  }
};

const finalizeActiveSchedulingSessionsAfterExpiration = async (
  booking: ServiceBooking
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
      event: "session_expired_after_payment_deadline",
      payload: {
        bookingId: booking.id,
        paymentReference: booking.paymentReference || null,
        pixTxId: booking.pixTxId || null
      }
    });

    await session.update({
      status: "expired",
      currentStep: "expired",
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
      event: "scheduling_sessions_finalized_after_payment_expired",
      companyId: booking.companyId,
      bookingId: booking.id,
      ticketId: booking.ticketId,
      whatsappId: booking.whatsappId,
      sessionCount: activeSessions.length
    },
    "Active scheduling sessions finalized after payment expiration"
  );
};

const expireSinglePendingPaymentBooking = async (
  bookingId: number
): Promise<ServiceBooking | null> => {
  return sequelize.transaction(async transaction => {
    const booking = await ServiceBooking.findOne({
      where: { id: bookingId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!booking) {
      return null;
    }

    if (
      String(booking.status) !== "pending_payment" ||
      String(booking.paymentStatus) !== "pending"
    ) {
      return null;
    }

    if (!booking.paymentDueAt || new Date(booking.paymentDueAt).getTime() > Date.now()) {
      return null;
    }

    const contextJson = appendExpirationHistory(booking);

    await booking.update(
      {
        status: "expired",
        paymentStatus: "expired",
        activeSlotStartAt: null,
        activeSlotResourceKey: null,
        cancelledAt: new Date(),
        contextJson
      },
      { transaction }
    );

    return booking;
  });
};

export const runServiceBookingPaymentExpirationCleanup = async (): Promise<void> => {
  const startedAt = Date.now();

  try {
    const pendingBookings = await ServiceBooking.findAll({
      where: {
        status: "pending_payment",
        paymentStatus: "pending",
        paymentDueAt: {
          [Op.lte]: new Date()
        }
      },
      order: [["paymentDueAt", "ASC"]],
      limit: BATCH_SIZE,
      attributes: ["id", "companyId", "companyServiceId", "professionalId"]
    });

    let expiredCount = 0;
    for (const row of pendingBookings) {
      const expired = await expireSinglePendingPaymentBooking(Number(row.id));
      if (!expired) {
        continue;
      }
      expiredCount += 1;

      logger.info(
        {
          event: expired.pixTxId ? "scheduling_pix_payment_expired" : "scheduling_payment_expired",
          companyId: expired.companyId,
          bookingId: expired.id,
          serviceId: expired.companyServiceId,
          professionalId: expired.professionalId,
          paymentReference: expired.paymentReference || null,
          pixTxId: expired.pixTxId || null,
          paymentStatus: expired.paymentStatus
        },
        "Pending payment booking expired"
      );

      await finalizeActiveSchedulingSessionsAfterExpiration(expired);
      await notifyPaymentExpired(expired);
    }

    logger.info(
      {
        event: "scheduling_payment_expiration_cleanup",
        scannedRows: pendingBookings.length,
        expiredRows: expiredCount,
        durationMs: Date.now() - startedAt
      },
      "Service booking payment expiration cleanup executed"
    );
  } catch (error) {
    logger.error(
      {
        event: "scheduling_payment_expiration_cleanup_error",
        durationMs: Date.now() - startedAt,
        error
      },
      "Failed to cleanup expired pending payments"
    );
  }
};

export const startServiceBookingPaymentExpirationJob = (): void => {
  if (expirationTask) {
    return;
  }

  expirationTask = cron.schedule(
    "*/1 * * * *",
    runServiceBookingPaymentExpirationCleanup
  );

  logger.info(
    {
      event: "scheduling_payment_expiration_cleanup_started",
      cron: "*/1 * * * *"
    },
    "Service booking payment expiration job initialized"
  );
};

export const stopServiceBookingPaymentExpirationJob = (): void => {
  if (!expirationTask) {
    return;
  }

  expirationTask.stop();
  expirationTask = null;

  logger.info(
    { event: "scheduling_payment_expiration_cleanup_stopped" },
    "Service booking payment expiration job stopped"
  );
};
