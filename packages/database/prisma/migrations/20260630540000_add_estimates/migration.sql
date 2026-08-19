-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM (
    'DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'EXPIRED', 'CONVERTED'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ESTIMATE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ESTIMATE_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ESTIMATE_DECLINED';

-- CreateTable Estimate
CREATE TABLE "Estimate" (
    "id"                   TEXT NOT NULL,
    "organisationId"       TEXT NOT NULL,
    "patientId"            TEXT NOT NULL,
    "encounterId"          TEXT,
    "status"               "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil"           TIMESTAMP(3),
    "subtotal"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"             TEXT NOT NULL DEFAULT 'GBP',
    "notes"                TEXT,
    "approvedBy"           TEXT,
    "approvedAt"           TIMESTAMP(3),
    "declinedAt"           TIMESTAMP(3),
    "declineReason"        TEXT,
    "convertedToInvoiceId" TEXT,
    "createdBy"            TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Estimate_organisationId_patientId_idx" ON "Estimate"("organisationId", "patientId");
CREATE INDEX "Estimate_organisationId_status_idx" ON "Estimate"("organisationId", "status");

-- CreateTable EstimateItem
CREATE TABLE "EstimateItem" (
    "id"          TEXT NOT NULL,
    "estimateId"  TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice"   DOUBLE PRECISION NOT NULL,
    "taxRate"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal"   DOUBLE PRECISION NOT NULL,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EstimateItem_estimateId_idx" ON "EstimateItem"("estimateId");

-- AddForeignKey
ALTER TABLE "EstimateItem"
    ADD CONSTRAINT "EstimateItem_estimateId_fkey"
    FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
