-- CreateEnum
CREATE TYPE "TriagePriority" AS ENUM ('IMMEDIATE', 'URGENT', 'LESS_URGENT', 'STANDARD', 'NON_URGENT');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'EMERGENCY_TRIAGE_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'EMERGENCY_TRIAGE_ESCALATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ICU_CARE_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ICU_CARE_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ICU_CARE_PLAN_DISCHARGED';

-- CreateTable
CREATE TABLE "EmergencyTriage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "triagePriority" "TriagePriority" NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "presentationAt" TIMESTAMP(3) NOT NULL,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "temperature" DECIMAL(65,30),
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "oxygenSaturation" DECIMAL(65,30),
    "capillaryRefillTime" DECIMAL(65,30),
    "mentalStatus" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "escalatedReason" TEXT,
    "triageBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyTriage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyTriage_organisationId_patientId_idx" ON "EmergencyTriage"("organisationId", "patientId");
CREATE INDEX "EmergencyTriage_organisationId_presentationAt_idx" ON "EmergencyTriage"("organisationId", "presentationAt");
