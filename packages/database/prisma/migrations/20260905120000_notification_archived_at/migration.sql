-- Record when a notification was archived by its owner.
--
-- Purely additive: a nullable column with no default and no constraint, so the
-- running process serves fine against this schema before the new code cuts over
-- (see #2603). Every existing row reads as not archived without a backfill.
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
