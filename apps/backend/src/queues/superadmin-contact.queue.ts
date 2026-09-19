import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const SuperadminContactQueue = new Queue("superadmin-contact-forward", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

export const SuperadminContactJobs = {
  DRAIN_FORWARDS: "DRAIN_FORWARDS",
} as const;
