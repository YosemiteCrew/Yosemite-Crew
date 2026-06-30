CREATE TABLE "InventoryCount" (
    "id"              TEXT NOT NULL,
    "organisationId"  TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "countedBy"       TEXT,
    "countedAt"       TIMESTAMP(3) NOT NULL,
    "systemCount"     INTEGER NOT NULL,
    "physicalCount"   INTEGER NOT NULL,
    "discrepancy"     INTEGER NOT NULL,
    "notes"           TEXT,
    "reconciled"      BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt"    TIMESTAMP(3),
    "reconciledBy"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryCount_organisationId_inventoryItemId_idx" ON "InventoryCount"("organisationId", "inventoryItemId");
CREATE INDEX "InventoryCount_organisationId_countedAt_idx" ON "InventoryCount"("organisationId", "countedAt");
CREATE INDEX "InventoryCount_organisationId_reconciled_idx" ON "InventoryCount"("organisationId", "reconciled");

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INVENTORY_COUNT_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INVENTORY_DISCREPANCY_RECONCILED';
