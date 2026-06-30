-- CreateEnum
CREATE TYPE "IcuPlanStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'DISCHARGED', 'DECEASED');

-- CreateTable
CREATE TABLE "IcuCarePlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "status" "IcuPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "admittedAt" TIMESTAMP(3) NOT NULL,
    "onVentilator" BOOLEAN NOT NULL DEFAULT false,
    "onOxygenSupport" BOOLEAN NOT NULL DEFAULT false,
    "hasUrinaryCatheter" BOOLEAN NOT NULL DEFAULT false,
    "hasCentralLine" BOOLEAN NOT NULL DEFAULT false,
    "hasDrain" BOOLEAN NOT NULL DEFAULT false,
    "devices" TEXT,
    "dailyGoals" TEXT,
    "nursingFrequency" TEXT,
    "alertThresholds" TEXT,
    "primaryVet" TEXT,
    "nursePrimary" TEXT,
    "anticipatedDischarge" TIMESTAMP(3),
    "dischargedAt" TIMESTAMP(3),
    "dischargeSummary" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcuCarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IcuCarePlan_organisationId_patientId_idx" ON "IcuCarePlan"("organisationId", "patientId");
CREATE INDEX "IcuCarePlan_organisationId_status_idx" ON "IcuCarePlan"("organisationId", "status");
