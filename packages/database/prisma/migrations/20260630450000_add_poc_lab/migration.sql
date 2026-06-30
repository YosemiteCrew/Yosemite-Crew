-- CreateEnum
CREATE TYPE "PocTestType" AS ENUM (
    'CBC', 'BLOOD_CHEMISTRY', 'URINALYSIS', 'FECAL_FLOAT',
    'CYTOLOGY', 'COAGULATION', 'ELECTROLYTES', 'THYROID_PANEL',
    'CORTISOL', 'GLUCOSE_CURVE', 'BLOOD_GAS', 'OTHER'
);

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'POC_LAB_RECORDED';

-- CreateTable
CREATE TABLE "PointOfCareLab" (
    "id"                    TEXT NOT NULL,
    "organisationId"        TEXT NOT NULL,
    "patientId"             TEXT NOT NULL,
    "encounterId"           TEXT,
    "conductedAt"           TIMESTAMP(3) NOT NULL,
    "conductedBy"           TEXT,
    "testType"              "PocTestType" NOT NULL,
    "analyzerName"          TEXT,
    "sampleType"            TEXT,
    "results"               JSONB NOT NULL,
    "overallInterpretation" TEXT,
    "abnormalFlags"         TEXT[],
    "criticalFlags"         TEXT[],
    "followUpRecommended"   BOOLEAN,
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointOfCareLab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointOfCareLab_organisationId_patientId_idx"
    ON "PointOfCareLab"("organisationId", "patientId");
CREATE INDEX "PointOfCareLab_organisationId_testType_idx"
    ON "PointOfCareLab"("organisationId", "testType");
