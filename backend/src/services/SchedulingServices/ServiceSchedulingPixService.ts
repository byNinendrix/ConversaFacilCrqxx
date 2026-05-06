import moment from "moment";

import AppError from "../../errors/AppError";
import ServiceBooking from "../../models/ServiceBooking";
import { logger } from "../../utils/logger";
import {
  SchedulingPixKeyType,
  SchedulingPixSendMode,
  SchedulingPixSettings
} from "./ServiceSchedulingPaymentSettingsService";

type EnsurePixPayloadInput = {
  booking: ServiceBooking;
  pixSettings: SchedulingPixSettings;
  expiresAt?: Date | null;
  forceRegeneration?: boolean;
  transaction?: any;
};

type EnsurePixPayloadOutput = {
  paymentReference: string;
  pixTxId: string;
  pixPayload: string;
  pixExpiresAt: Date | null;
  regenerated: boolean;
};

type BuildPixMessageBlocksInput = {
  booking: ServiceBooking;
  pixSettings: SchedulingPixSettings;
  customInstructions?: string;
  optionalPayment?: boolean;
  detectionMode?: "provider" | "manual";
};

const PIX_GUI = "br.gov.bcb.pix";
const PIX_COUNTRY_CODE = "BR";
const PIX_CURRENCY_CODE = "986";
const PIX_MERCHANT_CATEGORY_CODE = "0000";

const asPixAscii = (value: any, maxLength: number): string => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 \-./]/g, "")
    .trim()
    .toUpperCase();

  return normalized.slice(0, maxLength);
};

const formatCurrency = (value: number): string =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const formatAmountForPix = (value: number): string => Number(value || 0).toFixed(2);

const encodeTlvField = (id: string, value: string): string => {
  const length = String(value.length).padStart(2, "0");
  return `${id}${length}${value}`;
};

const computeCrc16 = (payload: string): string => {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      const carry = crc & 0x8000;
      crc = (crc << 1) & 0xffff;
      if (carry) {
        crc ^= 0x1021;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const sanitizeTxId = (value: string): string => {
  const normalized = String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (!normalized) {
    return "BOOKINGPIXTXID";
  }

  if (normalized.length >= 5) {
    return normalized.slice(0, 25);
  }

  return `${normalized}BOOKINGTXID`.slice(0, 25);
};

export const buildPixTxId = (
  booking: ServiceBooking,
  paymentReference: string
): string => {
  const base = paymentReference || `SB${booking.companyId}${booking.id}`;
  return sanitizeTxId(base);
};

const buildDescription = (paymentReference: string): string => {
  const normalized = asPixAscii(`AGENDAMENTO ${paymentReference}`, 72);
  return normalized || "AGENDAMENTO";
};

export const buildPixCopyPastePayload = ({
  amount,
  pixKey,
  recipientName,
  city,
  txId,
  paymentReference
}: {
  amount: number;
  pixKey: string;
  recipientName: string;
  city: string;
  txId: string;
  paymentReference: string;
}): string => {
  const merchantAccountInfo = [
    encodeTlvField("00", PIX_GUI),
    encodeTlvField("01", String(pixKey || "").trim()),
    encodeTlvField("02", buildDescription(paymentReference))
  ].join("");

  const additionalDataField = encodeTlvField("05", txId);

  const payloadWithoutCrc = [
    encodeTlvField("00", "01"),
    encodeTlvField("26", merchantAccountInfo),
    encodeTlvField("52", PIX_MERCHANT_CATEGORY_CODE),
    encodeTlvField("53", PIX_CURRENCY_CODE),
    encodeTlvField("54", formatAmountForPix(amount)),
    encodeTlvField("58", PIX_COUNTRY_CODE),
    encodeTlvField("59", asPixAscii(recipientName, 25) || "RECEBEDOR PIX"),
    encodeTlvField("60", asPixAscii(city, 15) || "CIDADE"),
    encodeTlvField("62", additionalDataField),
    "6304"
  ].join("");

  return `${payloadWithoutCrc}${computeCrc16(payloadWithoutCrc)}`;
};

export const resolvePaymentReference = (booking: ServiceBooking): string => {
  const currentReference = String(booking.paymentReference || "").trim();
  if (currentReference) {
    return currentReference;
  }

  return `SB-${booking.companyId}-${booking.id}`;
};

const keyTypeLabel = (keyType: SchedulingPixKeyType): string => {
  if (keyType === "cpf") return "CPF";
  if (keyType === "cnpj") return "CNPJ";
  if (keyType === "email") return "E-mail";
  if (keyType === "phone") return "Telefone";
  return "Aleatoria";
};

const appendPixHistory = (
  booking: ServiceBooking,
  action: string,
  details: Record<string, any> = {}
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
    action,
    ...details
  });

  contextJson.paymentHistory = paymentHistory.slice(-30);

  const paymentContext =
    contextJson.payment && typeof contextJson.payment === "object"
      ? contextJson.payment
      : {};

  paymentContext.pix = {
    ...(paymentContext.pix || {}),
    enabled: true
  };

  contextJson.payment = paymentContext;
  return contextJson;
};

