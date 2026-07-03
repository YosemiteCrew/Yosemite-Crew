ALTER TABLE "WorkspaceTreatmentItem"
  ADD COLUMN "settledInvoiceId" TEXT,
  ADD COLUMN "settledAt" TIMESTAMP(3);

UPDATE "WorkspaceTreatmentItem" AS treatment
SET
  "settledInvoiceId" = invoice."id",
  "settledAt" = invoice."paidAt"
FROM "Invoice" AS invoice
WHERE treatment."appointmentId" = invoice."appointmentId"
  AND treatment."billingStatus" = 'BILLED'
  AND invoice."status" = 'PAID';

UPDATE "WorkspaceTreatmentItem"
SET "servicePackageKind" = 'PRESCRIPTION'
WHERE "prescriptionId" IS NOT NULL
  AND "servicePackageKind" NOT IN ('MEDICATION', 'PRESCRIPTION');

CREATE INDEX "WorkspaceTreatmentItem_settledInvoiceId_idx"
  ON "WorkspaceTreatmentItem"("settledInvoiceId");
