-- When a companion's breed has no IDEXX counterpart the order is sent with a
-- species-level substitute. That is the right call clinically - a horse should not be
-- refused bloods because VeNom and IDEXX disagree about its breed - but it means the
-- breed on the requisition is not the breed on the record.
--
-- The adapter already reports the substitution, and it was written to the log and then
-- discarded: LabOrderService returned the persisted row, which had nowhere to keep it.
-- A substitution only a server log knows about is not visible to the clinic that has to
-- read the result.
--
-- Additive only, nullable, so every existing order is unaffected.

ALTER TABLE "LabOrder"
  ADD COLUMN IF NOT EXISTS "breedSubstitution" JSONB;