export const ensurePixPayloadForBooking = async ({
  booking,
  pixSettings,
  expiresAt,
  forceRegeneration = false,
  transaction
}: EnsurePixPayloadInput): Promise<EnsurePixPayloadOutput> => {
  const startedAt = Date.now();

  if (!pixSettings.enabled) {
    throw new AppError("ERR_PIX_NOT_ENABLED", 400);
  }

  if (!pixSettings.key || !pixSettings.recipientName || !pixSettings.city) {
    throw new AppError("ERR_PIX_CONFIGURATION_INVALID", 400);
  }

  const depositAmount = Number(booking.depositAmount || 0);
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    throw new AppError("ERR_INVALID_PIX_AMOUNT", 400);
  }

  const reference = resolvePaymentReference(booking);
  const resolvedTxId = String(booking.pixTxId || "").trim() || buildPixTxId(booking, reference);
  const resolvedExpiresAt = expiresAt || booking.paymentDueAt || booking.pixExpiresAt || null;

  const currentPayload = String(booking.pixPayload || "").trim();
  const currentTxId = String(booking.pixTxId || "").trim();
  const currentExpiresAt = booking.pixExpiresAt ? new Date(booking.pixExpiresAt) : null;

  const canReuseExistingPayload =
    !forceRegeneration &&
    Boolean(currentPayload) &&
    Boolean(currentTxId) &&
    (!currentExpiresAt || currentExpiresAt.getTime() >= Date.now());

  if (canReuseExistingPayload) {
    return {
      paymentReference: reference,
      pixTxId: currentTxId,
      pixPayload: currentPayload,
      pixExpiresAt: currentExpiresAt,
      regenerated: false
    };
  }

  const pixPayload = buildPixCopyPastePayload({
    amount: depositAmount,
    pixKey: pixSettings.key,
    recipientName: pixSettings.recipientName,
    city: pixSettings.city,
    txId: resolvedTxId,
    paymentReference: reference
  });

  const nextContextJson = appendPixHistory(booking, "pix_payload_generated", {
    paymentReference: reference,
    pixTxId: resolvedTxId
  });

  const payload = {
    paymentReference: reference,
    pixPayload,
    pixTxId: resolvedTxId,
    pixExpiresAt: resolvedExpiresAt,
    contextJson: nextContextJson
  };

  await booking.update(payload, { transaction });

  logger.info(
    {
      event: "scheduling_pix_payload_generated",
      companyId: booking.companyId,
      bookingId: booking.id,
      serviceId: booking.companyServiceId,
      professionalId: booking.professionalId,
      paymentReference: reference,
      pixTxId: resolvedTxId,
      durationMs: Date.now() - startedAt
    },
    "PIX payload generated"
  );

  return {
    paymentReference: reference,
    pixTxId: resolvedTxId,
    pixPayload,
    pixExpiresAt: resolvedExpiresAt,
    regenerated: true
  };
};

export const buildPixPaymentMessageBlocks = ({
  booking,
  pixSettings,
  customInstructions = "",
  optionalPayment = false,
  detectionMode = "manual"
}: BuildPixMessageBlocksInput): string[] => {
  const payload = String(booking.pixPayload || "").trim();
  const reference = String(booking.paymentReference || "").trim();
  const pixTxId = String(booking.pixTxId || "").trim();
  const amount = Number(booking.depositAmount || 0);
  const dueAt =
    booking.pixExpiresAt || booking.paymentDueAt
      ? moment(booking.pixExpiresAt || booking.paymentDueAt).format("DD/MM/YYYY HH:mm")
      : null;

  const header = optionalPayment
    ? "Pagamento via PIX (opcional):"
    : "Pagamento PIX do agendamento:";

  const summaryLines: string[] = [header];
  summaryLines.push(`Valor: *${formatCurrency(amount)}*`);

  if (dueAt) {
    summaryLines.push(`Prazo: *${dueAt}*`);
  }

  if (reference) {
    summaryLines.push(`Referencia: *${reference}*`);
  }

  if (pixTxId) {
    summaryLines.push(`PIX txid: *${pixTxId}*`);
  }

  if (detectionMode === "provider") {
    summaryLines.push(
      "Confirmacao automatica: apos o pagamento ser processado pelo PSP, o agendamento e confirmado automaticamente."
    );
  } else {
    summaryLines.push(
      "Confirmacao manual: apos o pagamento, envie o comprovante para validacao da equipe."
    );
  }

  if (pixSettings.sendMode === "instructions" || pixSettings.sendMode === "both") {
    summaryLines.push(
      `Chave PIX (${keyTypeLabel(pixSettings.keyType)}): *${pixSettings.key}*`
    );
    summaryLines.push(`Favorecido: *${pixSettings.recipientName}*`);
    summaryLines.push(`Cidade: *${pixSettings.city}*`);
  } else {
    summaryLines.push("Use o codigo PIX copia e cola enviado na proxima mensagem.");
  }

  const normalizedInstructions = String(customInstructions || "").trim();
  if (normalizedInstructions) {
    summaryLines.push(`Instrucoes: ${normalizedInstructions}`);
  }

  const messages = [summaryLines.join("\n")];

  if (
    (pixSettings.sendMode === "copy_paste" || pixSettings.sendMode === "both") &&
    payload
  ) {
    messages.push(`PIX Copia e Cola:\n${payload}`);
  }

  return messages;
};

export const isPixConfigurationReady = (pixSettings: SchedulingPixSettings): boolean =>
  Boolean(
    pixSettings.enabled &&
      String(pixSettings.key || "").trim() &&
      String(pixSettings.recipientName || "").trim() &&
      String(pixSettings.city || "").trim()
  );

export const isPixPendingPaymentBooking = (booking: ServiceBooking): boolean =>
  String(booking.paymentStatus || "").toLowerCase() === "pending" &&
  Number(booking.depositAmount || 0) > 0;

export const isSendModeWithCopyPaste = (sendMode: SchedulingPixSendMode): boolean =>
  sendMode === "copy_paste" || sendMode === "both";
