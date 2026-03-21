import { Worker } from "bullmq";
import { redisConnection } from "src/queues/bull.config";
import { IdexxResultsService } from "src/services/idexx-results.service";
import logger from "src/utils/logger";

export const LabResultsWorker = new Worker(
  "lab-results",
  async () => {
    logger.info("🧪 Polling lab results...");
    await IdexxResultsService.pollLatest();
  },
  { connection: redisConnection },
);

LabResultsWorker.on("completed", () =>
  logger.info("✅ Lab results polling completed"),
);

LabResultsWorker.on("failed", (_, err) =>
  logger.error("❌ Lab results polling failed", err),
);
