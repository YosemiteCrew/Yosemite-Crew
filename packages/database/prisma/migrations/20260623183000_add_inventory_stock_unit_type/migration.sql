-- AlterTable
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "stockUnitType" TEXT;

-- Backfill existing rows from the legacy unit field.
UPDATE "InventoryItem"
SET "stockUnitType" = COALESCE("stockUnitType", "unitOfMeasure")
WHERE "stockUnitType" IS NULL
  AND "unitOfMeasure" IS NOT NULL;
