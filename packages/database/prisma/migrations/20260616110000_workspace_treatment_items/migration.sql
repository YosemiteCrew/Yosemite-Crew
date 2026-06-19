-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceTreatmentItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "encounterId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVersion" INTEGER,
    "productSnapshot" JSONB NOT NULL,
    "servicePackageKind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceSnapshot" JSONB NOT NULL,
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "invoiceRowId" TEXT,
    "lockState" JSONB,
    "prescriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTreatmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceTreatmentItem_organisationId_encounterId_idx" ON "WorkspaceTreatmentItem"("organisationId", "encounterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceTreatmentItem_organisationId_appointmentId_idx" ON "WorkspaceTreatmentItem"("organisationId", "appointmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceTreatmentItem_organisationId_billingStatus_idx" ON "WorkspaceTreatmentItem"("organisationId", "billingStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceTreatmentItem_invoiceRowId_idx" ON "WorkspaceTreatmentItem"("invoiceRowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceTreatmentItem_prescriptionId_idx" ON "WorkspaceTreatmentItem"("prescriptionId");
