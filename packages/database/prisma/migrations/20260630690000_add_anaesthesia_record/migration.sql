-- CreateEnum
CREATE TYPE "AnaesthesiaStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateTable
CREATE TABLE "AnaesthesiaRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "surgicalProcedureId" TEXT,
    "anaesthetistId" TEXT,
    "inductionAgent" TEXT,
    "maintenanceAgent" TEXT,
    "oxygenFlowLpm" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "preOpAssessment" TEXT,
    "preMedications" JSONB,
    "intraOpNotes" JSONB,
    "complications" TEXT,
    "recoveryNotes" TEXT,
    "status" "AnaesthesiaStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaesthesiaRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnaesthesiaRecord_organisationId_patientId_idx" ON "AnaesthesiaRecord"("organisationId", "patientId");
CREATE INDEX "AnaesthesiaRecord_organisationId_status_idx" ON "AnaesthesiaRecord"("organisationId", "status");
CREATE INDEX "AnaesthesiaRecord_organisationId_appointmentId_idx" ON "AnaesthesiaRecord"("organisationId", "appointmentId");
