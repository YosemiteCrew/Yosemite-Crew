import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const PublicBookingQueue = new Queue("public-booking", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

export const PublicBookingJobs = {
  PURGE_EXPIRED_REQUESTS: "PURGE_EXPIRED_REQUESTS",
} as const;
