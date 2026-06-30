-- Migration: Add BehaviorAssessment table
CREATE TYPE "FasScore" AS ENUM ('FAS_0', 'FAS_1', 'FAS_2', 'FAS_3', 'FAS_4', 'FAS_5');
CREATE TYPE "HandlingTolerance" AS ENUM ('EASY', 'MODERATE', 'DIFFICULT', 'EXTREME');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BEHAVIOR_ASSESSMENT_RECORDED';

CREATE TABLE "BehaviorAssessment" (
  "id"                  TEXT NOT NULL,
  "organisationId"      TEXT NOT NULL,
  "patientId"           TEXT NOT NULL,
  "encounterId"         TEXT,
  "assessedAt"          TIMESTAMP(3) NOT NULL,
  "assessedBy"          TEXT,
  "fasScore"            "FasScore",
  "nailTrimTolerance"   "HandlingTolerance",
  "handlingTolerance"   "HandlingTolerance",
  "aggressionTriggers"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aversionBehaviors"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "trainingHistory"     TEXT,
  "diagnoses"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "referralRecommended" BOOLEAN,
  "fearFreeNotes"       TEXT,
  "notes"               TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BehaviorAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BehaviorAssessment_organisationId_patientId_idx"
  ON "BehaviorAssessment"("organisationId", "patientId");
