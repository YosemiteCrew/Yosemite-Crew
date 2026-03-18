import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const LabStatusQueue = new Queue("lab-status", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
