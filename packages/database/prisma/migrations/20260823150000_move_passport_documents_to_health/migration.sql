-- A pet passport is a health record, not paperwork: it carries the
-- vaccination, parasite-treatment and rabies-titration history a vet signs.
-- It was filed under ADMIN beside insurance and certificates, which also put
-- it out of reach of PIMS entirely -- the web picker only ever offers HEALTH
-- and HYGIENE_MAINTENANCE, so no clinic could ever file or find one.
--
-- The subcategory is unchanged; only the parent category moves. Idempotent:
-- re-running matches nothing once applied.
UPDATE "Document"
SET category = 'HEALTH'
WHERE category = 'ADMIN'
  AND subcategory = 'PASSPORT';
