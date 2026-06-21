-- Add prescription line-item support, including route.
CREATE TABLE IF NOT EXISTS "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medication" TEXT NOT NULL,
    "strength" TEXT,
    "dosage" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "quantity" TEXT,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PrescriptionItem"
    ADD COLUMN IF NOT EXISTS "route" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'PrescriptionItem'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'Prescription'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PrescriptionItem_prescriptionId_fkey'
  ) THEN
    ALTER TABLE "PrescriptionItem"
      ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey"
      FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PrescriptionItem_prescriptionId_sortOrder_idx"
    ON "PrescriptionItem"("prescriptionId", "sortOrder");
