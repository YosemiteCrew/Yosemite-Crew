-- CreateEnum
CREATE TYPE "SupplierBillStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "SupplierBillLineType" AS ENUM ('STOCK', 'NON_STOCK_EXPENSE');

-- CreateEnum
CREATE TYPE "SupplierEntryType" AS ENUM ('BILL', 'CREDIT', 'PAYMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "SupplierPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER');

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierBill" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "supplierAccountId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "SupplierBillStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "idempotencyKey" TEXT,
    "expectedVersion" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lineType" "SupplierBillLineType" NOT NULL DEFAULT 'STOCK',
    "description" TEXT NOT NULL,
    "quantityOrdered" DOUBLE PRECISION,
    "quantityReceived" DOUBLE PRECISION,
    "quantityBilled" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseOrderId" TEXT,
    "purchaseOrderLineId" TEXT,
    "receiptId" TEXT,
    "receiptLineId" TEXT,
    "inventoryItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierCredit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "supplierAccountId" TEXT NOT NULL,
    "billId" TEXT,
    "receiptId" TEXT,
    "externalReference" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "documentId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "expectedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierPayment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "supplierAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "SupplierPaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "expectedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierAllocation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "supplierAccountId" TEXT NOT NULL,
    "creditId" TEXT,
    "paymentId" TEXT,
    "billId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplierEntry" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "supplierAccountId" TEXT NOT NULL,
    "type" "SupplierEntryType" NOT NULL,
    "billId" TEXT,
    "creditId" TEXT,
    "paymentId" TEXT,
    "allocationId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierAccount_organisationId_vendorId_currency_key" ON "SupplierAccount"("organisationId", "vendorId", "currency");
CREATE INDEX IF NOT EXISTS "SupplierAccount_organisationId_idx" ON "SupplierAccount"("organisationId");
CREATE INDEX IF NOT EXISTS "SupplierAccount_vendorId_idx" ON "SupplierAccount"("vendorId");

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierBill_organisationId_vendorId_externalReference_key" ON "SupplierBill"("organisationId", "vendorId", "externalReference");
CREATE INDEX IF NOT EXISTS "SupplierBill_organisationId_status_idx" ON "SupplierBill"("organisationId", "status");
CREATE INDEX IF NOT EXISTS "SupplierBill_supplierAccountId_idx" ON "SupplierBill"("supplierAccountId");
CREATE INDEX IF NOT EXISTS "SupplierBill_externalReference_idx" ON "SupplierBill"("externalReference");

CREATE INDEX IF NOT EXISTS "SupplierBillLine_billId_idx" ON "SupplierBillLine"("billId");
CREATE INDEX IF NOT EXISTS "SupplierBillLine_purchaseOrderId_idx" ON "SupplierBillLine"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "SupplierBillLine_receiptId_idx" ON "SupplierBillLine"("receiptId");

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierCredit_organisationId_vendorId_externalReference_key" ON "SupplierCredit"("organisationId", "vendorId", "externalReference");
CREATE INDEX IF NOT EXISTS "SupplierCredit_organisationId_idx" ON "SupplierCredit"("organisationId");
CREATE INDEX IF NOT EXISTS "SupplierCredit_supplierAccountId_idx" ON "SupplierCredit"("supplierAccountId");
CREATE INDEX IF NOT EXISTS "SupplierCredit_billId_idx" ON "SupplierCredit"("billId");
CREATE INDEX IF NOT EXISTS "SupplierCredit_receiptId_idx" ON "SupplierCredit"("receiptId");

CREATE INDEX IF NOT EXISTS "SupplierPayment_organisationId_idx" ON "SupplierPayment"("organisationId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierAccountId_idx" ON "SupplierPayment"("supplierAccountId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_paidAt_idx" ON "SupplierPayment"("paidAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayment_organisationId_vendorId_idempotencyKey_key" ON "SupplierPayment"("organisationId", "vendorId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "SupplierAllocation_organisationId_idx" ON "SupplierAllocation"("organisationId");
CREATE INDEX IF NOT EXISTS "SupplierAllocation_supplierAccountId_idx" ON "SupplierAllocation"("supplierAccountId");
CREATE INDEX IF NOT EXISTS "SupplierAllocation_billId_idx" ON "SupplierAllocation"("billId");
CREATE INDEX IF NOT EXISTS "SupplierAllocation_creditId_idx" ON "SupplierAllocation"("creditId");
CREATE INDEX IF NOT EXISTS "SupplierAllocation_paymentId_idx" ON "SupplierAllocation"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierAllocation_creditId_billId_key" ON "SupplierAllocation"("creditId", "billId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierAllocation_paymentId_billId_key" ON "SupplierAllocation"("paymentId", "billId");

CREATE INDEX IF NOT EXISTS "SupplierEntry_organisationId_vendorId_idx" ON "SupplierEntry"("organisationId", "vendorId");
CREATE INDEX IF NOT EXISTS "SupplierEntry_supplierAccountId_idx" ON "SupplierEntry"("supplierAccountId");
CREATE INDEX IF NOT EXISTS "SupplierEntry_type_idx" ON "SupplierEntry"("type");
CREATE INDEX IF NOT EXISTS "SupplierEntry_billId_idx" ON "SupplierEntry"("billId");
CREATE INDEX IF NOT EXISTS "SupplierEntry_creditId_idx" ON "SupplierEntry"("creditId");
CREATE INDEX IF NOT EXISTS "SupplierEntry_paymentId_idx" ON "SupplierEntry"("paymentId");
CREATE INDEX IF NOT EXISTS "SupplierEntry_createdAt_idx" ON "SupplierEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "SupplierBill"
  ADD CONSTRAINT "SupplierBill_supplierAccountId_fkey"
  FOREIGN KEY ("supplierAccountId") REFERENCES "SupplierAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillLine"
  ADD CONSTRAINT "SupplierBillLine_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCredit"
  ADD CONSTRAINT "SupplierCredit_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierCredit"
  ADD CONSTRAINT "SupplierCredit_supplierAccountId_fkey"
  FOREIGN KEY ("supplierAccountId") REFERENCES "SupplierAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_supplierAccountId_fkey"
  FOREIGN KEY ("supplierAccountId") REFERENCES "SupplierAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAllocation"
  ADD CONSTRAINT "SupplierAllocation_creditId_fkey"
  FOREIGN KEY ("creditId") REFERENCES "SupplierCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierAllocation"
  ADD CONSTRAINT "SupplierAllocation_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierAllocation"
  ADD CONSTRAINT "SupplierAllocation_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAllocation"
  ADD CONSTRAINT "SupplierAllocation_supplierAccountId_fkey"
  FOREIGN KEY ("supplierAccountId") REFERENCES "SupplierAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEntry"
  ADD CONSTRAINT "SupplierEntry_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierEntry"
  ADD CONSTRAINT "SupplierEntry_creditId_fkey"
  FOREIGN KEY ("creditId") REFERENCES "SupplierCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierEntry"
  ADD CONSTRAINT "SupplierEntry_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierEntry"
  ADD CONSTRAINT "SupplierEntry_allocationId_fkey"
  FOREIGN KEY ("allocationId") REFERENCES "SupplierAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierEntry"
  ADD CONSTRAINT "SupplierEntry_supplierAccountId_fkey"
  FOREIGN KEY ("supplierAccountId") REFERENCES "SupplierAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;