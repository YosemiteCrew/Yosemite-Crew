import logger from "src/utils/logger";
import { VaccineReminderQueue } from "./vaccine.queues";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function registerVaccineReminderScheduler() {
  // 🩺 Vaccine due-date reminders: every 24 hours
  await VaccineReminderQueue.upsertJobScheduler(
    "vaccine-reminder-repeat",
    { every: DAY_MS },
    { name: "run", data: {} },
  );

  logger.info("✅ Vaccine reminder scheduler registered");
}
