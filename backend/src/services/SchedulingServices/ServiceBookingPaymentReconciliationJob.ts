import cron from "node-cron";
import { Op, Sequelize } from "sequelize";

import ServiceBooking from "../../models/ServiceBooking";
import { logger } from "../../utils/logger";
import ConfirmPaymentService from "../ServiceBookingServices/ConfirmPaymentService";
import {
  getPixChargeStatus,
  isProviderManagedPixProvider,
  PixChargeStatusResult,
  PixProviderName
} from "./PaymentProviderService";

let reconciliationTask: cron.ScheduledTask | null = null;
const DEFAULT_BATCH_SIZE = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_BATCH_SIZE || 100
);
const DEFAULT_PER_TENANT_LIMIT = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_PER_TENANT_LIMIT || 10
);
const DEFAULT_OVERSCAN_FACTOR = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_OVERSCAN_FACTOR || 6
);
const DEFAULT_COMPANY_SCAN_LIMIT = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_COMPANY_SCAN_LIMIT || 900
);
const PENDING_RETRY_MINUTES = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_PENDING_RETRY_MINUTES || 4
);
const UNKNOWN_RETRY_MINUTES = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_UNKNOWN_RETRY_MINUTES || 8
);
const EXPIRED_RETRY_MINUTES = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_EXPIRED_RETRY_MINUTES || 15
);
const FAILURE_BACKOFF_BASE_MINUTES = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_FAILURE_BASE_MINUTES || 2
);
const FAILURE_BACKOFF_MAX_MINUTES = Number(
  process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_FAILURE_MAX_MINUTES || 30
);

const PRIORITY_ORDER = [
  [
    Sequelize.literal(
      "CASE WHEN \"ServiceBooking\".\"paymentDueAt\" IS NULL THEN 1 ELSE 0 END"
    ),
    "ASC"
  ],
  ["paymentDueAt", "ASC"],
  ["createdAt", "ASC"],
  ["id", "ASC"]
] as any;

type ReconciliationStatusResolver = (args: {
  booking: ServiceBooking;
  provider: PixProviderName;
  txId: string;
}) => Promise<PixChargeStatusResult>;

type ReconciliationOptions = {
  limit?: number;
  perTenantLimit?: number;
  overscanFactor?: number;
  companyScanLimit?: number;
  statusResolver?: ReconciliationStatusResolver;
  trigger?: "cron" | "manual";
};

type ReconciliationSummary = {
  trigger: "cron" | "manual";
  scannedRows: number;
  selectedRows: number;
  matchedRows: number;
  duplicateRows: number;
  skippedRows: number;
  failedRows: number;
  providerCalls: number;
  companiesConsidered: number;
  companiesWithSelectedRows: number;
  selectedPerCompany: Record<number, number>;
  skippedByReason: Record<string, number>;
  durationMs: number;
};

type ReconciliationState = {
  attemptCount: number;
  failureCount: number;
  nextRetryAt: Date | null;
};

const resolveProvider = (booking: ServiceBooking): PixProviderName => {
  const provider = String(booking.pixProvider || "").trim().toLowerCase();
  return isProviderManagedPixProvider(provider) ? "gerencianet" : "manual";
};

const normalizePositiveInt = (value: number, fallback: number, min: number, max: number): number => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
};

const parseDateOrNull = (value: any): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const minutesFromNow = (minutes: number): Date =>
  new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);

const buildEligibilityWhere = (now: Date): Record<string, any> => ({
  status: {
    [Op.in]: ["pending_payment", "confirmed", "scheduled"]
  },
  paymentStatus: "pending",
  pixTxId: {
    [Op.ne]: null
  },
  [Op.and]: [
    {
      pixProvider: {
        [Op.in]: ["gerencianet", "GERENCIANET"]
      }
    },
    {
      [Op.or]: [
        {
          paymentDueAt: null
        },
        {
          paymentDueAt: {
            [Op.gt]: now
          }
        },
        {
          status: {
            [Op.in]: ["confirmed", "scheduled"]
          }
        }
      ]
    }
  ]
});

