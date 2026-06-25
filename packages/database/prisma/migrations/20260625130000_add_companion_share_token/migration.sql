-- Companion Card share/token state. Identity stays on Patient; this table holds
-- only the tokenized, audience-scoped, revocable grant (a hash of the raw token).
-- References no new AuditEventType value, so it is safe inside one transaction.

-- CreateEnum
CREATE TYPE "CompanionCardAudience" AS ENUM ('PUBLIC', 'OWNER', 'REFERRAL_CLINIC', 'STAFF');

-- CreateTable
CREATE TABLE "CompanionShareToken" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "audience" "CompanionCardAudience" NOT NULL,
    "issuedByType" "AuditActorType",
    "issuedById" TEXT,
    "issuedForOrganisationId" TEXT,
    "showOwnerPhone" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanionShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanionShareToken_tokenHash_key" ON "CompanionShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CompanionShareToken_patientId_idx" ON "CompanionShareToken"("patientId");

-- CreateIndex
CREATE INDEX "CompanionShareToken_organisationId_idx" ON "CompanionShareToken"("organisationId");

-- CreateIndex
CREATE INDEX "CompanionShareToken_organisationId_patientId_idx" ON "CompanionShareToken"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "CompanionShareToken_patientId_audience_idx" ON "CompanionShareToken"("patientId", "audience");

-- CreateIndex
CREATE INDEX "CompanionShareToken_expiresAt_idx" ON "CompanionShareToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "CompanionShareToken"
    ADD CONSTRAINT "CompanionShareToken_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: at most one live PUBLIC token per companion, so
-- regenerating a collar-tag QR revokes the old one. Prisma cannot express a
-- WHERE-filtered unique index, so it is created in raw SQL (mirrors the
-- CompanionOrganisation/PatientOrganisation partial-unique precedent).
CREATE UNIQUE INDEX "CompanionShareToken_active_public_per_patient"
    ON "CompanionShareToken"("patientId")
    WHERE "audience" = 'PUBLIC' AND "revokedAt" IS NULL;
