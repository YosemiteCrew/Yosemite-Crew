CREATE TYPE "ClinicNoteSubjectType" AS ENUM ('PATIENT', 'CLIENT', 'APPOINTMENT');
CREATE TYPE "ClinicNoteType" AS ENUM ('GENERAL', 'BILLING', 'COMMUNICATION', 'FOLLOW_UP', 'ALERT');

CREATE TABLE "ClinicNote" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "subjectType"    "ClinicNoteSubjectType" NOT NULL,
    "subjectId"      TEXT NOT NULL,
    "noteType"       "ClinicNoteType" NOT NULL DEFAULT 'GENERAL',
    "content"        TEXT NOT NULL,
    "isPinned"       BOOLEAN NOT NULL DEFAULT false,
    "createdBy"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClinicNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicNote_organisationId_subjectType_subjectId_idx" ON "ClinicNote"("organisationId", "subjectType", "subjectId");
CREATE INDEX "ClinicNote_organisationId_isPinned_idx" ON "ClinicNote"("organisationId", "isPinned");
CREATE INDEX "ClinicNote_organisationId_createdAt_idx" ON "ClinicNote"("organisationId", "createdAt");

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CLINIC_NOTE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CLINIC_NOTE_PINNED';
