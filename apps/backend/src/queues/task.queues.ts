// src/queues/task.queues.ts
import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const TaskRecurrenceQueue = new Queue("task-recurrence", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

export const TaskReminderQueue = new Queue("task-reminder", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
