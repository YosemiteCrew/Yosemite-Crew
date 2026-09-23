-- One RegulatoryAuthority row per country.
--
-- The seed upserts on iso2 and the lookup endpoint resolves a reporter's
-- country to a single authority, so duplicates would make both ambiguous.
-- iso2 stays nullable; Postgres permits multiple NULLs under a unique index,
-- so rows that predate a known country code are unaffected.
--
-- Guarded because the constraint cannot be added while duplicates exist. If
-- this fails, dedupe first rather than dropping the guard.
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryAuthority_iso2_key"
  ON "RegulatoryAuthority" ("iso2");
