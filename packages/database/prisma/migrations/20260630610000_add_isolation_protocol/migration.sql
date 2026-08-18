-- CreateEnum
CREATE TYPE "IsolationReason" AS ENUM (
    'PARVOVIRUS','DISTEMPER','RINGWORM','MRSA','RESPIRATORY_INFECTION',
    'GASTROINTESTINAL_INFECTION','TICK_BORNE_DISEASE','UNDIAGNOSED_CONTAGIOUS',
    'POST_OP_PRECAUTION','OTHER'
);
CREATE TYPE "IsolationLevel" AS ENUM ('STANDARD','CONTACT','DROPLET','AIRBORNE','STRICT');

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ISOLATION_PROTOCOL_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ISOLATION_PROTOCOL_ENDED';

-- CreateTable
CREATE TABLE "IsolationProtocol" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "reason"         "IsolationReason" NOT NULL DEFAULT 'OTHER',
    "level"          "IsolationLevel"  NOT NULL DEFAULT 'CONTACT',
    "unitId"         TEXT,
    "startedAt"      TIMESTAMP(3) NOT NULL,
    "endedAt"        TIMESTAMP(3),
    "initiatedBy"    TEXT,
    "endedBy"        TEXT,
    "ppe"            TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IsolationProtocol_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IsolationProtocol_organisationId_patientId_idx" ON "IsolationProtocol"("organisationId", "patientId");
CREATE INDEX "IsolationProtocol_organisationId_endedAt_idx"   ON "IsolationProtocol"("organisationId", "endedAt");
