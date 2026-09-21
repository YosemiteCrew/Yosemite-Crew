import { Job, Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import logger from "src/utils/logger";
import { DeveloperMeterJobs } from "src/queues/developer-meter.queue";
import { DeveloperUsageService } from "src/services/developer-usage.service";

export const DeveloperMeterWorker = new Worker(
  "developer-meter-delivery",
  async (job: Job) => {
    if (job.name !== DeveloperMeterJobs.DRAIN_EVENTS) {
      throw new Error(`Unknown job name: ${job.name}`);
    }
    const summary = await DeveloperUsageService.drainMeterEvents();
    logger.info("Developer meter delivery drain", summary);
    return summary;
  },
  { connection: redisConnection },
);

DeveloperMeterWorker.on("failed", (_job, error) =>
  logger.error("Developer meter delivery drain failed", error),
);
