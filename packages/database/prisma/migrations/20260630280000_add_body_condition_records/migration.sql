-- CreateEnum
CREATE TYPE "BodyConditionScaleType" AS ENUM ('BCS_5', 'BCS_9');

-- CreateTable
CREATE TABLE "BodyConditionRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "bcsScale" "BodyConditionScaleType" NOT NULL,
    "bcsScore" DECIMAL(65,30) NOT NULL,
    "muscleConditionScore" TEXT,
    "weightKg" DECIMAL(65,30),
    "bodyFatPercentage" DECIMAL(65,30),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyConditionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyConditionRecord_organisationId_patientId_idx" ON "BodyConditionRecord"("organisationId", "patientId");
CREATE INDEX "BodyConditionRecord_organisationId_recordedAt_idx" ON "BodyConditionRecord"("organisationId", "recordedAt");
