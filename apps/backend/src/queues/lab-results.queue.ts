import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const LabResultsQueue = new Queue("lab-results", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
