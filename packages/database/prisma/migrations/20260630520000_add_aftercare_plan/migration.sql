-- CreateEnum
CREATE TYPE "AftercareType" AS ENUM (
    'EUTHANASIA_SERVICE', 'CREMATION_PRIVATE', 'CREMATION_COMMUNAL',
    'AQUAMATION', 'BURIAL', 'HOME_CARE', 'DONATION_TO_SCIENCE'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'AFTERCARE_PLAN_RECORDED';

-- CreateTable
CREATE TABLE "AftercarePlan" (
    "id"                   TEXT NOT NULL,
    "organisationId"       TEXT NOT NULL,
    "patientId"            TEXT NOT NULL,
    "type"                 "AftercareType" NOT NULL,
    "provider"             TEXT,
    "estimatedCost"        DOUBLE PRECISION,
    "depositPaid"          DOUBLE PRECISION,
    "pawPrintRequested"    BOOLEAN NOT NULL DEFAULT false,
    "furClippingRequested" BOOLEAN NOT NULL DEFAULT false,
    "urnsRequested"        INTEGER,
    "instructions"         TEXT,
    "certificateNumber"    TEXT,
    "completedAt"          TIMESTAMP(3),
    "notes"                TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AftercarePlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AftercarePlan_organisationId_patientId_idx"
    ON "AftercarePlan"("organisationId", "patientId");
