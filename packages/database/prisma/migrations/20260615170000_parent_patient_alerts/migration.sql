-- Add alert payloads to parent and patient records.
ALTER TABLE "Parent"
  ADD COLUMN IF NOT EXISTS "alerts" JSONB;

ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "alerts" JSONB;
