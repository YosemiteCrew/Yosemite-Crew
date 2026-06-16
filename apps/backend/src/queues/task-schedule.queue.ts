import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const TaskScheduleQueue = new Queue("task-schedule", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
