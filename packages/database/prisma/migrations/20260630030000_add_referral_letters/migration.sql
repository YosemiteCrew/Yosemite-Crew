ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_LETTER_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_LETTER_SIGNED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_LETTER_SENT';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_LETTER_CANCELLED';

CREATE TYPE "ReferralStatus" AS ENUM ('DRAFT', 'SIGNED', 'SENT', 'ACKNOWLEDGED', 'CANCELLED');

CREATE TABLE "ReferralLetter" (
    "id"                  TEXT NOT NULL,
    "organisationId"      TEXT NOT NULL,
    "patientId"           TEXT NOT NULL,
    "encounterId"         TEXT,
    "referringVetId"      TEXT,
    "specialistName"      TEXT,
    "specialistClinic"    TEXT,
    "specialistEmail"     TEXT,
    "reasonForReferral"   TEXT NOT NULL,
    "historySummary"      TEXT,
    "examFindings"        TEXT,
    "currentMedications"  TEXT,
    "additionalNotes"     TEXT,
    "status"              "ReferralStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt"            TIMESTAMP(3),
    "sentAt"              TIMESTAMP(3),
    "documensoEnvelopeId" TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralLetter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReferralLetter_organisationId_patientId_idx"
    ON "ReferralLetter"("organisationId", "patientId");
CREATE INDEX "ReferralLetter_organisationId_status_idx"
    ON "ReferralLetter"("organisationId", "status");
