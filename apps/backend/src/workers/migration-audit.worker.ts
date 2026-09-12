import { Job, Worker } from "bullmq";
import { defaultQueueOptions } from "src/queues/bull.config";
import {
  MigrationAuditJobData,
  MigrationAuditJobs,
} from "src/queues/migration-audit.queue";
import { runMigrationAudit } from "src/services/migration-audit.service";
import logger from "src/utils/logger";

export const MigrationAuditWorker = new Worker<MigrationAuditJobData>(
  "migration-audit",
  async (job: Job<MigrationAuditJobData>) => {
    if (job.name !== MigrationAuditJobs.RUN) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    await runMigrationAudit(job.data.auditRunId);
    return { success: true };
  },
  { ...defaultQueueOptions },
);

MigrationAuditWorker.on("completed", () =>
  logger.info("✅ Migration audit worker completed"),
);

MigrationAuditWorker.on("failed", (job, err) =>
  logger.error("❌ Migration audit worker failed", err),
);
