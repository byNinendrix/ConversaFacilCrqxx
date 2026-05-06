import cron from "node-cron";

import { Op } from "sequelize";
import ServiceBookingSlotLock from "../../models/ServiceBookingSlotLock";
import { logger } from "../../utils/logger";

let cleanupTask: cron.ScheduledTask | null = null;

const runCleanup = async (): Promise<void> => {
  const startedAt = Date.now();

  try {
    const deletedRows = await ServiceBookingSlotLock.destroy({
      where: {
        expiresAt: {
          [Op.lte]: new Date()
        }
      }
    });

    logger.info(
      {
        event: "scheduling_slot_lock_cleanup",
        deletedRows,
        durationMs: Date.now() - startedAt
      },
      "Service booking slot lock cleanup executed"
    );
  } catch (error) {
    logger.error(
      {
        event: "scheduling_slot_lock_cleanup_error",
        durationMs: Date.now() - startedAt,
        error
      },
      "Failed to cleanup expired service booking slot locks"
    );
  }
};

export const startServiceBookingSlotLockCleanupJob = (): void => {
  if (cleanupTask) {
    return;
  }

  cleanupTask = cron.schedule("*/5 * * * *", runCleanup);

  logger.info(
    {
      event: "scheduling_slot_lock_cleanup_started",
      cron: "*/5 * * * *"
    },
    "Service booking slot lock cleanup job initialized"
  );
};

export const stopServiceBookingSlotLockCleanupJob = (): void => {
  if (!cleanupTask) {
    return;
  }

  cleanupTask.stop();
  cleanupTask = null;

  logger.info(
    { event: "scheduling_slot_lock_cleanup_stopped" },
    "Service booking slot lock cleanup job stopped"
  );
};