const getReconciliationState = (booking: ServiceBooking): ReconciliationState => {
  const contextJson =
    booking.contextJson && typeof booking.contextJson === "object"
      ? booking.contextJson
      : {};

  const paymentContext =
    contextJson.payment && typeof contextJson.payment === "object"
      ? contextJson.payment
      : {};

  const reconciliation =
    paymentContext.reconciliation && typeof paymentContext.reconciliation === "object"
      ? paymentContext.reconciliation
      : {};

  return {
    attemptCount: Number(reconciliation.attemptCount || 0),
    failureCount: Number(reconciliation.failureCount || 0),
    nextRetryAt: parseDateOrNull(reconciliation.nextRetryAt)
  };
};

const hasBackoffActive = (booking: ServiceBooking, now: Date): boolean => {
  const state = getReconciliationState(booking);
  if (!state.nextRetryAt) {
    return false;
  }

  return state.nextRetryAt.getTime() > now.getTime();
};

const computeStatusRetryAt = (status: PixChargeStatusResult["status"]): Date | null => {
  if (status === "paid") return null;
  if (status === "pending") return minutesFromNow(PENDING_RETRY_MINUTES);
  if (status === "expired") return minutesFromNow(EXPIRED_RETRY_MINUTES);
  return minutesFromNow(UNKNOWN_RETRY_MINUTES);
};

const computeFailureRetryAt = (failureCount: number): Date => {
  const multiplier = Math.max(1, 2 ** Math.max(0, failureCount - 1));
  const backoffMinutes = Math.min(
    FAILURE_BACKOFF_MAX_MINUTES,
    FAILURE_BACKOFF_BASE_MINUTES * multiplier
  );
  return minutesFromNow(backoffMinutes);
};

const compareByPriority = (left: ServiceBooking, right: ServiceBooking): number => {
  const leftDueAt = parseDateOrNull(left.paymentDueAt);
  const rightDueAt = parseDateOrNull(right.paymentDueAt);

  if (leftDueAt && !rightDueAt) return -1;
  if (!leftDueAt && rightDueAt) return 1;
  if (leftDueAt && rightDueAt) {
    const dueDelta = leftDueAt.getTime() - rightDueAt.getTime();
    if (dueDelta !== 0) return dueDelta;
  }

  const leftCreatedAt = parseDateOrNull(left.createdAt);
  const rightCreatedAt = parseDateOrNull(right.createdAt);
  if (leftCreatedAt && rightCreatedAt) {
    const createdAtDelta = leftCreatedAt.getTime() - rightCreatedAt.getTime();
    if (createdAtDelta !== 0) return createdAtDelta;
  }

  return Number(left.id || 0) - Number(right.id || 0);
};

const appendReconciliationContext = ({
  booking,
  provider,
  status,
  action,
  payload,
  nextRetryAt,
  attemptCount,
  failureCount,
  trigger
}: {
  booking: ServiceBooking;
  provider: string;
  status: string;
  action: string;
  payload?: Record<string, any>;
  nextRetryAt?: Date | null;
  attemptCount?: number;
  failureCount?: number;
  trigger?: "cron" | "manual";
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
    source: "reconciliation",
    paymentReference: booking.paymentReference || null,
    pixTxId: booking.pixTxId || null,
    ...(payload || {})
  });

  const paymentContext =
    contextJson.payment && typeof contextJson.payment === "object"
      ? contextJson.payment
      : {};

  const reconciliationState =
    paymentContext.reconciliation && typeof paymentContext.reconciliation === "object"
      ? paymentContext.reconciliation
      : {};

  reconciliationState.lastAttemptAt = new Date().toISOString();
  reconciliationState.lastStatus = status;
  reconciliationState.lastProvider = provider;
  reconciliationState.lastAction = action;
  reconciliationState.lastTrigger = trigger || "cron";

  if (typeof attemptCount === "number" && Number.isFinite(attemptCount)) {
    reconciliationState.attemptCount = Math.max(0, Math.floor(attemptCount));
  }

  if (typeof failureCount === "number" && Number.isFinite(failureCount)) {
    reconciliationState.failureCount = Math.max(0, Math.floor(failureCount));
  }

  reconciliationState.nextRetryAt = nextRetryAt ? nextRetryAt.toISOString() : null;

  paymentContext.lastProviderSync = {
    at: new Date().toISOString(),
    source: "reconciliation",
    provider,
    status,
    trigger: trigger || "cron",
    paymentReference: booking.paymentReference || null,
    pixTxId: booking.pixTxId || null,
    nextRetryAt: nextRetryAt ? nextRetryAt.toISOString() : null
  };
  paymentContext.reconciliation = reconciliationState;

  contextJson.paymentHistory = paymentHistory.slice(-30);
  contextJson.payment = paymentContext;

  return contextJson;
};

