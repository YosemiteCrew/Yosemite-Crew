-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'DISCHARGE_INSTRUCTIONS_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'DISCHARGE_INSTRUCTIONS_SENT';
ALTER TYPE "AuditEventType" ADD VALUE 'DISCHARGE_INSTRUCTIONS_ACKNOWLEDGED';

-- CreateEnum
CREATE TYPE "DischargeStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "DischargeInstruction" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "status" "DischargeStatus" NOT NULL DEFAULT 'DRAFT',
    "medicationSchedule" TEXT,
    "dietaryNotes" TEXT,
    "activityNotes" TEXT,
    "woundCareNotes" TEXT,
    "warningSigns" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "emergencyContact" TEXT,
    "additionalNotes" TEXT,
    "preparedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DischargeInstruction_organisationId_patientId_idx"
    ON "DischargeInstruction"("organisationId", "patientId");

CREATE INDEX "DischargeInstruction_encounterId_idx"
    ON "DischargeInstruction"("encounterId");
