import "reflect-metadata";
import "./bootstrap";
import "./database";
import { campaignQueue, startQueueProcess } from "./queues";
import { logger } from "./utils/logger";

const startWorker = async () => {
  try {
    await startQueueProcess({ mode: "worker" });
    logger.info("Campaign worker started");
  } catch (error) {
    logger.error("Error starting campaign worker:", error);
    process.exit(1);
  }
};

process.on("uncaughtException", err => {
  logger.error(`${new Date().toUTCString()} worker uncaughtException:`, err.message);
  logger.error(err.stack);
});

process.on("unhandledRejection", (reason, p) => {
  logger.error(`${new Date().toUTCString()} worker unhandledRejection:`, reason, p);
});

const shutdown = async () => {
  logger.info("Campaign worker shutting down...");
  await campaignQueue.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startWorker();
