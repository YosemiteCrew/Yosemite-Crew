-- The ingestion journal for captured provider payments (#3170).
--
-- Payment and PaymentAttempt both carry a NOT NULL "invoiceId", so a captured
-- payment that has no invoice cannot be stored at all. The appointment-booking
-- webhook has five exits where the card is already charged and no invoice can
-- be minted; each of them wrote a log line and nothing durable. This table is
-- where the money is recorded first and attributed afterwards, so it
-- deliberately carries no foreign key it could be blocked on.
--
-- The unique key is the provider's own reference, scoped by merchant account,
-- so a redelivered webhook lands on the row it already wrote and two connected
-- accounts stay isolated. "merchantAccountRef" is NOT NULL for that reason:
-- NULLs stay distinct in a Postgres unique index and would let the same
-- reference be journalled twice.

-- CreateEnum
CREATE TYPE "ProviderReceiptStatus" AS ENUM ('UNATTRIBUTED', 'UNALLOCATED', 'ALLOCATED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ProviderReceipt" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "merchantAccountRef" TEXT NOT NULL,
    "paymentRef" TEXT NOT NULL,
    "organisationId" TEXT,
    "invoiceId" TEXT,
    "appointmentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "status" "ProviderReceiptStatus" NOT NULL DEFAULT 'UNATTRIBUTED',
    "reason" TEXT,
    "rawProviderPayload" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderReceipt_provider_merchantAccountRef_paymentRef_key" ON "ProviderReceipt"("provider", "merchantAccountRef", "paymentRef");

-- CreateIndex
CREATE INDEX "ProviderReceipt_organisationId_idx" ON "ProviderReceipt"("organisationId");

-- CreateIndex
CREATE INDEX "ProviderReceipt_status_idx" ON "ProviderReceipt"("status");

-- CreateIndex
CREATE INDEX "ProviderReceipt_invoiceId_idx" ON "ProviderReceipt"("invoiceId");

-- CreateIndex
CREATE INDEX "ProviderReceipt_appointmentId_idx" ON "ProviderReceipt"("appointmentId");

-- CreateIndex
CREATE INDEX "ProviderReceipt_capturedAt_idx" ON "ProviderReceipt"("capturedAt");

-- deployed-code-survives: "ProviderReceipt" is created earlier in this same
--   migration, so no code deployed before it ever queried the table and the
--   RLS enable takes rows away from no existing reader. The only writer is the
--   Stripe webhook service shipping in this same PR, which connects as the
--   owning role and bypasses RLS, matching every other ENABLE ROW LEVEL
--   SECURITY in this migration set.
-- Deny direct Supabase PostgREST access; the API connects as the owning role.
ALTER TABLE "ProviderReceipt" ENABLE ROW LEVEL SECURITY;
