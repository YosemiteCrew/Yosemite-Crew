import { Job, Worker } from "bullmq";
import { redisConnection } from "src/queues/bull.config";
import { DeveloperExportJobs } from "src/queues/developer-export.queue";
import { DeveloperExportService } from "src/services/developer-export.service";
import logger from "src/utils/logger";

type DeveloperExportJobData = {
  exportJobId: string;
};

export const DeveloperExportWorker = new Worker(
  "developer-export",
  async (job: Job<DeveloperExportJobData>) => {
    if (job.name === DeveloperExportJobs.RUN_EXPORT) {
      logger.info("📦 Running developer export job", {
        exportJobId: job.data.exportJobId,
      });
      await DeveloperExportService.run(job.data.exportJobId);
      return { success: true };
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection: redisConnection },
);

DeveloperExportWorker.on("completed", () =>
  logger.info("✅ Developer export worker completed"),
);

DeveloperExportWorker.on("failed", (_, err) =>
  logger.error("❌ Developer export failed", err),
);
