import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { TaskRecurrenceEngine } from "../services/task.recurrence.engine";
import logger from "src/utils/logger";

export const TaskRecurrenceWorker = new Worker(
  "task-recurrence",
  async () => {
    console.log("🔄 Running Task Recurrence Engine...");
    await TaskRecurrenceEngine.run();
  },
  { connection: redisConnection },
);

TaskRecurrenceWorker.on("completed", () =>
  logger.info("✅ TaskRecurrenceEngine completed"),
);

TaskRecurrenceWorker.on("failed", (job, err) =>
  logger.error("❌ TaskRecurrenceEngine failed", err),
);
