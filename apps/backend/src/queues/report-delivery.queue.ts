import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const ReportDeliveryQueue = new Queue("report-delivery", {
  ...defaultQueueOptions,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
});
