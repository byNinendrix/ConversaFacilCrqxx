import express from "express";

import isAuth from "../middleware/isAuth";
import * as ServiceBookingController from "../controllers/ServiceBookingController";

const serviceBookingRoutes = express.Router();

serviceBookingRoutes.get("/service-bookings", isAuth, ServiceBookingController.index);
serviceBookingRoutes.get(
  "/service-bookings/payment-settings",
  isAuth,
  ServiceBookingController.getPaymentSettings
);
serviceBookingRoutes.put(
  "/service-bookings/payment-settings",
  isAuth,
  ServiceBookingController.updatePaymentSettings
);
serviceBookingRoutes.post(
  "/service-bookings/:bookingId/payment/confirm",
  isAuth,
  ServiceBookingController.confirmPayment
);
serviceBookingRoutes.post(
  "/service-bookings/:bookingId/payment/regenerate-pix",
  isAuth,
  ServiceBookingController.regeneratePixPayment
);
serviceBookingRoutes.post(
  "/service-bookings/payment/webhook",
  ServiceBookingController.webhookConfirmPayment
);
serviceBookingRoutes.patch(
  "/service-bookings/:bookingId/cancel",
  isAuth,
  ServiceBookingController.cancel
);
serviceBookingRoutes.get(
  "/company-services/:serviceId/slots",
  isAuth,
  ServiceBookingController.slots
);

export default serviceBookingRoutes;
