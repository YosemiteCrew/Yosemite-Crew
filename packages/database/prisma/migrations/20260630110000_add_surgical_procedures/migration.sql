-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'SURGERY_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'SURGERY_OUTCOME_UPDATED';

-- CreateEnum
CREATE TYPE "SurgeryOutcome" AS ENUM (
    'SUCCESS', 'COMPLICATION', 'ABANDONED', 'PENDING'
);

CREATE TYPE "AnesthesiaType" AS ENUM (
    'GENERAL', 'LOCAL', 'SEDATION', 'EPIDURAL', 'NONE'
);

-- CreateTable
CREATE TABLE "SurgicalProcedure" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "procedureName" TEXT NOT NULL,
    "surgeon" TEXT,
    "assistants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anesthesiaType" "AnesthesiaType" NOT NULL DEFAULT 'NONE',
    "anesthesiaAgent" TEXT,
    "anesthesiaDoseMs" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "outcome" "SurgeryOutcome" NOT NULL DEFAULT 'PENDING',
    "complications" TEXT,
    "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specimensSent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postOpNotes" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgicalProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurgicalProcedure_organisationId_patientId_idx"
    ON "SurgicalProcedure"("organisationId", "patientId");

CREATE INDEX "SurgicalProcedure_organisationId_patientId_outcome_idx"
    ON "SurgicalProcedure"("organisationId", "patientId", "outcome");

CREATE INDEX "SurgicalProcedure_encounterId_idx"
    ON "SurgicalProcedure"("encounterId");
