// src/queues/vaccine.queues.ts
import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const VaccineReminderQueue = new Queue("vaccine-reminder", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
