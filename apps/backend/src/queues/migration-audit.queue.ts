import { Queue } from "bullmq";
import { defaultQueueOptions } from "./bull.config";

export interface MigrationAuditJobData {
  auditRunId: string;
}

export const MigrationAuditQueue = new Queue<MigrationAuditJobData>(
  "migration-audit",
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3_000 },
      removeOnComplete: true,
      removeOnFail: 200,
    },
  },
);

export const MigrationAuditJobs = {
  RUN: "run",
} as const;
