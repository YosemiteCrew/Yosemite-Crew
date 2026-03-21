import { Worker } from "bullmq";
import { redisConnection } from "src/queues/bull.config";
import { IdexxReferenceService } from "src/services/idexx-reference.service";
import logger from "src/utils/logger";

export const IdexxReferenceWorker = new Worker(
  "idexx-reference",
  async () => {
    logger.info("🧬 Running IDEXX reference sync...");
    await IdexxReferenceService.syncAll();
  },
  { connection: redisConnection },
);

IdexxReferenceWorker.on("completed", () =>
  logger.info("✅ IDEXX reference sync completed"),
);

IdexxReferenceWorker.on("failed", (_, err) =>
  logger.error("❌ IDEXX reference sync failed", err),
);
