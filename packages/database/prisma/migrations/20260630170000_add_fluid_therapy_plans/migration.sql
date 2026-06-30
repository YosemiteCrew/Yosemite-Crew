-- CreateEnum
CREATE TYPE "FluidType" AS ENUM ('SALINE_09', 'LACTATED_RINGERS', 'DEXTROSE_5', 'HARTMANNS', 'PLASMALYTE', 'COLLOID', 'BLOOD_PRODUCT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FluidTherapyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'DISCONTINUED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'FLUID_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'FLUID_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'FLUID_PLAN_DISCONTINUED';

-- CreateTable
CREATE TABLE "FluidTherapyPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "admissionId" TEXT,
    "fluidType" "FluidType" NOT NULL,
    "customFluidName" TEXT,
    "additives" TEXT,
    "rateMlPerHour" DOUBLE PRECISION NOT NULL,
    "totalVolumeMl" DOUBLE PRECISION,
    "durationHours" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "status" "FluidTherapyStatus" NOT NULL DEFAULT 'ACTIVE',
    "indication" TEXT,
    "prescribedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FluidTherapyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FluidTherapyPlan_organisationId_patientId_idx" ON "FluidTherapyPlan"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "FluidTherapyPlan_encounterId_idx" ON "FluidTherapyPlan"("encounterId");
