ALTER TABLE "ProviderReceiptRefund" ADD COLUMN "amount" DOUBLE PRECISION;

ALTER TABLE "ProviderReceiptRefund"
ADD CONSTRAINT "ProviderReceiptRefund_amount_check"
CHECK ("amount" IS NULL OR ("amount" > 0 AND "amount" < 'Infinity'::float8));
