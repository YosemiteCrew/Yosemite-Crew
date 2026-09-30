ALTER TYPE "CareReminderStatus" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_REMINDER_DELIVERY_ATTEMPT';

ALTER TABLE "CareReminder"
  ADD COLUMN "sendingAt" TIMESTAMP(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastDelivery" JSONB;

CREATE INDEX "CareReminder_status_lastAttemptAt_sendAt_idx"
  ON "CareReminder"("status", "lastAttemptAt", "sendAt");
