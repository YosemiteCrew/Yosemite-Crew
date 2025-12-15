import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { TaskReminderEngine } from "../services/task.reminder.engine";
import logger from "src/utils/logger";

export const TaskReminderWorker = new Worker(
  "task-reminder",
  async () => {
    console.log("🔔 Running Task Reminder Engine...");
    await TaskReminderEngine.run();
  },
  { connection: redisConnection },
);

TaskReminderWorker.on("completed", () =>
  logger.info("✅ TaskReminderEngine completed"),
);

TaskReminderWorker.on("failed", (job, err) =>
  logger.error("❌ TaskReminderEngine failed", err),
);
