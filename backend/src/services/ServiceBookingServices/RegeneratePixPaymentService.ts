import AppError from "../../errors/AppError";
import ServiceBooking from "../../models/ServiceBooking";
import SendBookingPixInstructionsService from "./SendBookingPixInstructionsService";

type RegeneratePixPaymentInput = {
  companyId: number;
  bookingId: number | string;
};

const RegeneratePixPaymentService = async ({
  companyId,
  bookingId
}: RegeneratePixPaymentInput): Promise<ServiceBooking> => {
  const booking = await ServiceBooking.findOne({
    where: {
      id: Number(bookingId),
      companyId
    }
  });

  if (!booking) {
    throw new AppError("ERR_SERVICE_BOOKING_NOT_FOUND", 404);
  }

  if (
    String(booking.status || "").toLowerCase() !== "pending_payment" ||
    String(booking.paymentStatus || "").toLowerCase() !== "pending"
  ) {
    throw new AppError("ERR_BOOKING_NOT_PENDING_PAYMENT", 409);
  }

  if (booking.paymentDueAt && new Date(booking.paymentDueAt).getTime() < Date.now()) {
    throw new AppError("ERR_PAYMENT_EXPIRED", 409);
  }

  const result = await SendBookingPixInstructionsService({
    companyId,
    booking,
    forceRegeneration: true,
    reason: "admin_regeneration"
  });

  if (!result.sent) {
    throw new AppError("ERR_PIX_CONFIGURATION_INVALID", 409);
  }

  await booking.reload();
  return booking;
};

export default RegeneratePixPaymentService;

