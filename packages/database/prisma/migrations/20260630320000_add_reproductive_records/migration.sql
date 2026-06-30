-- Migration: Add ReproductiveRecord table
CREATE TYPE "ReproductiveStatus" AS ENUM (
  'INTACT', 'SPAYED', 'NEUTERED', 'CASTRATED', 'UNKNOWN'
);

CREATE TYPE "PregnancyStatus" AS ENUM (
  'SUSPECTED', 'CONFIRMED', 'WHELPED', 'QUEENED', 'ABORTED', 'RESORBED'
);

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REPRODUCTIVE_RECORD_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REPRODUCTIVE_RECORD_UPDATED';

CREATE TABLE "ReproductiveRecord" (
  "id"                    TEXT NOT NULL,
  "organisationId"        TEXT NOT NULL,
  "patientId"             TEXT NOT NULL,
  "reproductiveStatus"    "ReproductiveStatus" NOT NULL,
  "lastHeatDate"          TIMESTAMP(3),
  "nextHeatExpected"      TIMESTAMP(3),
  "matingDate"            TIMESTAMP(3),
  "sireId"                TEXT,
  "sireName"              TEXT,
  "pregnancyStatus"       "PregnancyStatus",
  "pregnancyConfirmedAt"  TIMESTAMP(3),
  "expectedWhelp"         TIMESTAMP(3),
  "litterSizeUltrasound"  INTEGER,
  "litterSizeXray"        INTEGER,
  "actualWhelp"           TIMESTAMP(3),
  "litterSizeBorn"        INTEGER,
  "litterSizeAlive"       INTEGER,
  "recordedBy"            TEXT,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReproductiveRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReproductiveRecord_organisationId_patientId_idx"
  ON "ReproductiveRecord"("organisationId", "patientId");
