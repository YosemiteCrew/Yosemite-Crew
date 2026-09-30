-- Supplier purchase orders, their deliveries and returns to the supplier.
-- A delivery and a return each carry a client-supplied key that is unique per
-- order (per delivery for returns), so a retried request cannot receive or
-- return the same stock twice.

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "PurchaseOrderDelivery" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderDeliveryLine" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderDeliveryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderReturn" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "returnedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_organisationId_status_idx" ON "PurchaseOrder"("organisationId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organisationId_orderNumber_key" ON "PurchaseOrder"("organisationId", "orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_vendorId_idx" ON "PurchaseOrderLine"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrderDelivery_vendorId_idx" ON "PurchaseOrderDelivery"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderDelivery_purchaseOrderId_idempotencyKey_key" ON "PurchaseOrderDelivery"("purchaseOrderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PurchaseOrderDeliveryLine_deliveryId_idx" ON "PurchaseOrderDeliveryLine"("deliveryId");

-- CreateIndex
CREATE INDEX "PurchaseOrderDeliveryLine_purchaseOrderLineId_idx" ON "PurchaseOrderDeliveryLine"("purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderDeliveryLine_itemId_idx" ON "PurchaseOrderDeliveryLine"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderDeliveryLine_batchId_idx" ON "PurchaseOrderDeliveryLine"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderReturn_deliveryId_idempotencyKey_key" ON "PurchaseOrderReturn"("deliveryId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderDelivery" ADD CONSTRAINT "PurchaseOrderDelivery_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderDeliveryLine" ADD CONSTRAINT "PurchaseOrderDeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "PurchaseOrderDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderDeliveryLine" ADD CONSTRAINT "PurchaseOrderDeliveryLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderReturn" ADD CONSTRAINT "PurchaseOrderReturn_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "PurchaseOrderDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- deployed-code-survives: every table below is created earlier in this same
--   migration, so no deployed query names any of them and the enable takes rows
--   away from no existing reader. Their only readers and writers are the
--   purchase order service shipping in this same PR, which connects as the
--   owning role and bypasses row-level security, matching every other
--   ENABLE ROW LEVEL SECURITY in this migration set.
-- Deny direct Supabase PostgREST access; the API connects as the owning role.
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderDeliveryLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderReturn" ENABLE ROW LEVEL SECURITY;
