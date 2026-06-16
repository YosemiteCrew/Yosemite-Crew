import logger from "src/utils/logger";
import { TaskScheduleQueue } from "./task-schedule.queue";

export async function registerTaskScheduleSchedulers() {
  await TaskScheduleQueue.add(
    "run",
    {},
    {
      repeat: { every: 60 * 1000 },
      jobId: "task-schedule-repeat",
    },
  );

  logger.info("✅ Task schedule schedulers registered");
}
