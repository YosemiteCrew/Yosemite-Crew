-- Estimate to invoice conversion.
--
-- Two additions, both required before `EstimateService.convert` can be correct.

-- CreateEnum value
--
-- `AuditTrailService.recordSafely` swallows every error, so an event type that
-- is missing from this enum produces no audit row and no failure: the conversion
-- would look audited while writing nothing. Converting an estimate creates a
-- financial obligation, so it has to be on the record.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ESTIMATE_CONVERTED';

-- AlterTable
--
-- The back-pointer from the invoice to the estimate that produced it. The
-- service already refuses a second conversion with a conditional update, but
-- that only guards the paths that go through the service. This makes a second
-- invoice for the same estimate impossible at the database level, whatever
-- calls it - a future importer, a script, a second controller.
--
-- Postgres treats NULLs as distinct in a unique index, so every existing
-- invoice (all of which have no estimate) keeps working. Same shape as the
-- existing unique on "appointmentId".
ALTER TABLE "Invoice" ADD COLUMN "estimateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_estimateId_key" ON "Invoice"("estimateId");
