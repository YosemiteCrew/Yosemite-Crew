CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerEventRef" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedWebhookEvent_providerEventRef_providerId_key"
    ON "ProcessedWebhookEvent"("providerEventRef", "providerId");

CREATE INDEX "ProcessedWebhookEvent_processedAt_idx"
    ON "ProcessedWebhookEvent"("processedAt");
