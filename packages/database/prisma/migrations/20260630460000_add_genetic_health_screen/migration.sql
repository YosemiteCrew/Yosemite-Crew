-- CreateEnum
CREATE TYPE "GeneticTestResult" AS ENUM (
    'CLEAR', 'CARRIER', 'AFFECTED', 'AFFECTED_MINOR',
    'INCONCLUSIVE', 'PENDING'
);

-- CreateEnum
CREATE TYPE "OrthoRating" AS ENUM (
    'EXCELLENT', 'GOOD', 'FAIR', 'BORDERLINE',
    'MILD', 'MODERATE', 'SEVERE', 'NOT_EVALUABLE'
);

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GENETIC_SCREEN_RECORDED';

-- CreateTable
CREATE TABLE "GeneticHealthScreen" (
    "id"                  TEXT NOT NULL,
    "organisationId"      TEXT NOT NULL,
    "patientId"           TEXT NOT NULL,
    "encounterId"         TEXT,
    "screenedAt"          TIMESTAMP(3) NOT NULL,
    "screenedBy"          TEXT,
    "laboratoryName"      TEXT,
    "dnaTests"            JSONB,
    "ofa_hips"            "OrthoRating",
    "ofa_elbows"          "OrthoRating",
    "ofa_patellas"        "OrthoRating",
    "ofa_cardiac"         TEXT,
    "ofa_eyes"            TEXT,
    "certificateNumber"   TEXT,
    "certificationExpiry" TIMESTAMP(3),
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneticHealthScreen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneticHealthScreen_organisationId_patientId_idx"
    ON "GeneticHealthScreen"("organisationId", "patientId");
