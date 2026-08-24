-- Recommendation rules: a husbandry task tied to a species, breed and age window,
-- carrying the clinical source it rests on.
--
-- Additive only. Nothing existing is altered; TaskLibraryDefinition gains a
-- back-relation, which is a Prisma-level concept and needs no column here.

CREATE TYPE "RecommendationEvidenceGrade" AS ENUM (
  'CONSENSUS_STATEMENT',
  'PRACTICE_GUIDELINE',
  'POPULATION_STUDY',
  'COHORT_STUDY',
  'CASE_SERIES',
  'EXPERT_OPINION'
);

CREATE TABLE "TaskRecommendationRule" (
  "id"                 TEXT NOT NULL,
  "species"            "TaskLibrarySpecies" NOT NULL,
  -- No NOT NULL here: Prisma treats a scalar list as implicitly non-null and does
  -- not emit the constraint, so adding it would read as drift against the schema.
  "breedCodes"         TEXT[] DEFAULT ARRAY[]::TEXT[],
  "minAgeMonths"       INTEGER,
  "maxAgeMonths"       INTEGER,
  "taskDefinitionId"   TEXT NOT NULL,
  "recommendationText" TEXT NOT NULL,
  "citationAuthors"    TEXT NOT NULL,
  "citationTitle"      TEXT NOT NULL,
  "citationSource"     TEXT NOT NULL,
  "citationYear"       INTEGER NOT NULL,
  "citationDoi"        TEXT,
  "citationUrl"        TEXT,
  "citationClaim"      TEXT NOT NULL,
  "evidenceGrade"      "RecommendationEvidenceGrade" NOT NULL,
  "lastReviewedAt"     TIMESTAMP(3),
  "reviewedBy"         TEXT,
  "nextReviewDue"      TIMESTAMP(3),
  -- Defaults to FALSE, unlike almost every other isActive in this schema. A rule
  -- reaches pet parents only once a named reviewer has signed it off, so a row
  -- inserted by a seed or a migration is inert until someone does.
  "isActive"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskRecommendationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskRecommendationRule_species_isActive_idx"
  ON "TaskRecommendationRule"("species", "isActive");

CREATE INDEX "TaskRecommendationRule_taskDefinitionId_idx"
  ON "TaskRecommendationRule"("taskDefinitionId");

ALTER TABLE "TaskRecommendationRule"
  ADD CONSTRAINT "TaskRecommendationRule_taskDefinitionId_fkey"
  FOREIGN KEY ("taskDefinitionId") REFERENCES "TaskLibraryDefinition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
