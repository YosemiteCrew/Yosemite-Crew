CREATE TYPE "TaxProvider" AS ENUM ('STRIPE');
CREATE TYPE "TaxBehavior" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

ALTER TABLE "Invoice"
ADD COLUMN "taxProvider" "TaxProvider";

CREATE TABLE "InvoiceTaxSnapshot" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "provider" "TaxProvider" NOT NULL,
    "providerReferenceId" TEXT,
    "jurisdictionCountry" TEXT,
    "jurisdictionState" TEXT,
    "taxBehavior" "TaxBehavior",
    "taxableSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxBreakdown" JSONB,
    "rawProviderPayload" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTaxSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceTaxSnapshot_invoiceId_key" ON "InvoiceTaxSnapshot"("invoiceId");
CREATE INDEX "InvoiceTaxSnapshot_provider_idx" ON "InvoiceTaxSnapshot"("provider");

ALTER TABLE "InvoiceTaxSnapshot"
ADD CONSTRAINT "InvoiceTaxSnapshot_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
