-- Clinical term autocomplete previously pulled a fixed 5,000 rows ordered by display and
-- filtered them in JavaScript. With 11,742 active clinical terms that left 6,742 of them
-- (57%) unreachable by search: the cut fell at "Hypoadrenocorticism", so every term from
-- H onwards was invisible, including 14 of the 18 terms containing "vomit".
--
-- The service now filters, scores and limits in SQL, which needs an index or it becomes a
-- sequential scan on every keystroke. Measured on 11,742 rows of this shape: 35.3 ms
-- sequential scan against 0.4 ms indexed, at realistic selectivity.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- The searchable text of a clinical term.
--
-- Built from the synonym array's ELEMENTS rather than from synonyms::text. Casting the
-- jsonb to text yields its JSON encoding, so a synonym containing a quote or backslash
-- appears escaped - \" rather than " - and a query spanning that character would fail to
-- match a row that genuinely contains it. The index is only a prefilter, but a prefilter
-- that drops true matches is not a prefilter, it is a bug.
CREATE OR REPLACE FUNCTION code_entry_search_text(display text, synonyms jsonb)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  -- Deliberately not RETURNS NULL ON NULL INPUT. synonyms is nullable, and a strict
  -- function would return NULL for such a row, making the prefilter's NULL LIKE ...
  -- reject it before its display was ever scored. That is precisely the silent
  -- disappearance from search this index exists to end.
  SELECT lower(
    COALESCE(display, '') || ' ' || COALESCE(
      (SELECT string_agg(value, ' ')
         FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(synonyms) = 'array' THEN synonyms ELSE '[]'::jsonb END
         )),
      ''
    )
  )
$$;

-- pg_trgm may already exist in another schema on some environment, commonly public, in
-- which case the CREATE EXTENSION above is a no-op and a hard-coded extensions.gin_trgm_ops
-- would not resolve. Resolve the operator class from wherever the extension actually lives.
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

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I USING gin ('
    || '(code_entry_search_text("display", "synonyms")) %I.gin_trgm_ops'
    || ') WHERE "system" = ''YOSEMITECODE''::"CodeSystem"'
    || '   AND "type" = ''CLINICAL_TERM''::"CodeType"'
    || '   AND "active"',
    'CodeEntry_clinical_search_trgm', 'CodeEntry', ext_schema
  );
END
$$;
