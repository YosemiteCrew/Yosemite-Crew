-- Enable row level security on every public table that 20260818090000 never saw.
--
-- 20260818090000_enable_row_level_security switched RLS on for every table that
-- existed when it ran. `prisma migrate deploy` applies any migration it has not
-- applied yet, whatever its timestamp, so a migration dated before 0818 but merged
-- after that database had already applied 0818 creates its tables afterwards, and
-- the loop in 0818 is never run again. A fresh database applies such migrations in
-- timestamp order and is unaffected,
-- which is why the migration CI job, which starts from an empty database, cannot
-- see this; the post-deploy check `rls_enabled_on_all_tables` in
-- assert-schema-invariants.sql does.
--
-- Same statement as 0818, so it covers any table in this position on any
-- environment rather than naming the two. ENABLE is idempotent, so on a database
-- where every table already has RLS this is a no-op.
--
-- deployed-code-survives: ENABLE without FORCE, exactly as 20260818090000. The API
-- connects as the owning role, which bypasses row level security, so every query
-- the running code makes returns the same rows before and after. It only denies
-- the anon and authenticated PostgREST roles, which no code path in this
-- repository uses.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'                       -- ordinary tables only
      AND c.relname <> '_prisma_migrations'     -- Prisma's own bookkeeping
      AND NOT c.relrowsecurity                  -- skip ones already enabled
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.relname);
  END LOOP;
END $$;
