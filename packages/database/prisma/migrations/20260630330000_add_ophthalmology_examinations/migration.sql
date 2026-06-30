-- Migration: Add OphthalmologyExamination table
CREATE TYPE "VisionStatus" AS ENUM ('NORMAL', 'REDUCED', 'ABSENT', 'UNKNOWN');
CREATE TYPE "PLRResponse" AS ENUM ('NORMAL', 'SLUGGISH', 'ABSENT');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'OPHTHALMOLOGY_EXAMINATION_RECORDED';

CREATE TABLE "OphthalmologyExamination" (
  "id"                  TEXT NOT NULL,
  "organisationId"      TEXT NOT NULL,
  "patientId"           TEXT NOT NULL,
  "encounterId"         TEXT,
  "examinedAt"          TIMESTAMP(3) NOT NULL,
  "examinedBy"          TEXT,
  "visionLeft"          "VisionStatus",
  "visionRight"         "VisionStatus",
  "menaceLeft"          BOOLEAN,
  "menaceRight"         BOOLEAN,
  "plrDirectLeft"       "PLRResponse",
  "plrDirectRight"      "PLRResponse",
  "plrConsensualLeft"   "PLRResponse",
  "plrConsensualRight"  "PLRResponse",
  "sttLeft"             INTEGER,
  "sttRight"            INTEGER,
  "iopLeft"             DECIMAL(65, 30),
  "iopRight"            DECIMAL(65, 30),
  "fluoresceinLeft"     BOOLEAN,
  "fluoresceinRight"    BOOLEAN,
  "findingsLeft"        JSONB,
  "findingsRight"       JSONB,
  "diagnoses"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"               TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OphthalmologyExamination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OphthalmologyExamination_organisationId_patientId_idx"
  ON "OphthalmologyExamination"("organisationId", "patientId");
