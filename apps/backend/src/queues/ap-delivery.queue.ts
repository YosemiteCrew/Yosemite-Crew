import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export interface ApDeliveryJobData {
  actorId: string;
  inboxUri: string;
  activity: unknown;
}

export const ApDeliveryQueue = new Queue<ApDeliveryJobData>("ap-delivery", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
