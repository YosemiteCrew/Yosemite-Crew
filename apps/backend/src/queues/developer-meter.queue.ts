import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const DeveloperMeterQueue = new Queue("developer-meter-delivery", {
  ...defaultQueueOptions,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
});

export const DeveloperMeterJobs = {
  DRAIN_EVENTS: "DRAIN_EVENTS",
} as const;
