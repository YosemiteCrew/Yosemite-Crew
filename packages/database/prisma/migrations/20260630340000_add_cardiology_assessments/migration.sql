-- Migration: Add CardiologyAssessment table
CREATE TYPE "MurmurGrade" AS ENUM (
  'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6'
);

CREATE TYPE "HeartRhythm" AS ENUM (
  'NORMAL_SINUS',
  'SINUS_ARRHYTHMIA',
  'BRADYCARDIA',
  'TACHYCARDIA',
  'ATRIAL_FIBRILLATION',
  'SECOND_DEGREE_AV_BLOCK',
  'THIRD_DEGREE_AV_BLOCK',
  'VENTRICULAR_PREMATURE_CONTRACTIONS',
  'SUPRAVENTRICULAR_PREMATURE_CONTRACTIONS',
  'OTHER'
);

CREATE TYPE "AcvimClass" AS ENUM ('A', 'B1', 'B2', 'C', 'D');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARDIOLOGY_ASSESSMENT_RECORDED';

CREATE TABLE "CardiologyAssessment" (
  "id"                   TEXT NOT NULL,
  "organisationId"       TEXT NOT NULL,
  "patientId"            TEXT NOT NULL,
  "encounterId"          TEXT,
  "assessedAt"           TIMESTAMP(3) NOT NULL,
  "assessedBy"           TEXT,
  "heartRate"            INTEGER,
  "heartRhythm"          "HeartRhythm",
  "murmurGrade"          "MurmurGrade",
  "murmurLocation"       TEXT,
  "murmurCharacter"      TEXT,
  "pulseQuality"         TEXT,
  "jugularPulse"         TEXT,
  "vertebralHeartScore"  DECIMAL(65, 30),
  "laAoRatio"            DECIMAL(65, 30),
  "fractionalShortening" DECIMAL(65, 30),
  "ejectionFraction"     DECIMAL(65, 30),
  "acvimClass"           "AcvimClass",
  "findings"             JSONB,
  "diagnoses"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"                TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CardiologyAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CardiologyAssessment_organisationId_patientId_idx"
  ON "CardiologyAssessment"("organisationId", "patientId");
