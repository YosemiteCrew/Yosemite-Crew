import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const ParasiteRiskQueue = new Queue("parasite-risk", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
