CREATE TYPE "InventoryCountResolution" AS ENUM ('STOCK_ADJUSTED', 'NO_CHANGE');

ALTER TABLE "InventoryCount"
ADD COLUMN "inventoryBatchId" TEXT,
ADD COLUMN "resolution" "InventoryCountResolution",
ADD COLUMN "resolutionNotes" TEXT;

CREATE INDEX "InventoryCount_organisationId_inventoryBatchId_idx"
ON "InventoryCount"("organisationId", "inventoryBatchId");
