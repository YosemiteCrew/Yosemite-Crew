-- CreateEnum
CREATE TYPE "ConsciousnessLevel" AS ENUM ('ALERT', 'OBTUNDED', 'STUPOR', 'COMA');

-- CreateEnum
CREATE TYPE "GaitScore" AS ENUM ('NORMAL', 'PARETIC', 'ATAXIC', 'NON_AMBULATORY_PARAPLEGIC', 'NON_AMBULATORY_TETRAPLEGIC');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'NEUROLOGY_ASSESSMENT_RECORDED';

-- CreateTable
CREATE TABLE "NeurologyAssessment" (
    "id"                   TEXT NOT NULL,
    "organisationId"       TEXT NOT NULL,
    "patientId"            TEXT NOT NULL,
    "encounterId"          TEXT,
    "assessedAt"           TIMESTAMP(3) NOT NULL,
    "assessedBy"           TEXT,
    "consciousnessLevel"   "ConsciousnessLevel",
    "gaitScore"            "GaitScore",
    "cranialNerveFindings" TEXT,
    "spinalReflexGrades"   JSONB,
    "deepPainPresent"      BOOLEAN,
    "proprioceptionIntact" BOOLEAN,
    "seizureHistory"       BOOLEAN,
    "seizureFrequency"     TEXT,
    "mriRecommended"       BOOLEAN,
    "diagnoses"            TEXT[],
    "notes"                TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeurologyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NeurologyAssessment_organisationId_patientId_idx"
    ON "NeurologyAssessment"("organisationId", "patientId");
