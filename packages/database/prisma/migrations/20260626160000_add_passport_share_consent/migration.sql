-- CreateEnum
CREATE TYPE "PassportConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PassportConsentMethod" AS ENUM ('MOBILE', 'EMAIL');

-- CreateTable
CREATE TABLE "PassportShareConsent" (
    "id" TEXT NOT NULL,
    "microchipNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ownerOrganisationId" TEXT NOT NULL,
    "recipientOrganisationId" TEXT NOT NULL,
    "status" "PassportConsentStatus" NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT,
    "requestedBy" TEXT,
    "parentId" TEXT,
    "consentMethod" "PassportConsentMethod",
    "consentedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportShareConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PassportShareConsent_microchipNumber_status_idx" ON "PassportShareConsent"("microchipNumber", "status");

-- CreateIndex
CREATE INDEX "PassportShareConsent_recipientOrganisationId_status_idx" ON "PassportShareConsent"("recipientOrganisationId", "status");

-- CreateIndex
CREATE INDEX "PassportShareConsent_ownerOrganisationId_idx" ON "PassportShareConsent"("ownerOrganisationId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportShareConsent_microchipNumber_ownerOrganisationId_re_key" ON "PassportShareConsent"("microchipNumber", "ownerOrganisationId", "recipientOrganisationId");

