-- Reconcile schema.prisma with the migration history.
--
-- These changes were made to schema.prisma without a matching migration, so a
-- database built by replaying prisma/migrations did not match the schema the
-- client is generated from. Deployed databases were updated out of band, which
-- is why nothing failed in practice. Every statement here is written to be a
-- no-op against a database that already has the change, so this applies cleanly
-- to both a fresh replay and an already-drifted deployment.

-- AlterEnum
-- RenderedDocumentSourceKind gained TASK_SCHEDULE. This is the one statement
-- with runtime consequences: without it, writing that variant against a
-- migration-built database fails.
ALTER TYPE "RenderedDocumentSourceKind" ADD VALUE IF NOT EXISTS 'TASK_SCHEDULE';

-- AlterTable
-- updatedAt is maintained by Prisma's @updatedAt, so the schema declares no
-- database-level default. Earlier migrations left one behind.
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PaymentAttempt" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Refund" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WorkspaceDocumentPacket" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropIndex
-- The tax-provider index moved from InvoiceTaxSnapshot to Invoice.
DROP INDEX IF EXISTS "InvoiceTaxSnapshot_provider_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_taxProvider_idx" ON "Invoice"("taxProvider");

-- RenameIndex
-- Postgres truncates identifiers at 63 characters, so the generated name was
-- cut mid-word; the schema names it explicitly. Guarded because a deployment
-- that already carries the shorter name has nothing to rename.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'PrescriptionDispenseRequest_prescriptionId_status_requestedAt_i'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'PrescriptionDispenseRequest_prescriptionId_status_requested_idx'
  ) THEN
    ALTER INDEX "PrescriptionDispenseRequest_prescriptionId_status_requestedAt_i"
      RENAME TO "PrescriptionDispenseRequest_prescriptionId_status_requested_idx";
  END IF;
END
$$;
