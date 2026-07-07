import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const DeveloperMaintenanceQueue = new Queue("developer-maintenance", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});
