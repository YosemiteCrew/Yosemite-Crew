import logger from "src/utils/logger";
import { TaskScheduleQueue } from "./task-schedule.queue";

export async function registerTaskScheduleSchedulers() {
  await TaskScheduleQueue.upsertJobScheduler(
    "task-schedule-repeat",
    { every: 60 * 1000 },
    { name: "run", data: {} },
  );

  logger.info("✅ Task schedule schedulers registered");
}
