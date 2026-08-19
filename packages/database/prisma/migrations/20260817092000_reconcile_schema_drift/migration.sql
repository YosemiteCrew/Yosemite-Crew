-- Reconciles schema.prisma with the migration history for changes this branch
-- made to the schema without a matching migration.
--
-- None of this was caught earlier because the migration stage only runs when the
-- database workspace is affected, and the run that would have caught it was
-- superseded before it reached this step. `prisma migrate diff` against the
-- committed history reports every statement below.

-- 1. AnesthesiaType gained two members in schema.prisma with no migration.
--    Inserted at their schema positions (before NONE) rather than appended,
--    because the drift check compares enum ORDER, not just membership.
ALTER TYPE "AnesthesiaType" ADD VALUE IF NOT EXISTS 'REGIONAL' BEFORE 'NONE';
ALTER TYPE "AnesthesiaType" ADD VALUE IF NOT EXISTS 'TOTAL_IV' BEFORE 'NONE';

-- 2. These list columns were created WITH a default, but schema.prisma declares
--    them without one. Prisma therefore emits DROP DEFAULT on every diff.
--    Dropping the database default matches the datamodel; the application
--    already supplies these arrays on write, so no row changes.
ALTER TABLE "BehaviorAssessment" ALTER COLUMN "aggressionTriggers" DROP DEFAULT,
ALTER COLUMN "aversionBehaviors" DROP DEFAULT,
ALTER COLUMN "diagnoses" DROP DEFAULT;

ALTER TABLE "CardiologyAssessment" ALTER COLUMN "diagnoses" DROP DEFAULT;

ALTER TABLE "DentalExamination" ALTER COLUMN "findings" DROP DEFAULT,
ALTER COLUMN "procedures" DROP DEFAULT;

ALTER TABLE "DermatologyAssessment" ALTER COLUMN "affectedRegions" DROP DEFAULT,
ALTER COLUMN "primaryLesions" DROP DEFAULT,
ALTER COLUMN "secondaryLesions" DROP DEFAULT,
ALTER COLUMN "environmentalAllergens" DROP DEFAULT,
ALTER COLUMN "diagnoses" DROP DEFAULT;

ALTER TABLE "DrugFormulary" ALTER COLUMN "availableUnits" DROP DEFAULT;

ALTER TABLE "IsolationProtocol" ALTER COLUMN "ppe" DROP DEFAULT;

ALTER TABLE "MedicationReconciliation" ALTER COLUMN "homeMedications" DROP DEFAULT,
ALTER COLUMN "hospitalOrders" DROP DEFAULT;

ALTER TABLE "OphthalmologyExamination" ALTER COLUMN "diagnoses" DROP DEFAULT;

ALTER TABLE "SurgicalProcedure" ALTER COLUMN "assistants" DROP DEFAULT,
ALTER COLUMN "instruments" DROP DEFAULT,
ALTER COLUMN "specimensSent" DROP DEFAULT;
