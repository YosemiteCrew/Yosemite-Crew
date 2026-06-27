import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { VaccineReminderEngine } from "../services/vaccine.reminder.engine";
import logger from "src/utils/logger";

export const VaccineReminderWorker = new Worker(
  "vaccine-reminder",
  async () => {
    logger.info("🩺 Running Vaccine Reminder Engine...");
    await VaccineReminderEngine.run();
  },
  { connection: redisConnection },
);

VaccineReminderWorker.on("completed", () =>
  logger.info("✅ VaccineReminderEngine completed"),
);

VaccineReminderWorker.on("failed", (job, err) =>
  logger.error("❌ VaccineReminderEngine failed", err),
);
