import fs from "fs";

import Gerencianet from "gn-api-sdk-typescript";

import options from "../../config/Gn";
import ServiceBooking from "../../models/ServiceBooking";
import { logger } from "../../utils/logger";
import {
  SchedulingPixSettings
} from "./ServiceSchedulingPaymentSettingsService";
import {
  buildPixCopyPastePayload,
  buildPixTxId,
  ensurePixPayloadForBooking,
  resolvePaymentReference
} from "./ServiceSchedulingPixService";

export type PixProviderName = "gerencianet" | "manual";
export type PixDetectionMode = "provider" | "manual";

export type CreatePixChargeInput = {
  booking: ServiceBooking;
  pixSettings: SchedulingPixSettings;
  amount: number;
  customerName?: string;
  expiresAt?: Date | null;
  forceRegeneration?: boolean;
};

export type CreatePixChargeResult = {
  provider: PixProviderName;
  detectionMode: PixDetectionMode;
  txId: string;
  payload: string;
  expiresAt: Date | null;
  locationId?: string | null;
  qrCode?: string | null;
  raw?: any;
  regenerated: boolean;
  fallbackUsed: boolean;
};

export type PixChargeStatusResult = {
  provider: PixProviderName;
  txId: string;
  status: "paid" | "pending" | "expired" | "unknown";
  raw?: any;
};

export type PaymentWebhookEvent = {
  provider: PixProviderName;
  pixTxId: string;
  companyId: number | null;
  status: "paid" | "pending" | "unknown";
  paidAt: Date | null;
  raw: any;
};

export type MapWebhookResult = {
  provider: PixProviderName;
  detected: boolean;
  events: PaymentWebhookEvent[];
};

type ProviderErrorCategory =
  | "config_invalid"
  | "auth_invalid"
  | "payload_invalid"
  | "transient_timeout"
  | "transient_network"
  | "provider_unavailable"
  | "provider_rate_limited"
  | "unknown";

type ProviderErrorDetails = {
  category: ProviderErrorCategory;
  retryable: boolean;
  statusCode: number | null;
  errorCode: string | null;
  message: string;
  operation: string | null;
};

type ProviderConfigDiagnostics = {
  valid: boolean;
  sandbox: boolean;
  certPath: string;
  certExists: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  missing: string[];
};

type GerencianetClient = {
  pixCreateImmediateCharge(params: any, body: any): Promise<any>;
  pixGenerateQRCode(params: any): Promise<any>;
  pixDetailCharge(params: any): Promise<any>;
};

type GerencianetClientFactory = () => GerencianetClient;

interface PaymentProviderStrategy {
  readonly name: PixProviderName;
  createPixCharge(input: CreatePixChargeInput): Promise<CreatePixChargeResult>;
  getPixChargeStatus(args: { txId: string }): Promise<PixChargeStatusResult>;
  mapWebhookToInternalEvent(payload: any): Promise<MapWebhookResult>;
}

const defaultGerencianetClientFactory = (): GerencianetClient =>
  Gerencianet(options as any) as unknown as GerencianetClient;

let gerencianetClientFactory: GerencianetClientFactory = defaultGerencianetClientFactory;

export const __setGerencianetClientFactoryForTests = (
  factory?: GerencianetClientFactory | null
): void => {
  gerencianetClientFactory = factory || defaultGerencianetClientFactory;
};

