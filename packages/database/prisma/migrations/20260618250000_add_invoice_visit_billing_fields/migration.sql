DO $$
BEGIN
  CREATE TYPE "InvoiceVisitBillingStage" AS ENUM ('DRAFT', 'READY_FOR_BILLING', 'SETTLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Invoice"
  ADD COLUMN "billingCollectionMode" "BillingCollectionMode" NOT NULL DEFAULT 'PREPAY_AT_BOOKING',
  ADD COLUMN "visitBillingStage" "InvoiceVisitBillingStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "depositTargetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "depositCollectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Invoice"
SET
  "billingCollectionMode" = CASE
    WHEN "paymentCollectionMethod" = 'PAYMENT_AT_CLINIC' THEN 'PAY_AT_VISIT_END'
    ELSE 'PREPAY_AT_BOOKING'
  END::"BillingCollectionMode",
  "visitBillingStage" = CASE
    WHEN "status" IN ('PAID', 'REFUNDED') THEN 'SETTLED'
    WHEN "paymentCollectionMethod" = 'PAYMENT_AT_CLINIC' THEN 'READY_FOR_BILLING'
    ELSE 'DRAFT'
  END::"InvoiceVisitBillingStage",
  "depositTargetAmount" = 0,
  "depositCollectedAmount" = 0;

CREATE INDEX IF NOT EXISTS "Invoice_billingCollectionMode_idx" ON "Invoice"("billingCollectionMode");
CREATE INDEX IF NOT EXISTS "Invoice_visitBillingStage_idx" ON "Invoice"("visitBillingStage");
