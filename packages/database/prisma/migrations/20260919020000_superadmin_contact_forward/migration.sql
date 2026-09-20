-- #3329: the SuperAdmin CRM forward was fire-and-forget. A submission taken
-- while the mirror was unconfigured, refused or unreachable was dropped with a
-- log line, so nothing recorded that it had not arrived and there was nothing
-- to retry.
--
-- One row per submission, keyed by the submission, so a submission can never be
-- queued twice. The forward carries no copy of the message: it is rebuilt from
-- the ContactRequest row at send time, so the personal data exists once.
-- ON DELETE CASCADE, so purging a submission removes its forward with it.
--
-- Purely additive. Rolling back is a plain DROP TABLE; no ContactRequest row is
-- read or rewritten by this migration.

-- CreateTable
CREATE TABLE "SuperadminContactForward" (
    "contactRequestId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperadminContactForward_pkey" PRIMARY KEY ("contactRequestId")
);

-- CreateIndex
CREATE INDEX "SuperadminContactForward_deliveredAt_failedAt_nextAttemptAt_idx" ON "SuperadminContactForward"("deliveredAt", "failedAt", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "SuperadminContactForward" ADD CONSTRAINT "SuperadminContactForward_contactRequestId_fkey" FOREIGN KEY ("contactRequestId") REFERENCES "ContactRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- deployed-code-survives: "SuperadminContactForward" is created a few lines
--   above in this same migration, so no deployed query names the table and the
--   enable takes rows away from no existing reader. Its only readers and
--   writers are the nested create and the drain job shipping in this same PR,
--   which connect as the owning role and bypass RLS, matching every other
--   ENABLE ROW LEVEL SECURITY in this migration set.
-- Deny direct Supabase PostgREST access; the API connects as the owning role.
-- This table keys rows by ContactRequest.id, so leaving it readable would leak
-- the id of every public contact submission to the anon key.
ALTER TABLE "SuperadminContactForward" ENABLE ROW LEVEL SECURITY;
