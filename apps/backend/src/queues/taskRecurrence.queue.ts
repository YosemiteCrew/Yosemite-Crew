import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const TaskRecurrenceQueue = new Queue("task-recurrence", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

// Schedule: every 6 hours
async function registerRepeatable() {
  await TaskRecurrenceQueue.add(
    "run",
    {},
    {
      repeat: { every: 6 * 60 * 60 * 1000 }, // 6 hours
      jobId: "task-recurrence-repeat",
    },
  );
}

registerRepeatable().catch(console.error);
