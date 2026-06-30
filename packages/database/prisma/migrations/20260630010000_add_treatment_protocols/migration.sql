ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PROTOCOL_APPLIED';

CREATE TYPE "TreatmentProtocolSpecies" AS ENUM ('CANINE', 'FELINE', 'AVIAN', 'EXOTIC', 'ALL');
CREATE TYPE "TreatmentProtocolCategory" AS ENUM ('WELLNESS', 'SURGICAL', 'EMERGENCY', 'DENTAL', 'DERMATOLOGY', 'ORTHOPEDIC', 'NUTRITION', 'OTHER');
CREATE TYPE "TreatmentProtocolStepType" AS ENUM ('TASK', 'MEDICATION', 'SERVICE', 'NOTE');
CREATE TYPE "AppliedProtocolStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "TreatmentProtocol" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "species"        "TreatmentProtocolSpecies"  NOT NULL DEFAULT 'ALL',
    "category"       "TreatmentProtocolCategory" NOT NULL DEFAULT 'OTHER',
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdById"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TreatmentProtocol_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TreatmentProtocol_organisationId_isActive_idx"
    ON "TreatmentProtocol"("organisationId", "isActive");
CREATE INDEX "TreatmentProtocol_organisationId_species_category_idx"
    ON "TreatmentProtocol"("organisationId", "species", "category");

CREATE TABLE "TreatmentProtocolStep" (
    "id"               TEXT NOT NULL,
    "protocolId"       TEXT NOT NULL,
    "stepOrder"        INTEGER NOT NULL,
    "stepType"         "TreatmentProtocolStepType" NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "inventoryItemId"  TEXT,
    "doseValue"        DOUBLE PRECISION,
    "doseUnit"         TEXT,
    "routeOfAdmin"     TEXT,
    "frequency"        TEXT,
    "durationDays"     INTEGER,
    "assigneeRole"     TEXT,
    "dueDaysFromStart" INTEGER,
    "serviceCode"      TEXT,
    "unitPrice"        DOUBLE PRECISION,
    "quantity"         INTEGER,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TreatmentProtocolStep_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TreatmentProtocolStep"
    ADD CONSTRAINT "TreatmentProtocolStep_protocolId_fkey"
    FOREIGN KEY ("protocolId") REFERENCES "TreatmentProtocol"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TreatmentProtocolStep_protocolId_stepOrder_idx"
    ON "TreatmentProtocolStep"("protocolId", "stepOrder");

CREATE TABLE "AppliedTreatmentProtocol" (
    "id"             TEXT NOT NULL,
    "protocolId"     TEXT NOT NULL,
    "encounterId"    TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appliedById"    TEXT,
    "status"         "AppliedProtocolStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "appliedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppliedTreatmentProtocol_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AppliedTreatmentProtocol"
    ADD CONSTRAINT "AppliedTreatmentProtocol_protocolId_fkey"
    FOREIGN KEY ("protocolId") REFERENCES "TreatmentProtocol"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AppliedTreatmentProtocol_organisationId_encounterId_idx"
    ON "AppliedTreatmentProtocol"("organisationId", "encounterId");
CREATE INDEX "AppliedTreatmentProtocol_organisationId_patientId_idx"
    ON "AppliedTreatmentProtocol"("organisationId", "patientId");
