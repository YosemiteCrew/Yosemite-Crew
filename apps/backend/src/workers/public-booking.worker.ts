import { Job, Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import logger from "src/utils/logger";
import { PublicBookingJobs } from "src/queues/public-booking.queue";
import { PublicBookingRequestService } from "src/services/public-booking.service";

export const PublicBookingWorker = new Worker(
  "public-booking",
  async (job: Job) => {
    if (job.name === PublicBookingJobs.PURGE_EXPIRED_REQUESTS) {
      const { expired, deleted } =
        await PublicBookingRequestService.purgeExpired();

      // Counts only. The rows being deleted are personal data, so the thing that
      // proves the retention rule ran must not itself become a copy of them in
      // the log.
      logger.info("🧹 Public booking retention purge", { expired, deleted });
      return { expired, deleted };
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection: redisConnection },
);

PublicBookingWorker.on("failed", (_job, err) =>
  logger.error("❌ Public booking purge failed", err),
);
