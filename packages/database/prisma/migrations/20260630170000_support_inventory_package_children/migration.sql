-- Allow package children to reference either catalog product items or inventory items.
ALTER TABLE "ProductPackageItem"
  ADD COLUMN "inventoryItemId" TEXT;

ALTER TABLE "ProductPackageItem"
  ALTER COLUMN "childProductItemId" DROP NOT NULL;

CREATE INDEX "ProductPackageItem_inventoryItemId_idx"
  ON "ProductPackageItem"("inventoryItemId");

ALTER TABLE "ProductPackageItem"
  ADD CONSTRAINT "ProductPackageItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
