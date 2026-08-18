-- CreateEnum
CREATE TYPE "PainScale" AS ENUM (
  'NUMERIC_0_10',
  'COLORADO_ACUTE_PAIN_SCALE',
  'GLASGOW_COMPOSITE_PAIN_SCALE',
  'UNESP_BOTUCATU',
  'FELINE_GRIMACE_SCALE'
);

-- CreateEnum
CREATE TYPE "PainInterventionType" AS ENUM (
  'ANALGESIC_GIVEN',
  'REPOSITIONED',
  'ICE_APPLIED',
  'BANDAGE_ADJUSTED',
  'ENVIRONMENT_MODIFIED',
  'REASSESSED',
  'OTHER'
);

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'PAIN_ASSESSMENT_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'BODY_CONDITION_RECORDED';

-- CreateTable
CREATE TABLE "PainAssessment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "painScale" "PainScale" NOT NULL,
    "painScore" INTEGER NOT NULL,
    "rawScore" TEXT,
    "behaviouralSigns" TEXT,
    "vocalisation" BOOLEAN,
    "posture" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "assessedBy" TEXT,
    "interventionType" "PainInterventionType",
    "interventionDetail" TEXT,
    "reassessAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PainAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PainAssessment_organisationId_patientId_idx" ON "PainAssessment"("organisationId", "patientId");
CREATE INDEX "PainAssessment_organisationId_assessedAt_idx" ON "PainAssessment"("organisationId", "assessedAt");
