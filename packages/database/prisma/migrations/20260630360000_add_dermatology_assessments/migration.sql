-- Migration: Add DermatologyAssessment table
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DERMATOLOGY_ASSESSMENT_RECORDED';

CREATE TABLE "DermatologyAssessment" (
  "id"                    TEXT NOT NULL,
  "organisationId"        TEXT NOT NULL,
  "patientId"             TEXT NOT NULL,
  "encounterId"           TEXT,
  "assessedAt"            TIMESTAMP(3) NOT NULL,
  "assessedBy"            TEXT,
  "pruritusScore"         INTEGER,
  "affectedRegions"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "primaryLesions"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "secondaryLesions"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "coatQuality"           TEXT,
  "lesionMap"             JSONB,
  "environmentalAllergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "foodTrialStatus"       TEXT,
  "cades04Score"          INTEGER,
  "diagnoses"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DermatologyAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DermatologyAssessment_organisationId_patientId_idx"
  ON "DermatologyAssessment"("organisationId", "patientId");
