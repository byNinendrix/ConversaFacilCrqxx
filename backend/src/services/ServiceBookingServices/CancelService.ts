import AppError from "../../errors/AppError";
import ServiceBooking from "../../models/ServiceBooking";
import ServiceSchedulingSession from "../../models/ServiceSchedulingSession";
import { logger } from "../../utils/logger";

interface Request {
  bookingId: number | string;
  companyId: number;
  cancelledByUserId?: number | string;
  cancelReason?: string;
}

const CancelService = async ({
  bookingId,
  companyId,
  cancelledByUserId,
  cancelReason
}: Request): Promise<ServiceBooking> => {
  const booking = await ServiceBooking.findOne({
    where: {
      id: bookingId,
      companyId
    }
  });

  if (!booking) {
    throw new AppError("ERR_SERVICE_BOOKING_NOT_FOUND", 404);
  }

  if (String(booking.status) === "cancelled") {
    return booking;
  }

  const contextJson =
    booking.contextJson && typeof booking.contextJson === "object"
      ? booking.contextJson
      : {};

  const cancellationHistory = Array.isArray(contextJson.cancellations)
    ? contextJson.cancellations
    : [];

  cancellationHistory.push({
    at: new Date().toISOString(),
    userId: cancelledByUserId ? Number(cancelledByUserId) : null,
    reason: cancelReason || null
  });

  contextJson.cancellations = cancellationHistory.slice(-20);

  await booking.update({
    status: "cancelled",
    paymentStatus:
      String(booking.paymentStatus || "") === "pending" ? "failed" : booking.paymentStatus,
    activeSlotStartAt: null,
    activeSlotResourceKey: null,
    cancelledAt: new Date(),
    contextJson,
    notes: cancelReason ? String(cancelReason).trim() : booking.notes
  });

  if (booking.ticketId && booking.whatsappId) {
    const activeSessions = await ServiceSchedulingSession.findAll({
      where: {
        companyId: booking.companyId,
        whatsappId: booking.whatsappId,
        ticketId: booking.ticketId,
        status: "active"
      }
    });

    const nowIso = new Date().toISOString();

    for (const session of activeSessions) {
      const contextJson =
        session.contextJson && typeof session.contextJson === "object"
          ? session.contextJson
          : {};
      const history = Array.isArray(contextJson.history) ? contextJson.history : [];
      history.push({
        at: nowIso,
        event: "session_cancelled_after_booking_cancelled",
        payload: {
          bookingId: booking.id,
          cancelledByUserId: cancelledByUserId ? Number(cancelledByUserId) : null,
          cancelReason: cancelReason || null
        }
      });

      await session.update({
        status: "cancelled",
        currentStep: "cancelled",
        lastInteractionAt: new Date(),
        expiresAt: null,
        contextJson: {
          ...contextJson,
          history: history.slice(-100)
        }
      });
    }

    if (activeSessions.length > 0) {
      logger.info(
        {
          event: "scheduling_sessions_finalized_after_booking_cancelled",
          companyId: booking.companyId,
          bookingId: booking.id,
          ticketId: booking.ticketId,
          whatsappId: booking.whatsappId,
          sessionCount: activeSessions.length
        },
        "Active scheduling sessions finalized after booking cancellation"
      );
    }
  }

  return booking;
};

export default CancelService;
