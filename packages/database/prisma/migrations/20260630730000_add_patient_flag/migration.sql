CREATE TYPE "PatientFlagType" AS ENUM (
    'AGGRESSION', 'ESCAPE_RISK', 'ALLERGY_WARNING', 'ANXIETY',
    'SPECIAL_HANDLING', 'BILLING_NOTE', 'VIP', 'QUARANTINE', 'OTHER'
);

CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "PatientFlag" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "flagType"       "PatientFlagType" NOT NULL,
    "severity"       "FlagSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdBy"      TEXT,
    "resolvedAt"     TIMESTAMP(3),
    "resolvedBy"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientFlag_organisationId_patientId_isActive_idx" ON "PatientFlag"("organisationId", "patientId", "isActive");
CREATE INDEX "PatientFlag_organisationId_flagType_idx" ON "PatientFlag"("organisationId", "flagType");

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PATIENT_FLAG_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PATIENT_FLAG_RESOLVED';
