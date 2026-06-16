-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'TASK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'TASK_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'TASK_REASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'TASK_STATUS_CHANGED';

-- DropIndex
DROP INDEX "InventoryCategory_sortOrder_name_idx";

-- DropIndex
DROP INDEX "InventoryItem_businessType_idx";

-- DropIndex
DROP INDEX "InventoryItem_category_subCategory_idx";

-- DropIndex
DROP INDEX "InventoryItem_status_idx";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assignedGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Task_assignedGroupId_dueAt_idx" ON "Task"("assignedGroupId", "dueAt");

-- RenameIndex
ALTER INDEX "InventoryConsumptionEvent_organisationId_sourceType_sourceId_id" RENAME TO "InventoryConsumptionEvent_organisationId_sourceType_sourceI_idx";

-- RenameIndex
ALTER INDEX "InventoryConsumptionRule_organisationId_sourceType_sourceKey_id" RENAME TO "InventoryConsumptionRule_organisationId_sourceType_sourceKe_idx";

-- RenameIndex
ALTER INDEX "InventoryConsumptionRule_organisationId_sourceType_sourceKey_in" RENAME TO "InventoryConsumptionRule_organisationId_sourceType_sourceKe_key";
