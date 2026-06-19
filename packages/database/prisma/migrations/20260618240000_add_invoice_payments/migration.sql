CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MANUAL');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('REQUIRES_ACTION', 'REQUIRES_PAYMENT_METHOD', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "BillingCollectionMode" AS ENUM ('PREPAY_AT_BOOKING', 'PAY_AT_VISIT_END', 'STAGED_DURING_VISIT', 'DEPOSIT_THEN_SETTLE', 'MANUAL_OFFLINE');
CREATE TYPE "SettlementChannel" AS ENUM ('STRIPE', 'CASH', 'BANK_TRANSFER', 'CARD_PRESENT', 'DEPOSIT', 'OTHER');

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "settlementChannel" "SettlementChannel",
    "providerPaymentIntentId" TEXT,
    "providerCheckoutSessionId" TEXT,
    "providerPaymentLinkId" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT_METHOD',
    "amountRequested" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountCaptured" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountApplied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "collectionMode" "BillingCollectionMode",
    "isOffline" BOOLEAN NOT NULL DEFAULT false,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "rawProviderPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "settlementChannel" "SettlementChannel",
    "collectionMode" "BillingCollectionMode",
    "providerPaymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "rawProviderPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRefundId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rawProviderPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_paymentAttemptId_key" ON "Payment"("paymentAttemptId");
CREATE INDEX "PaymentAttempt_invoiceId_idx" ON "PaymentAttempt"("invoiceId");
CREATE INDEX "PaymentAttempt_provider_idx" ON "PaymentAttempt"("provider");
CREATE INDEX "PaymentAttempt_providerPaymentIntentId_idx" ON "PaymentAttempt"("providerPaymentIntentId");
CREATE INDEX "PaymentAttempt_providerCheckoutSessionId_idx" ON "PaymentAttempt"("providerCheckoutSessionId");
CREATE INDEX "PaymentAttempt_providerPaymentLinkId_idx" ON "PaymentAttempt"("providerPaymentLinkId");
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_paymentAttemptId_idx" ON "Payment"("paymentAttemptId");
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");
CREATE INDEX "Refund_provider_idx" ON "Refund"("provider");
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_paymentAttemptId_fkey"
FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Invoice'
      AND column_name = 'stripePaymentIntentId'
  ) THEN
    INSERT INTO "PaymentAttempt" (
      "id",
      "invoiceId",
      "provider",
      "settlementChannel",
      "providerPaymentIntentId",
      "providerCheckoutSessionId",
      "providerPaymentLinkId",
      "status",
      "amountRequested",
      "amountCaptured",
      "amountApplied",
      "currency",
      "collectionMode",
      "isOffline",
      "isPartial",
      "rawProviderPayload",
      "createdAt",
      "updatedAt"
    )
    SELECT
      CONCAT('legacy-payment-attempt-', i."id"),
      i."id",
      'STRIPE'::"PaymentProvider",
      'STRIPE'::"SettlementChannel",
      i."stripePaymentIntentId",
      i."stripeCheckoutSessionId",
      i."stripePaymentLinkId",
      CASE
        WHEN i."stripeChargeId" IS NOT NULL THEN 'SUCCEEDED'::"PaymentAttemptStatus"
        WHEN i."stripePaymentIntentId" IS NOT NULL
          OR i."stripeCheckoutSessionId" IS NOT NULL
          OR i."stripePaymentLinkId" IS NOT NULL
          THEN 'PROCESSING'::"PaymentAttemptStatus"
        ELSE 'REQUIRES_PAYMENT_METHOD'::"PaymentAttemptStatus"
      END,
      CASE WHEN i."stripeChargeId" IS NOT NULL THEN i."totalAmount" ELSE 0 END,
      CASE WHEN i."stripeChargeId" IS NOT NULL THEN i."totalAmount" ELSE 0 END,
      CASE WHEN i."stripeChargeId" IS NOT NULL THEN i."totalAmount" ELSE 0 END,
      i."currency",
      i."billingCollectionMode",
      FALSE,
      FALSE,
      jsonb_strip_nulls(
        jsonb_build_object(
          'source', 'legacy-invoice-stripe-columns',
          'invoiceId', i."id",
          'stripePaymentIntentId', i."stripePaymentIntentId",
          'stripePaymentLinkId', i."stripePaymentLinkId",
          'stripeInvoiceId', i."stripeInvoiceId",
          'stripeCustomerId', i."stripeCustomerId",
          'stripeChargeId', i."stripeChargeId",
          'stripeReceiptUrl', i."stripeReceiptUrl",
          'stripeCheckoutSessionId', i."stripeCheckoutSessionId",
          'stripeCheckoutUrl', i."stripeCheckoutUrl"
        )
      ),
      i."createdAt",
      i."updatedAt"
    FROM "Invoice" i
    WHERE i."stripePaymentIntentId" IS NOT NULL
      OR i."stripePaymentLinkId" IS NOT NULL
      OR i."stripeInvoiceId" IS NOT NULL
      OR i."stripeCustomerId" IS NOT NULL
      OR i."stripeChargeId" IS NOT NULL
      OR i."stripeReceiptUrl" IS NOT NULL
      OR i."stripeCheckoutSessionId" IS NOT NULL
      OR i."stripeCheckoutUrl" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "Payment" (
      "id",
      "invoiceId",
      "paymentAttemptId",
      "provider",
      "settlementChannel",
      "collectionMode",
      "providerPaymentId",
      "amount",
      "currency",
      "status",
      "paidAt",
      "receiptUrl",
      "rawProviderPayload",
      "createdAt",
      "updatedAt"
    )
    SELECT
      CONCAT('legacy-payment-', i."id"),
      i."id",
      CONCAT('legacy-payment-attempt-', i."id"),
      'STRIPE'::"PaymentProvider",
      'STRIPE'::"SettlementChannel",
      i."billingCollectionMode",
      i."stripeChargeId",
      i."totalAmount",
      i."currency",
      CASE
        WHEN i."status" = 'REFUNDED' THEN 'REFUNDED'::"PaymentStatus"
        ELSE 'SUCCEEDED'::"PaymentStatus"
      END,
      COALESCE(i."paidAt", i."updatedAt"),
      i."stripeReceiptUrl",
      jsonb_strip_nulls(
        jsonb_build_object(
          'source', 'legacy-invoice-stripe-columns',
          'invoiceId', i."id",
          'stripePaymentIntentId', i."stripePaymentIntentId",
          'stripePaymentLinkId', i."stripePaymentLinkId",
          'stripeInvoiceId', i."stripeInvoiceId",
          'stripeCustomerId', i."stripeCustomerId",
          'stripeChargeId', i."stripeChargeId",
          'stripeReceiptUrl', i."stripeReceiptUrl",
          'stripeCheckoutSessionId', i."stripeCheckoutSessionId",
          'stripeCheckoutUrl', i."stripeCheckoutUrl"
        )
      ),
      i."createdAt",
      i."updatedAt"
    FROM "Invoice" i
    WHERE i."stripeChargeId" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

ALTER TABLE "Invoice"
  DROP COLUMN IF EXISTS "stripePaymentIntentId",
  DROP COLUMN IF EXISTS "stripePaymentLinkId",
  DROP COLUMN IF EXISTS "stripeInvoiceId",
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripeChargeId",
  DROP COLUMN IF EXISTS "stripeReceiptUrl",
  DROP COLUMN IF EXISTS "stripeCheckoutSessionId",
  DROP COLUMN IF EXISTS "stripeCheckoutUrl";
