ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_REMINDER_SENT';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_REMINDER_RESPONDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_REMINDER_CANCELLED';

CREATE TYPE "CareReminderType" AS ENUM (
    'VACCINATION_BOOSTER', 'ANNUAL_CHECKUP', 'PARASITE_TREATMENT',
    'DENTAL_CLEANING', 'FOLLOW_UP', 'CUSTOM'
);

CREATE TYPE "CareReminderStatus" AS ENUM (
    'PENDING', 'SENT', 'RESPONDED', 'EXPIRED', 'CANCELLED'
);

CREATE TABLE "CareReminder" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "reminderType"   "CareReminderType" NOT NULL,
    "customMessage"  TEXT,
    "dueDate"        TIMESTAMP(3) NOT NULL,
    "sendAt"         TIMESTAMP(3),
    "status"         "CareReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt"         TIMESTAMP(3),
    "respondedAt"    TIMESTAMP(3),
    "appointmentId"  TEXT,
    "notes"          TEXT,
    "createdBy"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CareReminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareReminder_organisationId_patientId_idx"
    ON "CareReminder"("organisationId", "patientId");
CREATE INDEX "CareReminder_organisationId_status_idx"
    ON "CareReminder"("organisationId", "status");
CREATE INDEX "CareReminder_organisationId_reminderType_idx"
    ON "CareReminder"("organisationId", "reminderType");
CREATE INDEX "CareReminder_organisationId_dueDate_idx"
    ON "CareReminder"("organisationId", "dueDate");
