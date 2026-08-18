-- CreateEnum
CREATE TYPE "AsaClass" AS ENUM ('ASA_I','ASA_II','ASA_III','ASA_IV','ASA_V','ASA_E');

-- Add AuditEventType value
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PRE_OP_ASSESSMENT_RECORDED';

-- CreateTable
CREATE TABLE "PreOpAssessment" (
    "id"                  TEXT NOT NULL,
    "organisationId"      TEXT NOT NULL,
    "patientId"           TEXT NOT NULL,
    "encounterId"         TEXT NOT NULL,
    "asaClass"            "AsaClass" NOT NULL DEFAULT 'ASA_I',
    "fastingStartedAt"    TIMESTAMP(3),
    "labsReviewed"        BOOLEAN NOT NULL DEFAULT false,
    "ecgReviewed"         BOOLEAN NOT NULL DEFAULT false,
    "ownerConsentSigned"  BOOLEAN NOT NULL DEFAULT false,
    "anesthetistId"       TEXT,
    "surgeonId"           TEXT,
    "plannedProcedure"    TEXT,
    "anesthesiaType"      TEXT,
    "knownAllergies"      TEXT,
    "currentMedications"  TEXT,
    "airwayNotes"         TEXT,
    "cardiovascularNotes" TEXT,
    "notes"               TEXT,
    "assessedBy"          TEXT,
    "assessedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreOpAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PreOpAssessment_organisationId_patientId_idx"   ON "PreOpAssessment"("organisationId", "patientId");
CREATE INDEX "PreOpAssessment_organisationId_encounterId_idx" ON "PreOpAssessment"("organisationId", "encounterId");
