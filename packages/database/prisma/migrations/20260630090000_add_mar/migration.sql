-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'MAR_ENTRY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'MAR_ENTRY_ADMINISTERED';
ALTER TYPE "AuditEventType" ADD VALUE 'MAR_ENTRY_HELD';
ALTER TYPE "AuditEventType" ADD VALUE 'MAR_ENTRY_MISSED';

-- CreateEnum
CREATE TYPE "MARStatus" AS ENUM ('SCHEDULED', 'GIVEN', 'HELD', 'MISSED', 'REFUSED');

-- CreateTable
CREATE TABLE "MAREntry" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "prescriptionId" TEXT,
    "medicationName" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "administeredAt" TIMESTAMP(3),
    "administeredBy" TEXT,
    "status" "MARStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MAREntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MAREntry_organisationId_patientId_scheduledAt_idx"
    ON "MAREntry"("organisationId", "patientId", "scheduledAt");

CREATE INDEX "MAREntry_organisationId_encounterId_scheduledAt_idx"
    ON "MAREntry"("organisationId", "encounterId", "scheduledAt");

CREATE INDEX "MAREntry_organisationId_patientId_status_idx"
    ON "MAREntry"("organisationId", "patientId", "status");
