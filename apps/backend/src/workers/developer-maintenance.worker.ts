import { Worker } from "bullmq";
import { redisConnection } from "src/queues/bull.config";
import { DeveloperMaintenanceService } from "src/services/developer-maintenance.service";
import logger from "src/utils/logger";

export const DeveloperMaintenanceWorker = new Worker(
  "developer-maintenance",
  async () => {
    logger.info("🧹 Running developer platform maintenance...");
    await DeveloperMaintenanceService.run();
  },
  { connection: redisConnection },
);

DeveloperMaintenanceWorker.on("completed", () =>
  logger.info("✅ Developer maintenance completed"),
);

DeveloperMaintenanceWorker.on("failed", (_, err) =>
  logger.error("❌ Developer maintenance failed", err),
);
