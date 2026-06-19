CREATE TABLE "FinanceEvents" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEvents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceEvents_organisationId_idx" ON "FinanceEvents"("organisationId");
CREATE INDEX "FinanceEvents_eventType_idx" ON "FinanceEvents"("eventType");
CREATE INDEX "FinanceEvents_entityType_entityId_idx" ON "FinanceEvents"("entityType", "entityId");
CREATE INDEX "FinanceEvents_occurredAt_idx" ON "FinanceEvents"("occurredAt");
CREATE INDEX "FinanceEvents_processedAt_idx" ON "FinanceEvents"("processedAt");
