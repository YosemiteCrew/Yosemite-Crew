-- Add a CONSENT member to TemplateKind so consent templates/documents can be
-- told apart from plain forms at the DB level.
--
-- Additive only: existing rows keep whatever kind they already have (most
-- pre-existing consent templates are stored as FORM, since CONSENT never
-- existed as a value to pick) - nothing here backfills or relabels them.
-- Postgres allows ADD VALUE outside an explicit transaction from PG12+; this
-- migration only adds the value and does not use it, so it is safe to run as
-- Prisma's own single-statement transaction.
ALTER TYPE "TemplateKind" ADD VALUE IF NOT EXISTS 'CONSENT';
