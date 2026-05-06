import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../errors/AppError";
import AssertCompanyFeatureEnabledService from "../services/CompanyFeatureService/AssertCompanyFeatureEnabledService";
import {
  getSchedulingPaymentSettings,
  updateSchedulingPaymentSettings
} from "../services/SchedulingServices/ServiceSchedulingPaymentSettingsService";
import CancelService from "../services/ServiceBookingServices/CancelService";
import ConfirmPaymentService from "../services/ServiceBookingServices/ConfirmPaymentService";
import ListService from "../services/ServiceBookingServices/ListService";
import ListSlotsService from "../services/ServiceBookingServices/ListSlotsService";
import ProcessServiceBookingPaymentWebhookService from "../services/ServiceBookingServices/ProcessServiceBookingPaymentWebhookService";
import RegeneratePixPaymentService from "../services/ServiceBookingServices/RegeneratePixPaymentService";

type IndexQuery = {
  pageNumber?: string;
  status?: string;
  paymentStatus?: string;
  searchParam?: string;
  companyServiceId?: string;
  professionalId?: string;
  contactId?: string;
  whatsappId?: string;
  startDate?: string;
  endDate?: string;
};

type SlotQuery = {
  fromDate?: string;
  days?: string;
  professionalId?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    paymentStatus,
    searchParam,
    companyServiceId,
    professionalId,
    contactId,
    whatsappId,
    startDate,
    endDate
  } = req.query as IndexQuery;

  const { companyId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });

  const { bookings, count, hasMore } = await ListService({
    companyId,
    pageNumber,
    status,
    paymentStatus,
    searchParam,
    companyServiceId,
    professionalId,
    contactId,
    whatsappId,
    startDate,
    endDate
  });

  return res.json({ bookings, count, hasMore });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  if (!["admin", "super"].includes(String(req.user.profile || ""))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { bookingId } = req.params;
  const { companyId, id: userId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });
  const { reason } = req.body || {};

  const booking = await CancelService({
    bookingId,
    companyId,
    cancelledByUserId: userId,
    cancelReason: reason
  });

  return res.status(200).json(booking);
};

export const slots = async (req: Request, res: Response): Promise<Response> => {
  const { serviceId } = req.params;
  const { fromDate, days, professionalId } = req.query as SlotQuery;
  const { companyId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });

  const response = await ListSlotsService({
    companyId,
    companyServiceId: serviceId,
    fromDate,
    days,
    professionalId
  });

  return res.status(200).json(response);
};

export const getPaymentSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!["admin", "super"].includes(String(req.user.profile || ""))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { companyId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });
  const settings = await getSchedulingPaymentSettings(companyId);
  return res.status(200).json(settings);
};

export const updatePaymentSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!["admin", "super"].includes(String(req.user.profile || ""))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { companyId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });
  const schema = Yup.object().shape({
    paymentMode: Yup.string().oneOf(["disabled", "optional", "required"]).required(),
    depositType: Yup.string().oneOf(["fixed", "percentage"]).required(),
    depositValue: Yup.number().min(0).required(),
    paymentHoldMinutes: Yup.number().integer().min(1).max(1440).notRequired(),
    paymentInstructions: Yup.string().max(2000).notRequired(),
    pixEnabled: Yup.boolean().notRequired(),
    pixKey: Yup.string().max(255).notRequired(),
    pixKeyType: Yup.string()
      .oneOf(["cpf", "cnpj", "email", "phone", "random"])
      .notRequired(),
    pixRecipientName: Yup.string().max(80).notRequired(),
    pixCity: Yup.string().max(80).notRequired(),
    pixSendMode: Yup.string().oneOf(["copy_paste", "instructions", "both"]).notRequired()
  });

  try {
    await schema.validate(req.body || {});
  } catch (error: any) {
    throw new AppError(error?.message || "ERR_INVALID_INPUT", 400);
  }

  const settings = await updateSchedulingPaymentSettings({
    companyId,
    paymentMode: req.body.paymentMode,
    depositType: req.body.depositType,
    depositValue: req.body.depositValue,
    paymentHoldMinutes: req.body.paymentHoldMinutes,
    paymentInstructions: req.body.paymentInstructions,
    pixEnabled: req.body.pixEnabled,
    pixKey: req.body.pixKey,
    pixKeyType: req.body.pixKeyType,
    pixRecipientName: req.body.pixRecipientName,
    pixCity: req.body.pixCity,
    pixSendMode: req.body.pixSendMode
  });

  return res.status(200).json(settings);
};

export const confirmPayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!["admin", "super"].includes(String(req.user.profile || ""))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { bookingId } = req.params;
  const { companyId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });
  const { paymentReference, pixTxId } = req.body || {};

  const result = await ConfirmPaymentService({
    companyId,
    bookingId,
    paymentReference,
    pixTxId,
    source: "manual"
  });

  return res.status(200).json(result);
};

export const webhookConfirmPayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const providerWebhookResult = await ProcessServiceBookingPaymentWebhookService({
    payload: req.body
  });

  if (providerWebhookResult.detected) {
    return res.status(200).json({
      ok: true,
      provider: providerWebhookResult.provider,
      received: providerWebhookResult.received,
      processed: providerWebhookResult.processed,
      duplicates: providerWebhookResult.duplicates,
      ignored: providerWebhookResult.ignored,
      errors: providerWebhookResult.errors,
      ignoredReasons: providerWebhookResult.ignoredReasons
    });
  }

  const webhookToken = String(process.env.SERVICE_BOOKING_PAYMENT_WEBHOOK_TOKEN || "");
  const requestToken = String(req.body?.token || "");

  if (webhookToken && webhookToken !== requestToken) {
    throw new AppError("ERR_INVALID_WEBHOOK_TOKEN", 401);
  }

  const companyId = Number(req.body?.companyId);
  const bookingId = req.body?.bookingId ? Number(req.body.bookingId) : null;
  const paymentReference = req.body?.paymentReference
    ? String(req.body.paymentReference)
    : null;
  const pixTxId = req.body?.pixTxId ? String(req.body.pixTxId) : null;
  const status = String(req.body?.status || "")
    .trim()
    .toLowerCase();

  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new AppError("ERR_INVALID_COMPANY", 400);
  }

  if (
    req.body?.bookingId !== undefined &&
    req.body?.bookingId !== null &&
    (!Number.isInteger(bookingId) || Number(bookingId) <= 0)
  ) {
    throw new AppError("ERR_INVALID_BOOKING", 400);
  }

  if (!bookingId && !paymentReference && !pixTxId) {
    throw new AppError("ERR_INVALID_PAYMENT_IDENTIFIER", 400);
  }

  if (status !== "paid" && status !== "approved" && status !== "confirmed") {
    return res.status(200).json({
      ok: true,
      ignored: true,
      reason: "status_not_paid"
    });
  }

  const result = await ConfirmPaymentService({
    companyId,
    bookingId: bookingId || undefined,
    paymentReference,
    pixTxId,
    source: "webhook"
  });

  return res.status(200).json({
    ok: true,
    ignored: false,
    alreadyProcessed: result.alreadyProcessed,
    booking: result.booking
  });
};

export const regeneratePixPayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!["admin", "super"].includes(String(req.user.profile || ""))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { companyId } = req.user;
  await AssertCompanyFeatureEnabledService({
    companyId,
    feature: "scheduling"
  });
  const { bookingId } = req.params;

  const booking = await RegeneratePixPaymentService({
    companyId,
    bookingId
  });

  return res.status(200).json({
    ok: true,
    booking
  });
};
