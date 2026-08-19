-- CreateEnum
CREATE TYPE "OncologyStage" AS ENUM (
    'STAGE_0', 'STAGE_I', 'STAGE_IA', 'STAGE_IB',
    'STAGE_II', 'STAGE_IIA', 'STAGE_IIB',
    'STAGE_III', 'STAGE_IIIA', 'STAGE_IIIB',
    'STAGE_IV'
);

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ONCOLOGY_ASSESSMENT_RECORDED';

-- CreateTable
CREATE TABLE "OncologyAssessment" (
    "id"                    TEXT NOT NULL,
    "organisationId"        TEXT NOT NULL,
    "patientId"             TEXT NOT NULL,
    "encounterId"           TEXT,
    "assessedAt"            TIMESTAMP(3) NOT NULL,
    "assessedBy"            TEXT,
    "tumorType"             TEXT,
    "primaryTumorStage"     TEXT,
    "nodeStage"             TEXT,
    "metastasisStage"       TEXT,
    "overallStage"          "OncologyStage",
    "chemotherapyProtocol"  TEXT,
    "chemotherapyStartDate" TIMESTAMP(3),
    "chemotherapyCycles"    INTEGER,
    "qualityOfLifeScore"    INTEGER,
    "prognosis"             TEXT,
    "diagnoses"             TEXT[],
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OncologyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OncologyAssessment_organisationId_patientId_idx"
    ON "OncologyAssessment"("organisationId", "patientId");