const resolveActiveProvider = (): PixProviderName => {
  const fromEnv = String(process.env.SERVICE_BOOKING_PIX_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (fromEnv === "manual") return "manual";
  return "gerencianet";
};

const parsePositiveIntEnv = (
  key: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const raw = Number(process.env[key]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
};

const getProviderRequestTimeoutMs = (): number =>
  parsePositiveIntEnv("SERVICE_BOOKING_PIX_PROVIDER_TIMEOUT_MS", 10000, 1000, 60000);

const getProviderMaxAttempts = (): number =>
  parsePositiveIntEnv("SERVICE_BOOKING_PIX_PROVIDER_MAX_ATTEMPTS", 3, 1, 6);

const getProviderRetryBackoffMs = (): number =>
  parsePositiveIntEnv("SERVICE_BOOKING_PIX_PROVIDER_RETRY_BACKOFF_MS", 400, 50, 5000);

const sanitizeTxId = (value: string): string => {
  const normalized = String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!normalized) {
    return "SB1B1PIXTXID0001";
  }
  if (normalized.length >= 5) {
    return normalized.slice(0, 25);
  }
  return `${normalized}BOOKINGPIXTXID`.slice(0, 25);
};

const buildGerencianetTxId = (booking: ServiceBooking, paymentReference: string): string => {
  const currentTxId = String(booking.pixTxId || "").trim();
  if (currentTxId) {
    return sanitizeTxId(currentTxId);
  }

  const base = `SB${Number(booking.companyId)}B${Number(booking.id)}`;
  const suffix = Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const txId = `${base}${suffix}`.slice(0, 25);

  if (txId.length >= 5) {
    return txId;
  }

  return sanitizeTxId(buildPixTxId(booking, paymentReference));
};

const parseCompanyIdFromTxId = (txId: string): number | null => {
  const normalized = String(txId || "").trim().toUpperCase();
  const match = normalized.match(/^SB(\d{1,10})B/);
  if (!match) {
    return null;
  }

  const companyId = Number(match[1]);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  return companyId;
};

const toPixExpirationSeconds = (expiresAt?: Date | null): number => {
  if (!expiresAt) return 3600;
  const deltaSeconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  if (deltaSeconds <= 60) return 60;
  if (deltaSeconds >= 24 * 60 * 60) return 24 * 60 * 60;
  return deltaSeconds;
};

const getGerencianetClient = (): GerencianetClient => gerencianetClientFactory();

const createProviderTimeoutError = (operation: string, timeoutMs: number): Error => {
  const error = new Error(`Provider operation '${operation}' timed out after ${timeoutMs}ms`);
  (error as any).name = "ProviderTimeoutError";
  (error as any).code = "PROVIDER_TIMEOUT";
  (error as any).operation = operation;
  return error;
};

const withProviderTimeout = async <T>({
  operation,
  timeoutMs,
  task
}: {
  operation: string;
  timeoutMs: number;
  task: () => Promise<T>;
}): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(createProviderTimeoutError(operation, timeoutMs));
      }, timeoutMs);
    });

    return await Promise.race([task(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const asString = (value: any): string => String(value || "").trim();

const extractStatusCode = (error: any): number | null => {
  const candidates = [
    error?.response?.status,
    error?.response?.statusCode,
    error?.statusCode,
    error?.status
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) {
      return parsed;
    }
  }

  return null;
};

const extractErrorCode = (error: any): string | null => {
  const value =
    error?.response?.data?.code ||
    error?.response?.data?.codigo ||
    error?.code ||
    error?.errorCode ||
    null;
  return value ? String(value).trim().toUpperCase() : null;
};

const extractErrorMessage = (error: any): string => {
  const candidates = [
    error?.response?.data?.mensagem,
    error?.response?.data?.message,
    error?.errorDescription,
    error?.message,
    error?.response?.statusText
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);

  if (candidates.length) {
    return candidates.join(" | ");
  }

  return "Unknown provider error";
};

const containsAny = (message: string, terms: string[]): boolean =>
  terms.some(term => message.includes(term));

const classifyProviderError = (error: any): ProviderErrorDetails => {
  const statusCode = extractStatusCode(error);
  const errorCode = extractErrorCode(error);
  const message = extractErrorMessage(error);
  const normalizedMessage = message.toLowerCase();
  const operation = asString(error?.operation || error?.response?.data?.operacao) || null;

  if ((errorCode || "").toUpperCase() === "PROVIDER_TIMEOUT" || error?.name === "ProviderTimeoutError") {
    return {
      category: "transient_timeout",
      retryable: true,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  const networkCodes = [
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNABORTED",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED"
  ];

  if (errorCode && networkCodes.includes(errorCode)) {
    return {
      category: "transient_network",
      retryable: true,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  if (containsAny(normalizedMessage, ["timeout", "timed out", "socket hang up", "network"])) {
    return {
      category: "transient_network",
      retryable: true,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  if (statusCode === 429) {
    return {
      category: "provider_rate_limited",
      retryable: true,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  if (statusCode === 408 || (statusCode !== null && statusCode >= 500)) {
    return {
      category: "provider_unavailable",
      retryable: true,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      category: "auth_invalid",
      retryable: false,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  if (
    containsAny(normalizedMessage, [
      "cert",
      "certificado",
      "client_id",
      "client_secret",
      "credencial",
      "credenciais"
    ])
  ) {
    return {
      category: "config_invalid",
      retryable: false,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  if (statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 422) {
    return {
      category: "payload_invalid",
      retryable: false,
      statusCode,
      errorCode,
      message,
      operation
    };
  }

  return {
    category: "unknown",
    retryable: true,
    statusCode,
    errorCode,
    message,
    operation
  };
};

const isChargeAlreadyExistsError = (
  details: ProviderErrorDetails,
  txId: string
): boolean => {
  if (details.statusCode !== 409) {
    return false;
  }

  const normalizedMessage = String(details.message || "").toLowerCase();
  const txidInMessage = txId ? normalizedMessage.includes(txId.toLowerCase()) : false;

  return containsAny(normalizedMessage, ["txid", "cob", "duplic", "ja existe", "already exists"]) || txidInMessage;
};

const sleep = (delayMs: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });

const getProviderConfigDiagnostics = (): ProviderConfigDiagnostics => {
  const clientIdConfigured = Boolean(asString((options as any)?.client_id));
  const clientSecretConfigured = Boolean(asString((options as any)?.client_secret));
  const certPath = asString((options as any)?.pix_cert);
  const certExists = Boolean(certPath) && fs.existsSync(certPath);
  const sandbox = Boolean((options as any)?.sandbox);

  const missing: string[] = [];
  if (!clientIdConfigured) missing.push("GERENCIANET_CLIENT_ID");
  if (!clientSecretConfigured) missing.push("GERENCIANET_CLIENT_SECRET");
  if (!certPath) missing.push("GERENCIANET_PIX_CERT");
  if (certPath && !certExists) missing.push("GERENCIANET_PIX_CERT_FILE_NOT_FOUND");

  return {
    valid: missing.length === 0,
    sandbox,
    certPath,
    certExists,
    clientIdConfigured,
    clientSecretConfigured,
    missing
  };
};

class ManualPixProviderStrategy implements PaymentProviderStrategy {
  public readonly name: PixProviderName = "manual";

  public async createPixCharge(input: CreatePixChargeInput): Promise<CreatePixChargeResult> {
    const ensured = await ensurePixPayloadForBooking({
      booking: input.booking,
      pixSettings: input.pixSettings,
      expiresAt: input.expiresAt || null,
      forceRegeneration: Boolean(input.forceRegeneration)
    });

    return {
      provider: "manual",
      detectionMode: "manual",
      txId: ensured.pixTxId,
      payload: ensured.pixPayload,
      expiresAt: ensured.pixExpiresAt || null,
      locationId: null,
      qrCode: null,
      regenerated: ensured.regenerated,
      fallbackUsed: false
    };
  }

  public async getPixChargeStatus({
    txId
  }: {
    txId: string;
  }): Promise<PixChargeStatusResult> {
    return {
      provider: "manual",
      txId,
      status: "unknown"
    };
  }

  public async mapWebhookToInternalEvent(payload: any): Promise<MapWebhookResult> {
    return {
      provider: "manual",
      detected: false,
      events: []
    };
  }
}

class GerencianetPixProviderStrategy implements PaymentProviderStrategy {
  public readonly name: PixProviderName = "gerencianet";

  public async createPixCharge(input: CreatePixChargeInput): Promise<CreatePixChargeResult> {
    const paymentReference = resolvePaymentReference(input.booking);
    const txId = buildGerencianetTxId(input.booking, paymentReference);
    const expirationSeconds = toPixExpirationSeconds(input.expiresAt || null);
    const amount = Number(input.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("PIX provider payload invalid: amount must be greater than zero");
    }

    if (!asString(input.pixSettings?.key)) {
      throw new Error("PIX provider payload invalid: pix key is required");
    }

    const requestTimeoutMs = getProviderRequestTimeoutMs();
    const gerencianet = getGerencianetClient();

    const params = { txid: txId };
    const body = {
      calendario: {
        expiracao: expirationSeconds
      },
      valor: {
        original: amount.toFixed(2)
      },
      chave: input.pixSettings.key,
      solicitacaoPagador: String(
        `Reserva ${paymentReference} - ${input.customerName || "Cliente"}`
      )
        .trim()
        .slice(0, 140)
    };

    let pix: any;
    try {
      pix = await withProviderTimeout({
        operation: "pixCreateImmediateCharge",
        timeoutMs: requestTimeoutMs,
        task: () => gerencianet.pixCreateImmediateCharge(params, body)
      });
    } catch (error) {
      const details = classifyProviderError(error);
      if (isChargeAlreadyExistsError(details, txId)) {
        logger.warn(
          {
            event: "pix_charge_create_conflict_recovered",
            provider: "gerencianet",
            companyId: input.booking.companyId,
            bookingId: input.booking.id,
            paymentReference,
            txId,
            errorCategory: details.category,
            statusCode: details.statusCode,
            errorCode: details.errorCode,
            message: details.message
          },
          "Gerencianet charge already existed for txid; reusing existing charge"
        );

        pix = await withProviderTimeout({
          operation: "pixDetailCharge",
          timeoutMs: requestTimeoutMs,
          task: () => gerencianet.pixDetailCharge({ txid: txId })
        });
      } else {
        throw error;
      }
    }

    let qrCodePayload = "";
    let qrCodeImage: string | null = null;
    const locationId = pix?.loc?.id ? String(pix.loc.id) : null;

    if (locationId) {
      try {
        const qrcode = await withProviderTimeout({
          operation: "pixGenerateQRCode",
          timeoutMs: requestTimeoutMs,
          task: () =>
            gerencianet.pixGenerateQRCode({
              id: locationId
            })
        });
        qrCodePayload = String(qrcode?.qrcode || "").trim();
        qrCodeImage = String(qrcode?.imagemQrcode || "").trim() || null;
      } catch (error) {
        const details = classifyProviderError(error);
        logger.warn(
          {
            event: "pix_charge_qrcode_generation_failed",
            provider: "gerencianet",
            companyId: input.booking.companyId,
            bookingId: input.booking.id,
            paymentReference,
            txId,
            errorCategory: details.category,
            statusCode: details.statusCode,
            errorCode: details.errorCode,
            message: details.message
          },
          "Gerencianet QRCode generation failed"
        );
      }
    }

    const fallbackPayload =
      qrCodePayload ||
      buildPixCopyPastePayload({
        amount,
        pixKey: input.pixSettings.key,
        recipientName: input.pixSettings.recipientName,
        city: input.pixSettings.city,
        txId,
        paymentReference
      });

    return {
      provider: "gerencianet",
      detectionMode: "provider",
      txId,
      payload: fallbackPayload,
      qrCode: qrCodeImage,
      locationId,
      expiresAt: input.expiresAt || null,
      raw: {
        charge: pix
      },
      regenerated: true,
      fallbackUsed: false
    };
  }

  public async getPixChargeStatus({
    txId
  }: {
    txId: string;
  }): Promise<PixChargeStatusResult> {
    const requestTimeoutMs = getProviderRequestTimeoutMs();
    const gerencianet = getGerencianetClient();
    const detail = await withProviderTimeout({
      operation: "pixDetailCharge",
      timeoutMs: requestTimeoutMs,
      task: () =>
        gerencianet.pixDetailCharge({
          txid: txId
        })
    });

    const normalizedStatus = String(detail?.status || "")
      .trim()
      .toUpperCase();

    if (normalizedStatus === "CONCLUIDA") {
      return {
        provider: "gerencianet",
        txId,
        status: "paid",
        raw: detail
      };
    }

    if (["ATIVA", "REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"].includes(normalizedStatus)) {
      return {
        provider: "gerencianet",
        txId,
        status: "pending",
        raw: detail
      };
    }

    return {
      provider: "gerencianet",
      txId,
      status: "unknown",
      raw: detail
    };
  }

  public async mapWebhookToInternalEvent(payload: any): Promise<MapWebhookResult> {
    if (String(payload?.evento || "").trim().toLowerCase() === "teste_webhook") {
      return {
        provider: "gerencianet",
        detected: true,
        events: []
      };
    }

    const pixEvents = Array.isArray(payload?.pix) ? payload.pix : [];
    if (!pixEvents.length) {
      return {
        provider: "gerencianet",
        detected: false,
        events: []
      };
    }

    const events: PaymentWebhookEvent[] = pixEvents
      .map((pixItem: any) => {
        const txId = String(pixItem?.txid || "").trim();
        if (!txId) {
          return null;
        }

        return {
          provider: "gerencianet" as PixProviderName,
          pixTxId: txId,
          companyId: parseCompanyIdFromTxId(txId),
          status: "paid" as const,
          paidAt: pixItem?.horario ? new Date(pixItem.horario) : null,
          raw: pixItem
        };
      })
      .filter(Boolean) as PaymentWebhookEvent[];

    return {
      provider: "gerencianet",
      detected: true,
      events
    };
  }
}

const manualProviderStrategy = new ManualPixProviderStrategy();
const gerencianetProviderStrategy = new GerencianetPixProviderStrategy();

const resolveProviderStrategy = (name: PixProviderName): PaymentProviderStrategy =>
  name === "manual" ? manualProviderStrategy : gerencianetProviderStrategy;

export const isProviderManagedPixProvider = (provider?: string | null): boolean =>
  String(provider || "")
    .trim()
    .toLowerCase() === "gerencianet";

export const resolvePixDetectionMode = (provider?: string | null): PixDetectionMode =>
  isProviderManagedPixProvider(provider) ? "provider" : "manual";

const shouldReuseExistingBookingPix = (
  booking: ServiceBooking,
  forceRegeneration = false
): boolean => {
  if (forceRegeneration) return false;

  const hasPayload = String(booking.pixPayload || "").trim().length > 0;
  const hasTxId = String(booking.pixTxId || "").trim().length > 0;
  if (!hasPayload || !hasTxId) return false;

  if (!booking.pixExpiresAt) return true;
  return new Date(booking.pixExpiresAt).getTime() >= Date.now();
};

const buildFallbackResult = async ({
  input,
  activeProvider,
  startedAt,
  retryAttempted,
  attemptCount,
  failure,
  configDiagnostics
}: {
  input: CreatePixChargeInput;
  activeProvider: PixProviderName;
  startedAt: number;
  retryAttempted: boolean;
  attemptCount: number;
  failure: ProviderErrorDetails;
  configDiagnostics?: ProviderConfigDiagnostics;
}): Promise<CreatePixChargeResult> => {
  const fallback = await manualProviderStrategy.createPixCharge(input);

  logger.warn(
    {
      event: "pix_fallback_to_manual",
      provider: activeProvider,
      companyId: input.booking.companyId,
      bookingId: input.booking.id,
      serviceId: input.booking.companyServiceId,
      professionalId: input.booking.professionalId,
      paymentReference: input.booking.paymentReference || null,
      pixTxId: fallback.txId,
      fallbackReasonCategory: failure.category,
      fallbackReasonMessage: failure.message,
      statusCode: failure.statusCode,
      errorCode: failure.errorCode,
      retryAttempted,
      attemptCount,
      configValid: configDiagnostics?.valid ?? null,
      configMissing: configDiagnostics?.missing || [],
      certPath: configDiagnostics?.certPath || null,
      certExists: configDiagnostics?.certExists ?? null,
      sandbox: configDiagnostics?.sandbox ?? null,
      durationMs: Date.now() - startedAt
    },
    "Fallback to manual PIX payload"
  );

  return {
    ...fallback,
    detectionMode: "manual",
    fallbackUsed: true
  };
};

export const createPixCharge = async (
  input: CreatePixChargeInput
): Promise<CreatePixChargeResult> => {
  if (shouldReuseExistingBookingPix(input.booking, Boolean(input.forceRegeneration))) {
    const provider = String(input.booking.pixProvider || "").trim().toLowerCase();
    return {
      provider: provider === "gerencianet" ? "gerencianet" : "manual",
      detectionMode: resolvePixDetectionMode(provider),
      txId: String(input.booking.pixTxId),
      payload: String(input.booking.pixPayload),
      expiresAt: input.booking.pixExpiresAt || null,
      locationId: input.booking.pixLocationId || null,
      qrCode: input.booking.pixQrCode || null,
      regenerated: false,
      fallbackUsed: false
    };
  }

  const startedAt = Date.now();
  const activeProvider = resolveActiveProvider();
  const activeStrategy = resolveProviderStrategy(activeProvider);

  if (activeProvider === "manual") {
    const manualResult = await activeStrategy.createPixCharge(input);
    logger.info(
      {
        event: "pix_charge_created",
        provider: manualResult.provider,
        companyId: input.booking.companyId,
        bookingId: input.booking.id,
        serviceId: input.booking.companyServiceId,
        professionalId: input.booking.professionalId,
        paymentReference: input.booking.paymentReference || null,
        pixTxId: manualResult.txId,
        pixLocationId: manualResult.locationId || null,
        attemptCount: 1,
        durationMs: Date.now() - startedAt
      },
      "PIX charge created"
    );
    return manualResult;
  }

  const configDiagnostics = getProviderConfigDiagnostics();
  const maxAttempts = getProviderMaxAttempts();
  const retryBackoffMs = getProviderRetryBackoffMs();
  const timeoutMs = getProviderRequestTimeoutMs();

  logger.info(
    {
      event: "pix_charge_provider_requested",
      provider: activeProvider,
      companyId: input.booking.companyId,
      bookingId: input.booking.id,
      serviceId: input.booking.companyServiceId,
      professionalId: input.booking.professionalId,
      paymentReference: input.booking.paymentReference || null,
      maxAttempts,
      timeoutMs,
      configValid: configDiagnostics.valid,
      configMissing: configDiagnostics.missing,
      certPath: configDiagnostics.certPath || null,
      certExists: configDiagnostics.certExists,
      sandbox: configDiagnostics.sandbox
    },
    "PIX charge provider request started"
  );

  if (!configDiagnostics.valid) {
    return buildFallbackResult({
      input,
      activeProvider,
      startedAt,
      retryAttempted: false,
      attemptCount: 0,
      failure: {
        category: "config_invalid",
        retryable: false,
        statusCode: null,
        errorCode: null,
        message: `Provider config invalid: ${configDiagnostics.missing.join(", ")}`,
        operation: null
      },
      configDiagnostics
    });
  }

  let retryAttempted = false;
  let executedAttempts = 0;
  let lastFailure: ProviderErrorDetails = {
    category: "unknown",
    retryable: false,
    statusCode: null,
    errorCode: null,
    message: "Unknown provider error",
    operation: null
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    executedAttempts = attempt;
    const attemptStartedAt = Date.now();

    try {
      const result = await activeStrategy.createPixCharge(input);
      logger.info(
        {
          event: "pix_charge_created",
          provider: result.provider,
          companyId: input.booking.companyId,
          bookingId: input.booking.id,
          serviceId: input.booking.companyServiceId,
          professionalId: input.booking.professionalId,
          paymentReference: input.booking.paymentReference || null,
          pixTxId: result.txId,
          pixLocationId: result.locationId || null,
          attemptCount: attempt,
          retryAttempted,
          durationMs: Date.now() - startedAt
        },
        "PIX charge created"
      );
      return result;
    } catch (error) {
      const failure = classifyProviderError(error);
      lastFailure = failure;
      const willRetry = failure.retryable && attempt < maxAttempts;
      retryAttempted = retryAttempted || willRetry;

      logger[willRetry ? "warn" : "error"](
        {
          event: "pix_charge_provider_failed",
          provider: activeProvider,
          companyId: input.booking.companyId,
          bookingId: input.booking.id,
          serviceId: input.booking.companyServiceId,
          professionalId: input.booking.professionalId,
          paymentReference: input.booking.paymentReference || null,
          attempt,
          maxAttempts,
          retryable: failure.retryable,
          willRetry,
          errorCategory: failure.category,
          statusCode: failure.statusCode,
          errorCode: failure.errorCode,
          operation: failure.operation,
          message: failure.message,
          durationMs: Date.now() - attemptStartedAt,
          error
        },
        "PIX charge provider attempt failed"
      );

      if (willRetry) {
        const delayMs = Math.min(retryBackoffMs * attempt, 5000);
        logger.warn(
          {
            event: "pix_charge_provider_retry_scheduled",
            provider: activeProvider,
            companyId: input.booking.companyId,
            bookingId: input.booking.id,
            attempt,
            nextAttempt: attempt + 1,
            delayMs,
            errorCategory: failure.category
          },
          "Retry scheduled for PIX provider charge creation"
        );
        await sleep(delayMs);
        continue;
      }

      break;
    }
  }

  return buildFallbackResult({
    input,
    activeProvider,
    startedAt,
    retryAttempted,
    attemptCount: executedAttempts,
    failure: lastFailure,
    configDiagnostics
  });
};

export const getPixChargeStatus = async ({
  provider,
  txId
}: {
  provider?: PixProviderName | null;
  txId: string;
}): Promise<PixChargeStatusResult> => {
  const resolvedProvider =
    provider && ["manual", "gerencianet"].includes(String(provider).toLowerCase())
      ? (String(provider).toLowerCase() as PixProviderName)
      : resolveActiveProvider();

  const strategy = resolveProviderStrategy(resolvedProvider);
  return strategy.getPixChargeStatus({ txId });
};

export const mapWebhookToInternalEvent = async (payload: any): Promise<MapWebhookResult> => {
  const gerencianetResult = await gerencianetProviderStrategy.mapWebhookToInternalEvent(payload);
  if (gerencianetResult.detected) {
    return gerencianetResult;
  }

  return manualProviderStrategy.mapWebhookToInternalEvent(payload);
};
