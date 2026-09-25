-- Add PurchaseOrder and related models for supplier delivery management
-- This supports receiving partial supplier deliveries by batch, atomic stock posting, and traceable returns

-- Enum for purchase order status
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- PurchaseOrder table
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- PurchaseOrderLine table
CREATE TABLE "PurchaseOrderLine" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- PurchaseOrderDelivery table
CREATE TABLE "PurchaseOrderDelivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "vendorId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderDelivery_pkey" PRIMARY KEY ("id")
);

-- PurchaseOrderDeliveryLine table
CREATE TABLE "PurchaseOrderDeliveryLine" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deliveryId" UUID NOT NULL,
    "purchaseOrderLineId" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderDeliveryLine_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "PurchaseOrder_organisationId_idx" ON "PurchaseOrder"("organisationId");
CREATE INDEX "PurchaseOrder_organisationId_status_idx" ON "PurchaseOrder"("organisationId", "status");
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");
CREATE INDEX "PurchaseOrderLine_vendorId_idx" ON "PurchaseOrderLine"("vendorId");

CREATE INDEX "PurchaseOrderDelivery_purchaseOrderId_idx" ON "PurchaseOrderDelivery"("purchaseOrderId");
CREATE INDEX "PurchaseOrderDelivery_vendorId_idx" ON "PurchaseOrderDelivery"("vendorId");

CREATE INDEX "PurchaseOrderDeliveryLine_deliveryId_idx" ON "PurchaseOrderDeliveryLine"("deliveryId");
CREATE INDEX "PurchaseOrderDeliveryLine_purchaseOrderLineId_idx" ON "PurchaseOrderDeliveryLine"("purchaseOrderLineId");
CREATE INDEX "PurchaseOrderDeliveryLine_itemId_idx" ON "PurchaseOrderDeliveryLine"("itemId");
CREATE INDEX "PurchaseOrderDeliveryLine_batchId_idx" ON "PurchaseOrderDeliveryLine"("batchId");

-- Foreign keys
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderDelivery" ADD CONSTRAINT "PurchaseOrderDelivery_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderDeliveryLine" ADD CONSTRAINT "PurchaseOrderDeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "PurchaseOrderDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderDeliveryLine" ADD CONSTRAINT "PurchaseOrderDeliveryLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- deployed-code-survives: These are new tables with no existing code dependencies.
-- All foreign keys use CASCADE DELETE to maintain referential integrity.
-- The orderNumber is unique to prevent duplicate orders.