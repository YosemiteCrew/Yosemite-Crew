-- Add inventory consumption rule and event ledger support.
CREATE TYPE "InventoryConsumptionSourceType" AS ENUM ('PRESCRIPTION', 'PACKAGE', 'PROCEDURE');

CREATE TYPE "InventoryConsumptionAction" AS ENUM ('CONSUME', 'RESERVE', 'RELEASE');

CREATE TABLE "InventoryConsumptionRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceType" "InventoryConsumptionSourceType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConsumptionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryConsumptionEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceType" "InventoryConsumptionSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineKey" TEXT,
    "action" "InventoryConsumptionAction" NOT NULL DEFAULT 'CONSUME',
    "idempotencyKey" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConsumptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryConsumptionRule_organisationId_sourceType_sourceKey_inventoryItemId_key"
    ON "InventoryConsumptionRule"("organisationId", "sourceType", "sourceKey", "inventoryItemId");

CREATE INDEX "InventoryConsumptionRule_organisationId_sourceType_sourceKey_idx"
    ON "InventoryConsumptionRule"("organisationId", "sourceType", "sourceKey");

CREATE INDEX "InventoryConsumptionRule_organisationId_inventoryItemId_idx"
    ON "InventoryConsumptionRule"("organisationId", "inventoryItemId");

CREATE UNIQUE INDEX "InventoryConsumptionEvent_idempotencyKey_key"
    ON "InventoryConsumptionEvent"("idempotencyKey");

CREATE INDEX "InventoryConsumptionEvent_organisationId_sourceType_sourceId_idx"
    ON "InventoryConsumptionEvent"("organisationId", "sourceType", "sourceId");

CREATE INDEX "InventoryConsumptionEvent_organisationId_inventoryItemId_idx"
    ON "InventoryConsumptionEvent"("organisationId", "inventoryItemId");
