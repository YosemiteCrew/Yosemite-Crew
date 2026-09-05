-- Hold an IDEXX result that could not be applied, instead of refusing the batch.
--
-- IDEXX confirms a BATCH, not a row, and the poll is global: one client built
-- from IDEXX_GLOBAL_USERNAME, with organisationId derived per result. So
-- leaving a batch unconfirmed because one row's status did not map halts lab
-- ingestion for EVERY organisation until the mapper learns that value - the
-- unconfirmed batch is re-fetched next poll and hits the same row again.
-- Recording the row here is what makes confirming the rest of the batch safe:
-- the skipped transition is held and replayable, not lost.
--
-- Purely additive. A new table is invisible to the currently running code, so
-- this is safe to apply before the cutover and safe to leave behind on a
-- rollback; nothing existing is altered, renamed or constrained.
--
-- No unique key on purpose. The failure this table exists to prevent is a
-- result disappearing silently, and an upsert key would do exactly that to two
-- rows in one batch that both arrived without a resultId.
CREATE TABLE IF NOT EXISTS "LabResultQuarantine" (
  "id"             TEXT         NOT NULL,
  "provider"       TEXT         NOT NULL,
  "batchId"        TEXT         NOT NULL,
  "resultId"       TEXT,
  "orderId"        TEXT,
  "labOrderId"     TEXT,
  "organisationId" TEXT,
  "reason"         TEXT         NOT NULL,
  "externalStatus" TEXT,
  "statusDetail"   TEXT,
  "modality"       TEXT,
  "payload"        JSONB,
  "resolvedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LabResultQuarantine_pkey" PRIMARY KEY ("id")
);

-- Deny direct Supabase PostgREST access; the API connects as the owning role.
ALTER TABLE "LabResultQuarantine" ENABLE ROW LEVEL SECURITY;

-- The operator read is "what is still stuck for this provider", so resolvedAt
-- follows provider in the index rather than standing alone.
CREATE INDEX IF NOT EXISTS "LabResultQuarantine_provider_resolvedAt_idx"
  ON "LabResultQuarantine" ("provider", "resolvedAt");

CREATE INDEX IF NOT EXISTS "LabResultQuarantine_provider_resultId_idx"
  ON "LabResultQuarantine" ("provider", "resultId");

CREATE INDEX IF NOT EXISTS "LabResultQuarantine_organisationId_idx"
  ON "LabResultQuarantine" ("organisationId");
