-- VeNom publishes 28,850 relationships between clinical terms, none of which have ever
-- been imported: there was nowhere to put them. CodeMapping cannot hold them because its
-- unique key carries no relationship type, so one pair could not be both "is a" and "is
-- in container", and it means "the same concept in another system" rather than "sits
-- under".
--
-- CLINICAL_CATEGORY exists because 2,371 of the 2,424 parents in that file are not
-- published in VeNom's Terms sheet at all. They are taxonomy scaffolding and appear only
-- as relationship endpoints. They must be created for the edges to attach to, but must
-- not join the clinical term vocabulary, or autocomplete would start offering
-- "Presenting complaint" as though it were a diagnosis.
--
-- Additive only. No existing table or column is altered.

ALTER TYPE "CodeType" ADD VALUE IF NOT EXISTS 'CLINICAL_CATEGORY';

CREATE TABLE IF NOT EXISTS "CodeRelationship" (
  "id"         TEXT NOT NULL,
  "system"     "CodeSystem" NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "targetCode" TEXT NOT NULL,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodeRelationship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeRelationship_system_sourceCode_type_targetCode_key"
  ON "CodeRelationship"("system", "sourceCode", "type", "targetCode");
CREATE INDEX IF NOT EXISTS "CodeRelationship_system_sourceCode_idx"
  ON "CodeRelationship"("system", "sourceCode");
CREATE INDEX IF NOT EXISTS "CodeRelationship_system_targetCode_idx"
  ON "CodeRelationship"("system", "targetCode");

-- Enable row level security, matching 20260818090000_enable_row_level_security.
-- Enabling with no policy is the intended default: the API connects as the owner and
-- bypasses RLS, while anon and authenticated roles get nothing.
ALTER TABLE "CodeRelationship" ENABLE ROW LEVEL SECURITY;
