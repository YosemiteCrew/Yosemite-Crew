import { Job, Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import logger from "src/utils/logger";
import { AppointmentJobs } from "src/queues/appointment.queue";
import { AppointmentService } from "src/services/appointment.service";

type AppointmentJobData = {
  graceMinutes?: number;
};

export const AppointmentWorker = new Worker(
  "appointments",
  async (job: Job<AppointmentJobData>) => {
    if (job.name === AppointmentJobs.MARK_NO_SHOW) {
      logger.info("🔔 Running Appointment No-Show Marker Job");

      const { graceMinutes } = job.data;

      await AppointmentService.markNoShowAppointments({
        graceMinutes: graceMinutes ?? 15,
      });

      return { success: true };
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection: redisConnection },
);

AppointmentWorker.on("completed", () =>
  logger.info("✅ Appointment worker completed"),
);

AppointmentWorker.on("failed", (job, err) =>
  logger.error("❌ TaskRecurrenceEngine failed", err),
);
