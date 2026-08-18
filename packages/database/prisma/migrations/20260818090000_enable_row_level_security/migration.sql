-- Enable row level security on every table in the public schema.
--
-- Supabase's security advisor flagged public."OrganizationDocumentAcknowledgements"
-- as "RLS Disabled in Public". It was not a one-off: this repository has never
-- contained a single ENABLE ROW LEVEL SECURITY statement across 186 models, so
-- RLS has only ever been switched on by hand in the dashboard. Every new table
-- therefore ships unprotected until somebody remembers to click it, and this
-- release adds a large batch of new tables.
--
-- Why enabling with no policy is the right default here: the API connects as the
-- owning role, which bypasses RLS, so application queries through Prisma are
-- unaffected. What it does close is the PostgREST surface - Supabase exposes
-- every table in `public` over its REST API to the `anon` and `authenticated`
-- keys, and with RLS off those keys can read the table directly. With RLS on and
-- no policy, that path is denied by default. Tenant scoping stays where it
-- already lives, in the application's organisation filters.
--
-- Written as a loop rather than 186 literal statements so a table added later is
-- covered the moment this runs again, and so the statement cannot drift out of
-- sync with the schema. ENABLE is idempotent, so re-running is a no-op.
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
