-- CreateEnum
CREATE TYPE "DeaSchedule" AS ENUM ('II', 'III', 'IV', 'V');
CREATE TYPE "DrugUnit" AS ENUM ('ML', 'MG', 'MCG', 'TABLET', 'CAPSULE', 'PATCH', 'UNIT');

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CONTROLLED_SUBSTANCE_LOGGED';

-- CreateTable
CREATE TABLE "ControlledSubstanceLog" (
    "id"                 TEXT NOT NULL,
    "organisationId"     TEXT NOT NULL,
    "patientId"          TEXT,
    "encounterId"        TEXT,
    "loggedAt"           TIMESTAMP(3) NOT NULL,
    "drug"               TEXT NOT NULL,
    "deaSchedule"        "DeaSchedule" NOT NULL,
    "lotNumber"          TEXT,
    "strength"           DOUBLE PRECISION,
    "unit"               "DrugUnit" NOT NULL,
    "amountDrawn"        DOUBLE PRECISION NOT NULL,
    "amountAdministered" DOUBLE PRECISION NOT NULL,
    "amountWasted"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastedWitness"      TEXT,
    "balanceBefore"      DOUBLE PRECISION,
    "balanceAfter"       DOUBLE PRECISION,
    "administeredBy"     TEXT,
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlledSubstanceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ControlledSubstanceLog_organisationId_drug_idx"
    ON "ControlledSubstanceLog"("organisationId", "drug");
CREATE INDEX "ControlledSubstanceLog_organisationId_loggedAt_idx"
    ON "ControlledSubstanceLog"("organisationId", "loggedAt");
