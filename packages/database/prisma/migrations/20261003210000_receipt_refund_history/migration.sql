CREATE TABLE "ProviderReceiptRefund" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "cumulativeAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderReceiptRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderReceiptRefund_receiptId_providerEventId_key"
ON "ProviderReceiptRefund"("receiptId", "providerEventId");

CREATE INDEX "ProviderReceiptRefund_receiptId_occurredAt_idx"
ON "ProviderReceiptRefund"("receiptId", "occurredAt");

ALTER TABLE "ProviderReceiptRefund" ENABLE ROW LEVEL SECURITY;

-- deployed-code-survives: Existing receipt operations remain unchanged; dated refund history is additional.
