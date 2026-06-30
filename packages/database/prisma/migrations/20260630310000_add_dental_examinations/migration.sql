-- Migration: Add DentalExamination table
CREATE TYPE "DentalGrade" AS ENUM ('GRADE_0', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DENTAL_EXAMINATION_RECORDED';

CREATE TABLE "DentalExamination" (
  "id"             TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "patientId"      TEXT NOT NULL,
  "encounterId"    TEXT,
  "examinedAt"     TIMESTAMP(3) NOT NULL,
  "examinedBy"     TEXT,
  "overallGrade"   "DentalGrade" NOT NULL,
  "findings"       JSONB NOT NULL DEFAULT '[]',
  "calculusScore"  INTEGER,
  "plaqueScore"    INTEGER,
  "gingivalScore"  INTEGER,
  "procedures"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DentalExamination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DentalExamination_organisationId_patientId_idx"
  ON "DentalExamination"("organisationId", "patientId");
