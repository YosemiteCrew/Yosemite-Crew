-- Link a practice's own drug list and stock to the ATCvet spine.
--
-- Nullable by design. A drug whose name matches no ATCvet substance, or matches
-- several (ibuprofen exists under QC01EB16, QG02CC01 and QM01AE01 for different
-- therapeutic uses), stays uncoded: a wrong therapeutic class is worse than an
-- absent one, and the backfill reports both cases for a human to resolve.
ALTER TABLE "DrugFormulary" ADD COLUMN IF NOT EXISTS "atcCode" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "atcCode" TEXT;

CREATE INDEX IF NOT EXISTS "DrugFormulary_atcCode_idx" ON "DrugFormulary"("atcCode");
CREATE INDEX IF NOT EXISTS "InventoryItem_atcCode_idx" ON "InventoryItem"("atcCode");
