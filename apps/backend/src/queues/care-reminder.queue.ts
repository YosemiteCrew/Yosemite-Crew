import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const CareReminderQueue = new Queue("care-reminder", {
  ...defaultQueueOptions,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
});
