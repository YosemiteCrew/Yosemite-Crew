-- Every crosswalk in CodeMapping currently asserts exact sameness, because there is
-- nowhere to record anything else. A research cohort built on a narrower mapping treated
-- as equivalent is wrong, and nothing in the data would reveal it.
--
-- This adds the FHIR ConceptMap equivalence vocabulary. The 12,213 existing codings all
-- declare "equivalent" in the source extract, so EQUIVALENT is the correct default and no
-- backfill is needed.
--
-- Note on a related but separate defect, left for the duplicate-collapsing work: 297
-- SNOMED codes have two or more YC concepts mapped to them. Every one of those pairs is
-- species-partitioned, and 180 share an identical display, so these are duplicate
-- concepts rather than false equivalence claims. Relabelling them here would record a
-- wrong equivalence to paper over a wrong concept.
--
-- Additive only. No existing row changes meaning: the default matches what they assert.

-- The complete FHIR R4 ConceptMap equivalence vocabulary, in the order FHIR lists it.
-- A partial set would force a real relationship to be recorded as something it is not.
CREATE TYPE "MappingEquivalence" AS ENUM (
  'RELATEDTO',
  'EQUIVALENT',
  'EQUAL',
  'WIDER',
  'SUBSUMES',
  'NARROWER',
  'SPECIALIZES',
  'INEXACT',
  'UNMATCHED',
  'DISJOINT'
);

ALTER TABLE "CodeMapping"
  ADD COLUMN IF NOT EXISTS "equivalence" "MappingEquivalence" NOT NULL DEFAULT 'EQUIVALENT';
