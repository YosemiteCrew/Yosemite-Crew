-- CreateEnum (BloodType already exists in DB; DonationStatus is new)
CREATE TYPE "DonationStatus" AS ENUM (
    'COLLECTED', 'PROCESSED', 'AVAILABLE', 'TRANSFUSED', 'EXPIRED', 'DISCARDED'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BLOOD_DONOR_REGISTERED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'BLOOD_DONATION_COLLECTED';

-- CreateTable BloodBankDonor
CREATE TABLE "BloodBankDonor" (
    "id"                     TEXT NOT NULL,
    "organisationId"         TEXT NOT NULL,
    "patientId"              TEXT NOT NULL,
    "bloodType"              "BloodType" NOT NULL,
    "lastScreeningAt"        TIMESTAMP(3),
    "lastDonationAt"         TIMESTAMP(3),
    "nextEligibleAt"         TIMESTAMP(3),
    "isActive"               BOOLEAN NOT NULL DEFAULT true,
    "totalDonations"         INTEGER NOT NULL DEFAULT 0,
    "disqualificationReason" TEXT,
    "notes"                  TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodBankDonor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BloodBankDonor_patientId_key" ON "BloodBankDonor"("patientId");
CREATE INDEX "BloodBankDonor_organisationId_bloodType_idx"
    ON "BloodBankDonor"("organisationId", "bloodType");
CREATE INDEX "BloodBankDonor_organisationId_isActive_idx"
    ON "BloodBankDonor"("organisationId", "isActive");

-- CreateTable BloodDonationCollection
CREATE TABLE "BloodDonationCollection" (
    "id"                TEXT NOT NULL,
    "donorId"           TEXT NOT NULL,
    "organisationId"    TEXT NOT NULL,
    "collectedAt"       TIMESTAMP(3) NOT NULL,
    "collectedBy"       TEXT,
    "volumeMl"          DOUBLE PRECISION NOT NULL,
    "anticoagulant"     TEXT,
    "unitId"            TEXT,
    "expiresAt"         TIMESTAMP(3),
    "crossmatchResults" JSONB,
    "status"            "DonationStatus" NOT NULL DEFAULT 'COLLECTED',
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodDonationCollection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BloodDonationCollection_organisationId_status_idx"
    ON "BloodDonationCollection"("organisationId", "status");
CREATE INDEX "BloodDonationCollection_donorId_idx"
    ON "BloodDonationCollection"("donorId");

-- AddForeignKey
ALTER TABLE "BloodDonationCollection"
    ADD CONSTRAINT "BloodDonationCollection_donorId_fkey"
    FOREIGN KEY ("donorId") REFERENCES "BloodBankDonor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
