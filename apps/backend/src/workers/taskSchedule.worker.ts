import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { TaskScheduleEngine } from "../services/task.schedule.engine";
import logger from "src/utils/logger";

export const TaskScheduleWorker = new Worker(
  "task-schedule",
  async () => {
    logger.info("🗓️ Running Task Schedule Engine...");
    await TaskScheduleEngine.run();
  },
  { connection: redisConnection },
);

TaskScheduleWorker.on("completed", () =>
  logger.info("✅ TaskScheduleEngine completed"),
);

TaskScheduleWorker.on("failed", (_, err) =>
  logger.error("❌ TaskScheduleEngine failed", err),
);
