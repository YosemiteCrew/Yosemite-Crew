import logger from "src/utils/logger";
import { VaccineReminderQueue } from "./vaccine.queues";

export async function registerVaccineReminderScheduler() {
  // 🩺 Vaccine due-date reminders: every 24 hours
  await VaccineReminderQueue.add(
    "run",
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: "vaccine-reminder-repeat",
    },
  );

  logger.info("✅ Vaccine reminder scheduler registered");
}
