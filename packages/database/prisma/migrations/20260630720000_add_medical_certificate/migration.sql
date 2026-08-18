CREATE TYPE "MedicalCertificateType" AS ENUM (
    'HEALTH_CERTIFICATE', 'VACCINATION_CERTIFICATE', 'FIT_FOR_TRAVEL',
    'EXPORT_CERTIFICATE', 'BOARDING_CLEARANCE', 'BREEDING_CLEARANCE', 'OTHER'
);

CREATE TYPE "MedicalCertificateStatus" AS ENUM ('DRAFT', 'ISSUED', 'EXPIRED', 'REVOKED');

CREATE TABLE "MedicalCertificate" (
    "id"                 TEXT NOT NULL,
    "organisationId"     TEXT NOT NULL,
    "patientId"          TEXT NOT NULL,
    "clientId"           TEXT NOT NULL,
    "encounterId"        TEXT,
    "appointmentId"      TEXT,
    "certificateType"    "MedicalCertificateType" NOT NULL,
    "status"             "MedicalCertificateStatus" NOT NULL DEFAULT 'DRAFT',
    "issueNumber"        TEXT,
    "issuedAt"           TIMESTAMP(3),
    "expiresAt"          TIMESTAMP(3),
    "issuedBy"           TEXT,
    "validForTravel"     BOOLEAN NOT NULL DEFAULT false,
    "destinationCountry" TEXT,
    "clinicalFindings"   TEXT,
    "restrictions"       TEXT,
    "notes"              TEXT,
    "revokedAt"          TIMESTAMP(3),
    "revokedReason"      TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MedicalCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicalCertificate_issueNumber_key" ON "MedicalCertificate"("issueNumber");
CREATE INDEX "MedicalCertificate_organisationId_patientId_idx" ON "MedicalCertificate"("organisationId", "patientId");
CREATE INDEX "MedicalCertificate_organisationId_status_idx" ON "MedicalCertificate"("organisationId", "status");
CREATE INDEX "MedicalCertificate_organisationId_certificateType_idx" ON "MedicalCertificate"("organisationId", "certificateType");
CREATE INDEX "MedicalCertificate_organisationId_issuedAt_idx" ON "MedicalCertificate"("organisationId", "issuedAt");

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'MEDICAL_CERTIFICATE_ISSUED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'MEDICAL_CERTIFICATE_REVOKED';
