ALTER TYPE "TemplateKind" ADD VALUE IF NOT EXISTS 'INVOICE';
ALTER TYPE "RenderedDocumentSourceKind" ADD VALUE IF NOT EXISTS 'INVOICE';

ALTER TABLE "Invoice"
ADD COLUMN "readyForBillingAt" TIMESTAMP(3),
ADD COLUMN "readyForBillingActorId" TEXT;

CREATE INDEX "Invoice_readyForBillingAt_idx" ON "Invoice"("readyForBillingAt");
