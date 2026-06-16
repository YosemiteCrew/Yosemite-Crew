-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('MEDICAL', 'NON_MEDICAL');

-- AlterTable
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "itemType" "InventoryItemType" NOT NULL DEFAULT 'NON_MEDICAL',
  ADD COLUMN IF NOT EXISTS "attachments" JSONB,
  ADD COLUMN IF NOT EXISTS "genericName" TEXT,
  ADD COLUMN IF NOT EXISTS "strength" TEXT,
  ADD COLUMN IF NOT EXISTS "dosageForm" TEXT,
  ADD COLUMN IF NOT EXISTS "routeOfAdministration" TEXT,
  ADD COLUMN IF NOT EXISTS "drugClass" TEXT,
  ADD COLUMN IF NOT EXISTS "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "controlledItem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "storageInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "expiryTrackingRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unitOfMeasure" TEXT,
  ADD COLUMN IF NOT EXISTS "packageQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "storageLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "minimumStock" INTEGER,
  ADD COLUMN IF NOT EXISTS "emergencyStockLevel" INTEGER,
  ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InventoryVendor"
  ADD COLUMN IF NOT EXISTS "vendorItemCode" TEXT,
  ADD COLUMN IF NOT EXISTS "purchasePrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastPurchaseDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isMedical" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventorySubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_organisationId_sku_key" ON "InventoryItem"("organisationId", "sku");
CREATE INDEX IF NOT EXISTS "InventoryItem_organisationId_category_subCategory_idx" ON "InventoryItem"("organisationId", "category", "subCategory");
CREATE INDEX IF NOT EXISTS "InventoryItem_organisationId_businessType_idx" ON "InventoryItem"("organisationId", "businessType");
CREATE INDEX IF NOT EXISTS "InventoryItem_organisationId_status_idx" ON "InventoryItem"("organisationId", "status");
CREATE INDEX IF NOT EXISTS "InventoryItem_organisationId_vendorId_idx" ON "InventoryItem"("organisationId", "vendorId");

CREATE INDEX IF NOT EXISTS "InventoryVendor_organisationId_vendorItemCode_idx" ON "InventoryVendor"("organisationId", "vendorItemCode");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCategory_code_key" ON "InventoryCategory"("code");
CREATE INDEX IF NOT EXISTS "InventoryCategory_sortOrder_name_idx" ON "InventoryCategory"("sortOrder", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "InventorySubcategory_categoryId_code_key" ON "InventorySubcategory"("categoryId", "code");
CREATE INDEX IF NOT EXISTS "InventorySubcategory_categoryId_idx" ON "InventorySubcategory"("categoryId");
CREATE INDEX IF NOT EXISTS "InventorySubcategory_code_idx" ON "InventorySubcategory"("code");

-- AddForeignKey
ALTER TABLE "InventorySubcategory"
  ADD CONSTRAINT "InventorySubcategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
