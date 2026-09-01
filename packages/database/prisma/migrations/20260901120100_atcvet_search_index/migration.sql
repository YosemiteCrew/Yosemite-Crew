-- Trigram index for medication search, mirroring the clinical-term one.
--
-- Deliberately a SEPARATE migration from the one adding 'ATCVET' to the CodeSystem
-- enum: PostgreSQL refuses to use a new enum value inside the same transaction that
-- added it, and Prisma runs each migration file in one transaction. Combined, this
-- index would fail with "unsafe use of new value of enum type".
--
-- The clinical index is partial to YOSEMITECODE/CLINICAL_TERM, so ATCvet rows were
-- not covered by it and medication search would sequentially scan every code.
DO $$
DECLARE
  ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF ext_schema IS NULL THEN
    RAISE EXCEPTION 'pg_trgm is not installed';
  END IF;

  -- Substances only. The 1,898 grouping levels are never prescribed, so keeping
  -- them out keeps the index to what autocomplete actually searches.
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I USING gin ('
    || '(code_entry_search_text("display", "synonyms")) %I.gin_trgm_ops'
    || ') WHERE "system" = ''ATCVET''::"CodeSystem"'
    || '   AND "type" = ''MEDICATION''::"CodeType"'
    || '   AND "active"',
    'CodeEntry_atcvet_search_trgm', 'CodeEntry', ext_schema
  );
END
$$;
