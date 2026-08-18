-- CreateEnum
CREATE TYPE "WoundType" AS ENUM ('SURGICAL_INCISION', 'LACERATION', 'PUNCTURE', 'ABRASION', 'BURN', 'PRESSURE_SORE', 'ULCER', 'BITE_WOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "WoundHealingStage" AS ENUM ('HAEMOSTASIS', 'INFLAMMATION', 'PROLIFERATION', 'MATURATION');

-- CreateEnum
CREATE TYPE "WoundHealingStatus" AS ENUM ('HEALING', 'STATIC', 'DETERIORATING', 'HEALED', 'COMPLICATED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'WOUND_ASSESSMENT_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATHOLOGY_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATHOLOGY_RESULTS_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATHOLOGY_REVIEWED';

-- CreateTable
CREATE TABLE "WoundAssessment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "surgicalProcedureId" TEXT,
    "woundType" "WoundType" NOT NULL,
    "location" TEXT NOT NULL,
    "lengthCm" DECIMAL(65,30),
    "widthCm" DECIMAL(65,30),
    "depthCm" DECIMAL(65,30),
    "healingStage" "WoundHealingStage",
    "healingStatus" "WoundHealingStatus" NOT NULL DEFAULT 'HEALING',
    "exudateType" TEXT,
    "exudateAmount" TEXT,
    "odour" TEXT,
    "woundBed" TEXT,
    "woundEdges" TEXT,
    "periwoundSkin" TEXT,
    "dressing" TEXT,
    "dressingChangeFreq" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "assessedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WoundAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WoundAssessment_organisationId_patientId_idx" ON "WoundAssessment"("organisationId", "patientId");
CREATE INDEX "WoundAssessment_organisationId_surgicalProcedureId_idx" ON "WoundAssessment"("organisationId", "surgicalProcedureId");
CREATE INDEX "WoundAssessment_assessedAt_idx" ON "WoundAssessment"("assessedAt");