const incrementReason = (target: Record<string, number>, reason: string): void => {
  target[reason] = Number(target[reason] || 0) + 1;
};

const selectCandidateBookings = async ({
  now,
  limit,
  perTenantLimit,
  overscanFactor,
  companyScanLimit,
  skippedByReason
}: {
  now: Date;
  limit: number;
  perTenantLimit: number;
  overscanFactor: number;
  companyScanLimit: number;
  skippedByReason: Record<string, number>;
}): Promise<{
  bookings: ServiceBooking[];
  scannedRows: number;
  companyIds: number[];
  selectedPerCompany: Record<number, number>;
  selectionSkipped: number;
}> => {
  const where = buildEligibilityWhere(now);

  const seedRows = (await ServiceBooking.findAll({
    where,
    attributes: ["id", "companyId"],
    order: PRIORITY_ORDER,
    limit: companyScanLimit,
    raw: true
  })) as Array<{ id: number; companyId: number }>;

  let scannedRows = seedRows.length;

  const companyIds: number[] = [];
  const seenCompanyIds = new Set<number>();

  for (const row of seedRows) {
    const companyId = Number(row.companyId || 0);
    if (!companyId || seenCompanyIds.has(companyId)) {
      continue;
    }
    seenCompanyIds.add(companyId);
    companyIds.push(companyId);
  }

  const selectedPerCompany: Record<number, number> = {};
  const selectedBookings: ServiceBooking[] = [];
  const selectedIds = new Set<number>();

  for (const companyId of companyIds) {
    if (selectedBookings.length >= limit) {
      break;
    }

    const tenantSelected = Number(selectedPerCompany[companyId] || 0);
    const tenantQuota = Math.min(perTenantLimit, limit - selectedBookings.length);
    if (tenantSelected >= tenantQuota) {
      continue;
    }

    const companyCandidates = await ServiceBooking.findAll({
      where: {
        ...where,
        companyId
      },
      attributes: [
        "id",
        "companyId",
        "companyServiceId",
        "professionalId",
        "paymentReference",
        "pixTxId",
        "pixProvider",
        "paymentDueAt",
        "status",
        "paymentStatus",
        "contextJson",
        "createdAt"
      ],
      order: PRIORITY_ORDER,
      limit: tenantQuota * overscanFactor
    });

    scannedRows += companyCandidates.length;

    for (const booking of companyCandidates) {
      if (selectedBookings.length >= limit) {
        break;
      }

      const currentTenantCount = Number(selectedPerCompany[companyId] || 0);
      if (currentTenantCount >= tenantQuota) {
        break;
      }

      if (selectedIds.has(Number(booking.id))) {
        continue;
      }

      const txId = String(booking.pixTxId || "").trim();
      if (!txId) {
        incrementReason(skippedByReason, "empty_txid");
        continue;
      }

      if (resolveProvider(booking) === "manual") {
        incrementReason(skippedByReason, "manual_provider");
        continue;
      }

      if (hasBackoffActive(booking, now)) {
        incrementReason(skippedByReason, "retry_backoff_active");
        continue;
      }

      selectedIds.add(Number(booking.id));
      selectedBookings.push(booking);
      selectedPerCompany[companyId] = currentTenantCount + 1;
    }
  }

  return {
    bookings: selectedBookings.sort(compareByPriority),
    scannedRows,
    companyIds,
    selectedPerCompany,
    selectionSkipped: Number(
      Object.values(skippedByReason).reduce((acc, value) => acc + value, 0)
    )
  };
};

