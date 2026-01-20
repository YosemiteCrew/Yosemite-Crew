import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export const AppointmentQueue = new Queue("appointments", {
  ...defaultQueueOptions,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

export const AppointmentJobs = {
  MARK_NO_SHOW: "MARK_NO_SHOW",
} as const;