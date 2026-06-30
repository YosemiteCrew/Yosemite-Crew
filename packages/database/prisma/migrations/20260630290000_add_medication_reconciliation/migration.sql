-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PENDING_REVIEW');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'MEDICATION_RECONCILIATION_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE 'MEDICATION_RECONCILIATION_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE 'MEDICATION_RECONCILIATION_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLINICAL_NOTE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLINICAL_NOTE_SIGNED';

-- CreateTable
CREATE TABLE "MedicationReconciliation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reconciledBy" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "homeMedications" JSONB NOT NULL DEFAULT '[]',
    "hospitalOrders" JSONB NOT NULL DEFAULT '[]',
    "discrepancies" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationReconciliation_organisationId_patientId_idx" ON "MedicationReconciliation"("organisationId", "patientId");
