-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'CONSENT_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE 'CONSENT_REVOKED';

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM (
    'SURGICAL', 'ANESTHESIA', 'DIAGNOSTIC', 'TREATMENT', 'DATA_SHARING', 'DNR', 'OTHER'
);

CREATE TYPE "ConsentStatus" AS ENUM (
    'ACTIVE', 'REVOKED', 'EXPIRED'
);

-- CreateTable
CREATE TABLE "PatientConsent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "procedureDesc" TEXT,
    "consentedBy" TEXT,
    "consentedByName" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "witnessedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientConsent_organisationId_patientId_status_idx"
    ON "PatientConsent"("organisationId", "patientId", "status");

CREATE INDEX "PatientConsent_organisationId_patientId_idx"
    ON "PatientConsent"("organisationId", "patientId");
