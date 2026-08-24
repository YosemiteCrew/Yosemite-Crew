-- Bind a booking invoice to the Stripe PaymentIntent that produced it.
--
-- `StripeService.handleWebhookEvent` never reads `event.id`: there is no
-- processed-event table, no cache and no lock, so a retried delivery re-runs the
-- whole dispatch. The appointment-booking handler mints an invoice with no
-- unique-violation handler of its own, and the only thing that has ever stopped
-- two concurrent deliveries from minting two invoices is the unique index on
-- "Invoice"."appointmentId".
--
-- That index is going away, because it also refuses a legitimate second invoice
-- for one appointment - a paid deposit plus a later balance. Keying on the
-- payment intent instead separates the two cases the appointment key conflates:
-- a duplicate DELIVERY carries the same intent id, a second CHARGE carries a
-- different one. So this constraint survives that removal, which the one it
-- replaces could not.
--
-- No pre-check for existing duplicates is needed: the column is new, so every
-- row is NULL, and Postgres treats NULLs as distinct in a unique index.
ALTER TABLE "Invoice" ADD COLUMN "providerPaymentIntentId" TEXT;

-- Backfill from settled attempts, but only where the mapping is unambiguous.
--
-- An intent that already resolves to exactly one invoice can be bound now, which
-- means a redelivery of an OLD event is recognised as a replay instead of
-- minting a second invoice the first time this ships. Intents that map to more
-- than one invoice are skipped rather than guessed at; there are none in dev or
-- production today, and a wrong guess here would be worse than no backfill.
--
-- Deliberately before the index: if this statement ever produced a collision the
-- CREATE UNIQUE INDEX would fail and roll the whole migration back, which is the
-- outcome we want.
UPDATE "Invoice" i
SET "providerPaymentIntentId" = a."providerPaymentIntentId"
FROM (
  SELECT "invoiceId", MIN("providerPaymentIntentId") AS "providerPaymentIntentId"
  FROM "PaymentAttempt"
  WHERE "providerPaymentIntentId" IS NOT NULL
  GROUP BY "invoiceId"
  HAVING COUNT(DISTINCT "providerPaymentIntentId") = 1
) a
WHERE a."invoiceId" = i."id"
  AND i."providerPaymentIntentId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "PaymentAttempt" other
    WHERE other."providerPaymentIntentId" = a."providerPaymentIntentId"
      AND other."invoiceId" <> i."id"
  );

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_providerPaymentIntentId_key" ON "Invoice"("providerPaymentIntentId");
