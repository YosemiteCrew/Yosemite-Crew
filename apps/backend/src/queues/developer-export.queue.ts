import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const DeveloperExportQueue = new Queue("developer-export", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

export const DeveloperExportJobs = {
  RUN_EXPORT: "RUN_EXPORT",
} as const;
