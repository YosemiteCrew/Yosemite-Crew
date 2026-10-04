import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { SavedReportService } from "../services/saved-report.service";
import logger from "src/utils/logger";

export const ReportDeliveryWorker = new Worker(
  "report-delivery",
  async () => SavedReportService.deliverDue(),
  { connection: redisConnection },
);

ReportDeliveryWorker.on("completed", (job, count) =>
  logger.info("Scheduled reports processed", { jobId: job.id, count }),
);
ReportDeliveryWorker.on("failed", (job, error) =>
  logger.error("Scheduled report delivery failed", { jobId: job?.id, error }),
);
