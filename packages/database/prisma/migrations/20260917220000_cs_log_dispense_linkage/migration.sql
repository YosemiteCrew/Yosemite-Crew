-- #3142: the prescription dispense and void paths never wrote the controlled
-- substance register. Key a register entry to the stock event that caused it so
-- a dispense is entered exactly once and a void reverses that exact entry.
--
-- Additive and nullable. Existing rows keep NULL in both columns, and Postgres
-- treats NULLs as distinct in a unique index, so the constraint binds only the
-- machine-written entries that carry both values.

-- AlterTable
ALTER TABLE "ControlledSubstanceLog" ADD COLUMN     "inventoryBatchId" TEXT,
ADD COLUMN     "sourceEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ControlledSubstanceLog_sourceEventId_inventoryBatchId_key" ON "ControlledSubstanceLog"("sourceEventId", "inventoryBatchId");
