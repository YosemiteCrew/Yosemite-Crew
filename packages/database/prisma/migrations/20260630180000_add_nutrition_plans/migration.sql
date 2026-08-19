-- CreateEnum
CREATE TYPE "NutritionPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'NUTRITION_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'NUTRITION_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'NUTRITION_PLAN_DISCONTINUED';

-- CreateTable
CREATE TABLE "NutritionPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "status" "NutritionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "dietName" TEXT NOT NULL,
    "calories" DOUBLE PRECISION,
    "calorieUnit" TEXT,
    "protein" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "fibre" DOUBLE PRECISION,
    "feedingFrequency" TEXT,
    "portionSize" TEXT,
    "waterIntake" TEXT,
    "restrictions" TEXT,
    "indication" TEXT,
    "prescribedBy" TEXT,
    "reviewDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NutritionPlan_organisationId_patientId_idx" ON "NutritionPlan"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "NutritionPlan_encounterId_idx" ON "NutritionPlan"("encounterId");
