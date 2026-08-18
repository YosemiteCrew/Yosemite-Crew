CREATE TYPE "TreatmentOutcomeType" AS ENUM (
    'RECOVERED', 'IMPROVED', 'STABLE', 'DETERIORATED',
    'DECEASED', 'REFERRED_OUT', 'LOST_TO_FOLLOWUP', 'ONGOING'
);

CREATE TABLE "TreatmentOutcome" (
    "id"              TEXT NOT NULL,
    "organisationId"  TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "encounterId"     TEXT,
    "episodeOfCareId" TEXT,
    "recordedAt"      TIMESTAMP(3) NOT NULL,
    "recordedBy"      TEXT,
    "outcomeType"     "TreatmentOutcomeType" NOT NULL,
    "clinicalNotes"   TEXT,
    "followUpDate"    TIMESTAMP(3),
    "followUpNotes"   TEXT,
    "resolved"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TreatmentOutcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreatmentOutcome_organisationId_patientId_idx" ON "TreatmentOutcome"("organisationId", "patientId");
CREATE INDEX "TreatmentOutcome_organisationId_outcomeType_idx" ON "TreatmentOutcome"("organisationId", "outcomeType");
CREATE INDEX "TreatmentOutcome_organisationId_recordedAt_idx" ON "TreatmentOutcome"("organisationId", "recordedAt");

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'TREATMENT_OUTCOME_RECORDED';
