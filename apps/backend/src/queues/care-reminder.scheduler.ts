import logger from "src/utils/logger";
import { CareReminderQueue } from "./care-reminder.queue";

export async function registerCareReminderScheduler() {
  await CareReminderQueue.upsertJobScheduler(
    "care-reminder-due-dispatch",
    { every: 60_000 },
    { name: "dispatch-due", data: {} },
  );
  logger.info("✅ Care reminder scheduler registered");
}
