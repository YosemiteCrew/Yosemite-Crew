-- #3144: two staff sessions editing the same clinical record could silently
-- overwrite each other. Every mutable artifact write selected the row by id
-- after reading its state, so the second writer's UPDATE always won regardless
-- of what it had read - including a draft save landing on top of a record a
-- colleague had just finalised.
--
-- This counter is what a write claims against. Additive and NOT NULL with a
-- default, so every existing row is backfilled to 1 by the ALTER itself and no
-- record content is rewritten. Rolling back is a plain DROP COLUMN: the column
-- carries no history, only the current generation number.

-- AlterTable
ALTER TABLE "ClinicalArtifact" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
