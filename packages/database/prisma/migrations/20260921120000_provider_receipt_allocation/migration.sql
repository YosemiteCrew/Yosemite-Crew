-- Operator allocation of a captured payment to invoices (#3170 delivery 2).
--
-- The journal recorded every capture and the reconciliation queue made the
-- unattributed ones visible, but the queue was read-only: an operator could
-- see money sitting against no invoice and had no way to apply it. This is the
-- write side.
--
-- Two additions, and they answer different questions. "allocatedAmount" is the
-- running total on the receipt, so the residual an operator may still apply -
-- amount minus refunded minus allocated - can be evaluated inside the same
-- compare-and-set that writes it; a sum over the rows below could not be.
-- "ProviderReceiptAllocation" is the decision itself: who applied what, to
-- which invoice, and whether the money has actually been posted yet.
--
-- Purely additive. A new column with a default reads 0 on every row written
-- before this, which is what those rows mean, and a new table is invisible to
-- the currently running code - so this is safe to apply before the cutover and
-- safe to leave behind on a rollback.
ALTER TABLE "ProviderReceipt" ADD COLUMN     "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill, and it is not optional. A receipt is ALLOCATED precisely when the
-- ingesting path applied it to an invoice in full, so a historical ALLOCATED
-- row has applied its whole amount - and left at the column default it would
-- read as fully available to an operator working the reconciliation queue, who
-- could then apply the same capture a second time to a second invoice.
--
-- Deterministic and idempotent: the status decides, there is no ambiguous
-- record to handle, and re-running it changes nothing. Every other status has
-- applied nothing, which is what the default already says.
UPDATE "ProviderReceipt"
   SET "allocatedAmount" = "amount"
 WHERE "status" = 'ALLOCATED'
   AND "allocatedAmount" = 0;

-- No foreign key to "Invoice" on purpose, matching "ProviderReceipt" itself.
-- This is the record of where money went; a cascade from the invoice it points
-- at would delete exactly the history a reconciliation works from.
CREATE TABLE IF NOT EXISTS "ProviderReceiptAllocation" (
  "id"             TEXT             NOT NULL,
  "receiptId"      TEXT             NOT NULL,
  "invoiceId"      TEXT             NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "idempotencyKey" TEXT             NOT NULL,
  "actorId"        TEXT             NOT NULL,
  "paymentId"      TEXT,
  "appliedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "ProviderReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- Deny direct Supabase PostgREST access; the API connects as the owning role.
ALTER TABLE "ProviderReceiptAllocation" ENABLE ROW LEVEL SECURITY;

-- One allocation per receipt and invoice. This is what makes the readback
-- before posting exact: "has this capture already been applied to this
-- invoice" gets one answer instead of a set of indistinguishable ones, which
-- is how a retry after a timeout avoids posting the money twice.
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderReceiptAllocation_receiptId_invoiceId_key"
  ON "ProviderReceiptAllocation" ("receiptId", "invoiceId");

-- The idempotency lookup is always "this receipt, this key", never a key on
-- its own: a key is scoped to the receipt it was submitted against, so a
-- global index on it would be both wider than the query and wrong as a
-- uniqueness claim.
CREATE INDEX IF NOT EXISTS "ProviderReceiptAllocation_receiptId_idempotencyKey_idx"
  ON "ProviderReceiptAllocation" ("receiptId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "ProviderReceiptAllocation_invoiceId_idx"
  ON "ProviderReceiptAllocation" ("invoiceId");

CREATE INDEX IF NOT EXISTS "ProviderReceiptAllocation_paymentId_idx"
  ON "ProviderReceiptAllocation" ("paymentId");

ALTER TABLE "ProviderReceiptAllocation"
  ADD CONSTRAINT "ProviderReceiptAllocation_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "ProviderReceipt"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
