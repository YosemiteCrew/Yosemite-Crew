-- CreateEnum
CREATE TYPE "CauseOfDeathType" AS ENUM (
    'EUTHANASIA', 'NATURAL_DEATH', 'TRAUMATIC_INJURY', 'ACUTE_ILLNESS',
    'CHRONIC_DISEASE', 'SURGICAL_COMPLICATION', 'ANESTHETIC_COMPLICATION',
    'UNKNOWN', 'OTHER'
);
CREATE TYPE "BodyDispositionType" AS ENUM (
    'OWNER_COLLECTED', 'PRIVATE_CREMATION', 'COMMUNAL_CREMATION',
    'AQUAMATION', 'BURIAL', 'NECROPSY_FACILITY', 'DONATED_TO_SCIENCE'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DECEASED_RECORD_CREATED';

-- CreateTable
CREATE TABLE "DeceasedRecord" (
    "id"                 TEXT NOT NULL,
    "organisationId"     TEXT NOT NULL,
    "patientId"          TEXT NOT NULL,
    "deceasedAt"         TIMESTAMP(3) NOT NULL,
    "causeOfDeathType"   "CauseOfDeathType" NOT NULL,
    "causeOfDeathDetail" TEXT,
    "bodyWeightKg"       DOUBLE PRECISION,
    "bodyConditionScore" INTEGER,
    "necropsyRequested"  BOOLEAN NOT NULL DEFAULT false,
    "necropsyFacility"   TEXT,
    "bodyDisposition"    "BodyDispositionType",
    "ownerNotifiedAt"    TIMESTAMP(3),
    "certifiedBy"        TEXT,
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeceasedRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeceasedRecord_patientId_key" ON "DeceasedRecord"("patientId");
CREATE INDEX "DeceasedRecord_organisationId_deceasedAt_idx"
    ON "DeceasedRecord"("organisationId", "deceasedAt");
