ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INSURANCE_CLAIM_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INSURANCE_CLAIM_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INSURANCE_CLAIM_STATUS_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INSURANCE_CLAIM_CANCELLED';

CREATE TYPE "InsuranceClaimStatus" AS ENUM (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
    'PARTIALLY_APPROVED', 'REJECTED', 'PAID', 'CANCELLED'
);

CREATE TABLE "InsuranceClaim" (
    "id"               TEXT NOT NULL,
    "organisationId"   TEXT NOT NULL,
    "patientId"        TEXT NOT NULL,
    "invoiceId"        TEXT,
    "encounterId"      TEXT,
    "insurerName"      TEXT NOT NULL,
    "policyNumber"     TEXT NOT NULL,
    "claimNumber"      TEXT,
    "submittedAmount"  DOUBLE PRECISION NOT NULL,
    "approvedAmount"   DOUBLE PRECISION,
    "paidAmount"       DOUBLE PRECISION,
    "currency"         TEXT NOT NULL DEFAULT 'GBP',
    "status"           "InsuranceClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt"      TIMESTAMP(3),
    "approvedAt"       TIMESTAMP(3),
    "paidAt"           TIMESTAMP(3),
    "rejectionReason"  TEXT,
    "notes"            TEXT,
    "externalClaimRef" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InsuranceClaim_organisationId_patientId_idx"
    ON "InsuranceClaim"("organisationId", "patientId");
CREATE INDEX "InsuranceClaim_organisationId_status_idx"
    ON "InsuranceClaim"("organisationId", "status");
CREATE INDEX "InsuranceClaim_organisationId_invoiceId_idx"
    ON "InsuranceClaim"("organisationId", "invoiceId");
