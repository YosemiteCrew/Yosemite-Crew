/*
  Warnings:

  - You are about to drop the column `companion` on the `AdverseEventReport` table. All the data in the column will be lost.
  - Added the required column `patient` to the `AdverseEventReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AdverseEventReport"
ADD COLUMN IF NOT EXISTS "patient" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'AdverseEventReport'
      AND column_name = 'companion'
  ) THEN
    EXECUTE 'UPDATE "AdverseEventReport" SET "patient" = COALESCE("patient", "companion") WHERE "patient" IS NULL';
  END IF;
END $$;

ALTER TABLE "AdverseEventReport"
ALTER COLUMN "patient" SET NOT NULL;

ALTER TABLE "AdverseEventReport"
DROP COLUMN IF EXISTS "companion";
