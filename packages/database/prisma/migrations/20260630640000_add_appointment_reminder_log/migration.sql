-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM (
    'SMS','EMAIL','PUSH_NOTIFICATION','PHONE_CALL','WHATSAPP'
);
CREATE TYPE "ReminderOutcome" AS ENUM (
    'DELIVERED','OPENED','CONFIRMED','RESCHEDULED','CANCELLED',
    'NO_RESPONSE','BOUNCED','FAILED'
);

-- Add AuditEventType value
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REMINDER_SENT';

-- CreateTable
CREATE TABLE "AppointmentReminderLog" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appointmentId"  TEXT NOT NULL,
    "clientId"       TEXT NOT NULL,
    "channel"        "ReminderChannel" NOT NULL,
    "outcome"        "ReminderOutcome" NOT NULL DEFAULT 'DELIVERED',
    "sentAt"         TIMESTAMP(3) NOT NULL,
    "respondedAt"    TIMESTAMP(3),
    "messagePreview" TEXT,
    "externalId"     TEXT,
    "errorMessage"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentReminderLog_organisationId_appointmentId_idx" ON "AppointmentReminderLog"("organisationId", "appointmentId");
CREATE INDEX "AppointmentReminderLog_organisationId_clientId_idx"      ON "AppointmentReminderLog"("organisationId", "clientId");
