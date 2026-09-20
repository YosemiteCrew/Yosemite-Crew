import { Job, Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import logger from "src/utils/logger";
import { SuperadminContactJobs } from "src/queues/superadmin-contact.queue";
import { SuperadminContactService } from "src/services/superadmin-contact.service";

export const SuperadminContactWorker = new Worker(
  "superadmin-contact-forward",
  async (job: Job) => {
    if (job.name === SuperadminContactJobs.DRAIN_FORWARDS) {
      const summary = await SuperadminContactService.drainForwards();

      // Counts only. This is the end-to-end health signal for the mirror -
      // only the sender can see what has not arrived - and it must not become
      // a second copy of the submissions it is reporting on.
      logger.info("📮 SuperAdmin contact forward drain", summary);
      return summary;
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection: redisConnection },
);

SuperadminContactWorker.on("failed", (_job, err) =>
  logger.error("❌ SuperAdmin contact forward drain failed", err),
);
