-- Store the full prescription line-item payload on PrescriptionItem rows.
ALTER TABLE "PrescriptionItem"
    ADD COLUMN IF NOT EXISTS "sourceLineKey" TEXT,
    ADD COLUMN IF NOT EXISTS "refill" TEXT,
    ADD COLUMN IF NOT EXISTS "inventoryItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "inventoryItemSku" TEXT,
    ADD COLUMN IF NOT EXISTS "batchId" TEXT,
    ADD COLUMN IF NOT EXISTS "batchNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "lotNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "metadata" JSONB;
