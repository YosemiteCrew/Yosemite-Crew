-- CreateEnum
CREATE TYPE "TransferType" AS ENUM (
    'REFERRAL_SPECIALIST','REFERRAL_EMERGENCY','INTER_HOSPITAL',
    'CLIENT_TRANSFER','DISCHARGE_HOME'
);

-- Add AuditEventType value
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PATIENT_TRANSFER_RECORDED';

-- CreateTable
CREATE TABLE "PatientTransfer" (
    "id"                   TEXT NOT NULL,
    "organisationId"       TEXT NOT NULL,
    "patientId"            TEXT NOT NULL,
    "encounterId"          TEXT,
    "transferType"         "TransferType" NOT NULL,
    "receivingFacility"    TEXT NOT NULL,
    "receivingVetName"     TEXT,
    "receivingVetContact"  TEXT,
    "transferredAt"        TIMESTAMP(3) NOT NULL,
    "transferredBy"        TEXT,
    "chiefComplaint"       TEXT,
    "currentDiagnoses"     TEXT,
    "ongoingTreatments"    TEXT,
    "medicationsDispensed" TEXT,
    "caseSummary"          TEXT,
    "criticalAlerts"       TEXT,
    "ownerInformed"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientTransfer_organisationId_patientId_idx"    ON "PatientTransfer"("organisationId", "patientId");
CREATE INDEX "PatientTransfer_organisationId_transferredAt_idx" ON "PatientTransfer"("organisationId", "transferredAt");
