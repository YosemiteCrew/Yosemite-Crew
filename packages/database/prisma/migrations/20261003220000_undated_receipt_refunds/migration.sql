ALTER TABLE "ProviderReceipt"
ADD COLUMN "undatedRefundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "ProviderReceipt"
SET "undatedRefundAmount" = "refundedAmount"
WHERE "refundedAmount" > 0;

CREATE FUNCTION preserve_undated_receipt_refunds() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."refundedAmount" > COALESCE((
    SELECT MAX("cumulativeAmount") FROM "ProviderReceiptRefund"
    WHERE "receiptId" = NEW."id"
  ), 0) THEN
    NEW."undatedRefundAmount" := GREATEST(
      NEW."undatedRefundAmount", NEW."refundedAmount"
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER receipt_refund_history_before_write
BEFORE INSERT OR UPDATE OF "refundedAmount" ON "ProviderReceipt"
FOR EACH ROW EXECUTE FUNCTION preserve_undated_receipt_refunds();
