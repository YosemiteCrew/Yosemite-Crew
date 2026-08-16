import logger from "src/utils/logger";
import { TaskRecurrenceQueue, TaskReminderQueue } from "./task.queues";

export async function registerTaskSchedulers() {
  // 🔄 Recurrence: every 6 hours
  await TaskRecurrenceQueue.upsertJobScheduler(
    "task-recurrence-repeat",
    { every: 6 * 60 * 60 * 1000 },
    { name: "run", data: {} },
  );

  // 🔔 Reminder: every 1 minute
  await TaskReminderQueue.upsertJobScheduler(
    "task-reminder-repeat",
    { every: 60 * 1000 },
    { name: "run", data: {} },
  );

  logger.info("✅ Task schedulers registered");
}
