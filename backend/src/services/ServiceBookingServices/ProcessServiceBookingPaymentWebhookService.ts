import { logger } from "../../utils/logger";
import ServiceBooking from "../../models/ServiceBooking";
import {
  getPixChargeStatus,
  isProviderManagedPixProvider,
  mapWebhookToInternalEvent
} from "../SchedulingServices/PaymentProviderService";
import ConfirmPaymentService from "./ConfirmPaymentService";

type ProcessWebhookInput = {
  payload: any;
};

type ProcessWebhookResult = {
  detected: boolean;
  provider?: string;
  received: number;
  processed: number;
  duplicates: number;
  ignored: number;
  errors: number;
  ignoredReasons: string[];
};

const buildProviderSyncContext = ({
  booking,
  provider,
  status,
  source,
  payload,
  action
}: {
  booking: ServiceBooking;
  provider: string;
  status: string;
  source: "webhook" | "reconciliation";
  payload?: Record<string, any>;
  action: string;
}): Record<string, any> => {
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
    provider,
    status,
    source,
    paymentReference: booking.paymentReference || null,
    pixTxId: booking.pixTxId || null,
    ...(payload || {})
  });

  const paymentContext =
    contextJson.payment && typeof contextJson.payment === "object"
      ? contextJson.payment
      : {};

  paymentContext.lastProviderSync = {
    at: new Date().toISOString(),
    source,
    provider,
    status,
    paymentReference: booking.paymentReference || null,
    pixTxId: booking.pixTxId || null
  };

  contextJson.paymentHistory = paymentHistory.slice(-30);
  contextJson.payment = paymentContext;

  return contextJson;
};

const ProcessServiceBookingPaymentWebhookService = async ({
  payload
}: ProcessWebhookInput): Promise<ProcessWebhookResult> => {
  const startedAt = Date.now();
  const mapped = await mapWebhookToInternalEvent(payload);
  if (!mapped.detected) {
    return {
      detected: false,
      received: 0,
      processed: 0,
      duplicates: 0,
      ignored: 0,
      errors: 0,
      ignoredReasons: []
    };
  }

  logger.info(
    {
      event: "pix_webhook_received",
      provider: mapped.provider,
      received: mapped.events.length
    },
    "PIX webhook received"
  );

  let processed = 0;
  let duplicates = 0;
  let ignored = 0;
  let errors = 0;
  const ignoredReasons = new Set<string>();

  for (const event of mapped.events) {
    if (!event.pixTxId) {
      ignored += 1;
      ignoredReasons.add("empty_txid");
      continue;
    }

    if (!event.companyId || event.companyId <= 0) {
      ignored += 1;
      ignoredReasons.add("company_not_resolved_from_txid");
      continue;
    }

    try {
      const booking = await ServiceBooking.findOne({
        where: {
          companyId: event.companyId,
          pixTxId: event.pixTxId
        },
        attributes: [
          "id",
          "companyId",
          "companyServiceId",
          "professionalId",
          "paymentReference",
          "pixTxId",
          "pixProvider",
          "status",
          "paymentStatus",
          "contextJson"
        ]
      });

      if (!booking) {
        ignored += 1;
        ignoredReasons.add("unknown_txid");
        continue;
      }

      const providerName = String(booking.pixProvider || event.provider || "")
        .trim()
        .toLowerCase();
      let providerStatus = "unknown";
      const providerManaged = isProviderManagedPixProvider(providerName);

      if (!providerManaged) {
        const manualSyncContext = buildProviderSyncContext({
          booking,
          provider: providerName || "manual",
          status: "manual_detection_not_supported",
          source: "webhook",
          action: "pix_webhook_manual_payment_ignored"
        });
        await booking.update({ contextJson: manualSyncContext });

        ignored += 1;
        ignoredReasons.add("manual_provider_not_auto_confirmable");
        logger.info(
          {
            event: "pix_webhook_manual_provider_ignored",
            provider: providerName || "manual",
            companyId: booking.companyId,
            bookingId: booking.id,
            serviceId: booking.companyServiceId,
            professionalId: booking.professionalId,
            paymentReference: booking.paymentReference || null,
            pixTxId: booking.pixTxId || null
          },
          "Ignoring webhook auto-confirmation for manual PIX booking"
        );
        continue;
      }

      if (providerManaged) {
        const status = await getPixChargeStatus({
          provider: "gerencianet",
          txId: event.pixTxId
        });
        providerStatus = status.status;
        const syncContext = buildProviderSyncContext({
          booking,
          provider: String(status.provider || providerName || event.provider || "unknown"),
          status: status.status,
          source: "webhook",
          action: "pix_webhook_provider_status_checked"
        });
        await booking.update({ contextJson: syncContext });

        if (status.status !== "paid") {
          ignored += 1;
          ignoredReasons.add("provider_status_not_paid");
          continue;
        }
      }

      const confirmation = await ConfirmPaymentService({
        companyId: event.companyId,
        pixTxId: event.pixTxId,
        source: "webhook"
      });

      if (confirmation.alreadyProcessed) {
        duplicates += 1;
        logger.info(
          {
            event: "pix_webhook_duplicate_confirmation_ignored",
            provider: event.provider,
            companyId: event.companyId,
            bookingId: confirmation.booking.id,
            serviceId: confirmation.booking.companyServiceId,
            professionalId: confirmation.booking.professionalId,
            pixTxId: event.pixTxId,
            paymentReference: confirmation.booking.paymentReference || null,
            providerStatus,
            durationMs: Date.now() - startedAt
          },
          "Duplicate PIX webhook confirmation ignored"
        );
      } else {
        processed += 1;
        logger.info(
          {
            event: "pix_webhook_confirmed",
            provider: event.provider,
            companyId: event.companyId,
            bookingId: confirmation.booking.id,
            serviceId: confirmation.booking.companyServiceId,
            professionalId: confirmation.booking.professionalId,
            pixTxId: event.pixTxId,
            paymentReference: confirmation.booking.paymentReference || null,
            providerStatus,
            source: "webhook_auto",
            durationMs: Date.now() - startedAt
          },
          "PIX webhook payment confirmed"
        );
      }
    } catch (error: any) {
      const errorCode = String(error?.message || "");
      if (
        ["ERR_SERVICE_BOOKING_NOT_FOUND", "ERR_PAYMENT_EXPIRED", "ERR_BOOKING_NOT_PAYABLE"].includes(
          errorCode
        )
      ) {
        ignored += 1;
        ignoredReasons.add(errorCode.toLowerCase());
        continue;
      }

      errors += 1;
      logger.error(
        {
          event: "pix_webhook_confirmation_error",
          provider: event.provider,
          companyId: event.companyId,
          pixTxId: event.pixTxId,
          error
        },
        "PIX webhook confirmation failed"
      );

      ignored += 1;
      ignoredReasons.add("webhook_confirmation_failed");
    }
  }

  logger.info(
    {
      event: "pix_webhook_processed",
      provider: mapped.provider,
      received: mapped.events.length,
      processed,
      duplicates,
      ignored,
      errors,
      ignoredReasons: Array.from(ignoredReasons),
      durationMs: Date.now() - startedAt
    },
    "PIX webhook processing finished"
  );

  return {
    detected: true,
    provider: mapped.provider,
    received: mapped.events.length,
    processed,
    duplicates,
    ignored,
    errors,
    ignoredReasons: Array.from(ignoredReasons)
  };
};

export default ProcessServiceBookingPaymentWebhookService;
