-- CreateEnum
CREATE TYPE "AppetiteScore" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NONE');

-- CreateEnum
CREATE TYPE "FeedingRoute" AS ENUM (
    'ORAL', 'NASOGASTRIC', 'ESOPHAGOSTOMY', 'GASTROSTOMY', 'IV_PARENTERAL'
);

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'NUTRITION_ASSESSMENT_RECORDED';

-- CreateTable
CREATE TABLE "NutritionAssessment" (
    "id"                       TEXT NOT NULL,
    "organisationId"           TEXT NOT NULL,
    "patientId"                TEXT NOT NULL,
    "encounterId"              TEXT,
    "assessedAt"               TIMESTAMP(3) NOT NULL,
    "assessedBy"               TEXT,
    "appetiteScore"            "AppetiteScore",
    "bodyConditionScore"       INTEGER,
    "muscleConditionScore"     INTEGER,
    "currentWeightKg"          DOUBLE PRECISION,
    "idealWeightKg"            DOUBLE PRECISION,
    "restingEnergyRequirement" DOUBLE PRECISION,
    "feedingRoute"             "FeedingRoute",
    "currentDiet"              TEXT,
    "feedingPlan"              TEXT,
    "supplementation"          TEXT[],
    "hydrationStatus"          TEXT,
    "diagnoses"                TEXT[],
    "notes"                    TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NutritionAssessment_organisationId_patientId_idx"
    ON "NutritionAssessment"("organisationId", "patientId");
