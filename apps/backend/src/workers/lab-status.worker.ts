import { Worker } from "bullmq";
import { redisConnection } from "src/queues/bull.config";
import { LabStatusService } from "src/services/lab-status.service";
import logger from "src/utils/logger";

export const LabStatusWorker = new Worker(
  "lab-status",
  async () => {
    logger.info("🧪 Polling lab order statuses...");
    await LabStatusService.pollPending();
  },
  { connection: redisConnection },
);

LabStatusWorker.on("completed", () =>
  logger.info("✅ Lab status polling completed"),
);

LabStatusWorker.on("failed", (_, err) =>
  logger.error("❌ Lab status polling failed", err),
);
