import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { CareReminderService } from "../services/care-reminder.service";
import logger from "src/utils/logger";

export const CareReminderWorker = new Worker(
  "care-reminder",
  async () => CareReminderService.sendScheduledDue(),
  { connection: redisConnection },
);

CareReminderWorker.on("completed", (job, count) =>
  logger.info("✅ Scheduled care reminders processed", {
    jobId: job.id,
    count,
  }),
);

CareReminderWorker.on("failed", (job, error) =>
  logger.error("❌ Scheduled care reminders failed", {
    jobId: job?.id,
    error,
  }),
);
