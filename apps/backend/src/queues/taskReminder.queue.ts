import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const TaskReminderQueue = new Queue("task-reminder", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

// Schedule: every 1 minute
async function registerRepeatable() {
  await TaskReminderQueue.add(
    "run",
    {},
    {
      repeat: { every: 60_000 }, // 1 minute
      jobId: "task-reminder-repeat",
    },
  );
}

registerRepeatable().catch(console.error);
