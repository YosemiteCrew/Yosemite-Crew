ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ALLERGY_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ALLERGY_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ALLERGY_RESOLVED';

CREATE TYPE "AllergyType" AS ENUM ('DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER');
CREATE TYPE "AllergySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING');
CREATE TYPE "AllergyStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'UNCONFIRMED');

CREATE TABLE "PatientAllergy" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "allergen"       TEXT NOT NULL,
    "allergyType"    "AllergyType" NOT NULL,
    "severity"       "AllergySeverity" NOT NULL,
    "reaction"       TEXT,
    "status"         "AllergyStatus" NOT NULL DEFAULT 'ACTIVE',
    "onsetDate"      TIMESTAMP(3),
    "resolvedDate"   TIMESTAMP(3),
    "notes"          TEXT,
    "recordedBy"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientAllergy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PatientAllergy_organisationId_patientId_status_idx"
    ON "PatientAllergy"("organisationId", "patientId", "status");
CREATE INDEX "PatientAllergy_organisationId_patientId_idx"
    ON "PatientAllergy"("organisationId", "patientId");
