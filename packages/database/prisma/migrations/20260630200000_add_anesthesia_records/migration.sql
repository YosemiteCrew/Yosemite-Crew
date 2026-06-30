-- Extend existing AnesthesiaType enum with new values
ALTER TYPE "AnesthesiaType" ADD VALUE IF NOT EXISTS 'REGIONAL';
ALTER TYPE "AnesthesiaType" ADD VALUE IF NOT EXISTS 'TOTAL_IV';

-- CreateEnum
CREATE TYPE "AnesthesiaStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'ANESTHESIA_RECORD_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ANESTHESIA_RECORD_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ANESTHESIA_RECORD_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE 'HOSPITALIZATION_OBS_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'PHYSIOTHERAPY_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PHYSIOTHERAPY_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PHYSIOTHERAPY_PLAN_DISCONTINUED';

-- CreateTable
CREATE TABLE "AnesthesiaRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "surgicalProcedureId" TEXT,
    "anesthesiaType" "AnesthesiaType" NOT NULL DEFAULT 'GENERAL',
    "anesthesiologist" TEXT,
    "assistantName" TEXT,
    "preMedication" TEXT,
    "inductionAgent" TEXT,
    "maintenanceAgent" TEXT,
    "oxygenFlowLpm" DECIMAL(65,30),
    "inductionTime" TIMESTAMP(3),
    "intubationTime" TIMESTAMP(3),
    "recoveryStartTime" TIMESTAMP(3),
    "recoveryEndTime" TIMESTAMP(3),
    "complications" TEXT,
    "recoveryNotes" TEXT,
    "status" "AnesthesiaStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnesthesiaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnesthesiaRecord_organisationId_patientId_idx" ON "AnesthesiaRecord"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "AnesthesiaRecord_organisationId_surgicalProcedureId_idx" ON "AnesthesiaRecord"("organisationId", "surgicalProcedureId");