export const runServiceBookingPaymentReconciliation = async (
  options: ReconciliationOptions = {}
): Promise<ReconciliationSummary> => {
  const startedAt = Date.now();
  const now = new Date();
  const limit = normalizePositiveInt(
    Number(options.limit || DEFAULT_BATCH_SIZE),
    DEFAULT_BATCH_SIZE,
    1,
    1000
  );
  const perTenantLimit = normalizePositiveInt(
    Number(options.perTenantLimit || DEFAULT_PER_TENANT_LIMIT),
    DEFAULT_PER_TENANT_LIMIT,
    1,
    100
  );
  const overscanFactor = normalizePositiveInt(
    Number(options.overscanFactor || DEFAULT_OVERSCAN_FACTOR),
    DEFAULT_OVERSCAN_FACTOR,
    2,
    12
  );
  const companyScanLimit = normalizePositiveInt(
    Number(
      options.companyScanLimit ||
        Math.max(DEFAULT_COMPANY_SCAN_LIMIT, limit * overscanFactor * 2)
    ),
    DEFAULT_COMPANY_SCAN_LIMIT,
    limit,
    5000
  );
  const statusResolver = options.statusResolver;
  const trigger = options.trigger || "cron";

  let scannedRows = 0;
  let selectedRows = 0;
  let matched = 0;
  let duplicates = 0;
  let skipped = 0;
  let failed = 0;
  let providerCalls = 0;
  let companiesConsidered = 0;
  let companiesWithSelectedRows = 0;
  const skippedByReason: Record<string, number> = {};
  let selectedPerCompany: Record<number, number> = {};

  logger.info(
    {
      event: "pix_reconciliation_cycle_started",
      trigger,
      limit,
      perTenantLimit,
      overscanFactor,
      companyScanLimit
    },
    "Service booking PIX reconciliation cycle started"
  );

  try {
    const selected = await selectCandidateBookings({
      now,
      limit,
      perTenantLimit,
      overscanFactor,
      companyScanLimit,
      skippedByReason
    });

    const pendingBookings = selected.bookings;
    scannedRows = selected.scannedRows;
    selectedRows = pendingBookings.length;
    companiesConsidered = selected.companyIds.length;
    selectedPerCompany = selected.selectedPerCompany;
    companiesWithSelectedRows = Object.keys(selectedPerCompany).length;
    skipped = selected.selectionSkipped;

    if (!pendingBookings.length) {
      const emptySummary: ReconciliationSummary = {
        trigger,
        scannedRows,
        selectedRows,
        matchedRows: 0,
        duplicateRows: 0,
        skippedRows: Number(
          Object.values(skippedByReason).reduce((acc, value) => acc + value, 0)
        ),
        failedRows: 0,
        providerCalls: 0,
        companiesConsidered,
        companiesWithSelectedRows,
        selectedPerCompany,
        skippedByReason,
        durationMs: Date.now() - startedAt
      };

      logger.info(
        {
          event: "pix_reconciliation_cycle",
          ...emptySummary
        },
        "Service booking PIX reconciliation cycle executed"
      );

      return emptySummary;
    }

    for (const booking of pendingBookings) {
      const itemStartedAt = Date.now();
      const provider = resolveProvider(booking);
      const txId = String(booking.pixTxId || "").trim();
      const reconciliationState = getReconciliationState(booking);
      const nextAttemptCount = reconciliationState.attemptCount + 1;

      if (!txId) {
        skipped += 1;
        incrementReason(skippedByReason, "empty_txid");
        continue;
      }

      if (provider === "manual") {
        skipped += 1;
        incrementReason(skippedByReason, "manual_provider");
        continue;
      }

      if (hasBackoffActive(booking, now)) {
        skipped += 1;
        incrementReason(skippedByReason, "retry_backoff_active");
        logger.info(
          {
            event: "pix_reconciliation_skipped",
            reason: "retry_backoff_active",
            companyId: booking.companyId,
            bookingId: booking.id,
            serviceId: booking.companyServiceId,
            professionalId: booking.professionalId,
            paymentReference: booking.paymentReference || null,
            pixTxId: booking.pixTxId || null
          },
          "PIX reconciliation skipped booking"
        );
        continue;
      }

      let status: PixChargeStatusResult;

      try {
        providerCalls += 1;
        status = statusResolver
          ? await statusResolver({ booking, provider, txId })
          : await getPixChargeStatus({ provider, txId });
      } catch (providerError: any) {
        failed += 1;
        const nextRetryAt = computeFailureRetryAt(reconciliationState.failureCount + 1);

        const failedContext = appendReconciliationContext({
          booking,
          provider,
          status: "error",
          action: "pix_reconciliation_provider_query_failed",
          nextRetryAt,
          attemptCount: nextAttemptCount,
          failureCount: reconciliationState.failureCount + 1,
          trigger,
          payload: {
            errorCode: String(providerError?.message || ""),
            errorName: String(providerError?.name || "")
          }
        });

        try {
          await booking.update({ contextJson: failedContext });
        } catch (contextError) {
          logger.warn(
            {
              event: "pix_reconciliation_context_update_failed",
              companyId: booking.companyId,
              bookingId: booking.id,
              error: contextError
            },
            "Failed to persist reconciliation context"
          );
        }

        logger.error(
          {
            event: "pix_reconciliation_provider_query_failed",
            companyId: booking.companyId,
            bookingId: booking.id,
            serviceId: booking.companyServiceId,
            professionalId: booking.professionalId,
            paymentReference: booking.paymentReference || null,
            pixTxId: booking.pixTxId || null,
            provider,
            trigger,
            nextRetryAt: nextRetryAt.toISOString(),
            durationMs: Date.now() - itemStartedAt,
            error: providerError
          },
          "PIX reconciliation provider query failed"
        );

        continue;
      }

      const nextRetryAt = computeStatusRetryAt(status.status);
      const syncContext = appendReconciliationContext({
        booking,
        provider: status.provider || provider,
        status: status.status,
        action: "pix_reconciliation_status_checked",
        nextRetryAt,
        attemptCount: nextAttemptCount,
        failureCount: 0,
        trigger
      });
      await booking.update({ contextJson: syncContext });

      if (status.status !== "paid") {
        skipped += 1;
        incrementReason(skippedByReason, `provider_status_${status.status}`);
        logger.info(
          {
            event: "pix_reconciliation_skipped",
            reason: `provider_status_${status.status}`,
            companyId: booking.companyId,
            bookingId: booking.id,
            serviceId: booking.companyServiceId,
            professionalId: booking.professionalId,
            paymentReference: booking.paymentReference || null,
            pixTxId: booking.pixTxId || null,
            provider: status.provider || provider,
            nextRetryAt: nextRetryAt ? nextRetryAt.toISOString() : null,
            durationMs: Date.now() - itemStartedAt
          },
          "PIX reconciliation skipped booking"
        );
        continue;
      }

      logger.info(
        {
          event: "pix_reconciliation_matched_payment",
          companyId: booking.companyId,
          bookingId: booking.id,
          serviceId: booking.companyServiceId,
          professionalId: booking.professionalId,
          paymentReference: booking.paymentReference || null,
          pixTxId: booking.pixTxId || null,
          provider: status.provider || provider,
          durationMs: Date.now() - itemStartedAt
        },
        "PIX reconciliation detected paid charge"
      );

      try {
        const confirmation = await ConfirmPaymentService({
          companyId: booking.companyId,
          bookingId: booking.id,
          paymentReference: booking.paymentReference,
          pixTxId: booking.pixTxId,
          source: "internal"
        });

        if (confirmation.alreadyProcessed) {
          duplicates += 1;
          logger.info(
            {
              event: "pix_reconciliation_duplicate_confirmation_ignored",
              companyId: booking.companyId,
              bookingId: booking.id,
              serviceId: booking.companyServiceId,
              professionalId: booking.professionalId,
              paymentReference: booking.paymentReference || null,
              pixTxId: booking.pixTxId || null,
              provider: status.provider || provider,
              durationMs: Date.now() - itemStartedAt
            },
            "PIX reconciliation duplicate confirmation ignored"
          );
          continue;
        }

        matched += 1;
        logger.info(
          {
            event: "pix_reconciliation_confirmed",
            companyId: booking.companyId,
            bookingId: confirmation.booking.id,
            serviceId: confirmation.booking.companyServiceId,
            professionalId: confirmation.booking.professionalId,
            paymentReference: confirmation.booking.paymentReference || null,
            pixTxId: confirmation.booking.pixTxId || null,
            provider: status.provider || provider,
            source: "reconciliation_auto",
            durationMs: Date.now() - itemStartedAt
          },
          "PIX reconciliation confirmed booking payment automatically"
        );
      } catch (confirmationError: any) {
        const errorCode = String(confirmationError?.message || "").toUpperCase();
        if (
          ["ERR_SERVICE_BOOKING_NOT_FOUND", "ERR_PAYMENT_EXPIRED", "ERR_BOOKING_NOT_PAYABLE"].includes(
            errorCode
          )
        ) {
          skipped += 1;
          incrementReason(skippedByReason, errorCode.toLowerCase());
          logger.info(
            {
              event: "pix_reconciliation_skipped",
              reason: errorCode.toLowerCase(),
              companyId: booking.companyId,
              bookingId: booking.id,
              serviceId: booking.companyServiceId,
              professionalId: booking.professionalId,
              paymentReference: booking.paymentReference || null,
              pixTxId: booking.pixTxId || null,
              provider: status.provider || provider,
              durationMs: Date.now() - itemStartedAt
            },
            "PIX reconciliation skipped booking"
          );
          continue;
        }

        failed += 1;
        logger.error(
          {
            event: "pix_reconciliation_failed",
            companyId: booking.companyId,
            bookingId: booking.id,
            serviceId: booking.companyServiceId,
            professionalId: booking.professionalId,
            paymentReference: booking.paymentReference || null,
            pixTxId: booking.pixTxId || null,
            provider: status.provider || provider,
            trigger,
            durationMs: Date.now() - itemStartedAt,
            error: confirmationError
          },
          "PIX reconciliation confirmation failed"
        );
      }
    }

    const summary: ReconciliationSummary = {
      trigger,
      scannedRows,
      selectedRows,
      matchedRows: matched,
      duplicateRows: duplicates,
      skippedRows: skipped,
      failedRows: failed,
      providerCalls,
      companiesConsidered,
      companiesWithSelectedRows,
      selectedPerCompany,
      skippedByReason,
      durationMs: Date.now() - startedAt
    };

    logger.info(
      {
        event: "pix_reconciliation_cycle",
        ...summary
      },
      "Service booking PIX reconciliation cycle executed"
    );

    return summary;
  } catch (error) {
    const summary: ReconciliationSummary = {
      trigger,
      scannedRows,
      selectedRows,
      matchedRows: matched,
      duplicateRows: duplicates,
      skippedRows: skipped,
      failedRows: failed,
      providerCalls,
      companiesConsidered,
      companiesWithSelectedRows,
      selectedPerCompany,
      skippedByReason,
      durationMs: Date.now() - startedAt
    };

    logger.error(
      {
        event: "pix_reconciliation_cycle_error",
        ...summary,
        trigger,
        error
      },
      "Service booking PIX reconciliation cycle failed"
    );

    return summary;
  }
};

export const startServiceBookingPaymentReconciliationJob = (): void => {
  if (reconciliationTask) {
    return;
  }

  const cronExpression = String(
    process.env.SERVICE_BOOKING_PAYMENT_RECONCILIATION_CRON || "*/2 * * * *"
  );

  reconciliationTask = cron.schedule(
    cronExpression,
    () => runServiceBookingPaymentReconciliation({ trigger: "cron" })
  );

  logger.info(
    {
      event: "pix_reconciliation_started",
      cron: cronExpression
    },
    "Service booking PIX reconciliation job initialized"
  );
};

export const stopServiceBookingPaymentReconciliationJob = (): void => {
  if (!reconciliationTask) {
    return;
  }

  reconciliationTask.stop();
  reconciliationTask = null;

  logger.info(
    { event: "pix_reconciliation_stopped" },
    "Service booking PIX reconciliation job stopped"
  );
};
