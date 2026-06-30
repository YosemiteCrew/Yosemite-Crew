-- CreateEnum
CREATE TYPE "FormularyCategory" AS ENUM (
    'ANALGESIC','ANTIBIOTIC','ANTIFUNGAL','ANTIPARASITIC','CARDIOVASCULAR',
    'CHEMOTHERAPY','CONTROLLED_SUBSTANCE','DERMATOLOGY','ENDOCRINOLOGY',
    'GASTROINTESTINAL','IMMUNOSUPPRESSANT','NEUROLOGY','OPHTHALMIC',
    'RESPIRATORY','SEDATION_ANESTHESIA','VACCINE','OTHER'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DRUG_FORMULARY_ENTRY_ADDED';

-- CreateTable DrugFormulary
CREATE TABLE "DrugFormulary" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "drugName"       TEXT NOT NULL,
    "genericName"    TEXT,
    "category"       "FormularyCategory" NOT NULL DEFAULT 'OTHER',
    "manufacturer"   TEXT,
    "concentration"  TEXT,
    "availableUnits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugFormulary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrugFormulary_organisationId_isActive_idx"  ON "DrugFormulary"("organisationId", "isActive");
CREATE INDEX "DrugFormulary_organisationId_category_idx"  ON "DrugFormulary"("organisationId", "category");

-- CreateTable DrugFormularyDosage
CREATE TABLE "DrugFormularyDosage" (
    "id"          TEXT NOT NULL,
    "formularyId" TEXT NOT NULL,
    "species"     TEXT NOT NULL,
    "indication"  TEXT,
    "doseMin"     DOUBLE PRECISION,
    "doseMax"     DOUBLE PRECISION,
    "doseUnit"    TEXT,
    "route"       TEXT,
    "frequency"   TEXT,
    "maxDose"     DOUBLE PRECISION,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugFormularyDosage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrugFormularyDosage_formularyId_idx" ON "DrugFormularyDosage"("formularyId");

-- AddForeignKey
ALTER TABLE "DrugFormularyDosage"
    ADD CONSTRAINT "DrugFormularyDosage_formularyId_fkey"
    FOREIGN KEY ("formularyId") REFERENCES "DrugFormulary"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
