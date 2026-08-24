-- Clinical term autocomplete previously pulled a fixed 5,000 rows ordered by display
-- and filtered them in JavaScript. With 11,742 active clinical terms that left 6,742
-- of them (57%) unreachable by search: the cut fell at "Hypoadrenocorticism", so every
-- term from H onwards was invisible, including 14 of the 18 terms containing "vomit".
--
-- The service now filters, scores and limits in SQL, which needs an index or it becomes
-- a sequential scan on every keystroke. Measured on a 11,742-row copy of this shape:
-- 35.3 ms sequential scan vs 0.4 ms with this index, at realistic selectivity.
--
-- The indexed expression concatenates display and the synonyms JSON so one index serves
-- both. It is a prefilter only: it is a superset of true matches (the concatenation
-- contains every searchable string), and the service still scores display and synonyms
-- precisely afterwards, so JSON punctuation cannot produce a false result.
--
-- Additive only. No table or column is altered.

-- This project keeps extensions in the "extensions" schema (pgcrypto, uuid-ossp and
-- pg_stat_statements all live there), and search_path is only "$user", public. So the
-- extension goes there for consistency and the operator class is schema-qualified,
-- because an unqualified gin_trgm_ops would not resolve. The schema is created first so
-- the migration also applies to a plain Postgres in local development and CI.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS "CodeEntry_clinical_search_trgm"
  ON "CodeEntry"
  USING gin ((lower("display" || ' ' || COALESCE("synonyms"::text, ''))) extensions.gin_trgm_ops)
  WHERE "system" = 'YOSEMITECODE'::"CodeSystem"
    AND "type" = 'CLINICAL_TERM'::"CodeType"
    AND "active";
