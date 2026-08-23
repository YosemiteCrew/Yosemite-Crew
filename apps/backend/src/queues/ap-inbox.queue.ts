import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export interface ApInboxJobData {
  targetOrgId: string;
  rawBody: string;
  headers: Record<string, string>;
  requestUrl: string;
  requestMethod: string;
}

export const ApInboxQueue = new Queue<ApInboxJobData>("ap-inbox", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3_000 },
    removeOnComplete: true,
    removeOnFail: 200,
  },
});
