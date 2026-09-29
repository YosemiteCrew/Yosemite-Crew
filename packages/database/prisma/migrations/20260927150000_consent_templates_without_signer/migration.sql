-- Consent templates saved with no "Signed by" choice keep what the form
-- builder showed for them: no signature required.
--
-- The server now reads a consent that names no signer as one the pet parent
-- signs. Consent templates saved before that, which the builder listed as "No
-- signature required", are given that choice explicitly so they behave as
-- practices set them up. A practice that wants the pet parent to sign one
-- switches "Signed by" to "Pet parent" in the form builder.
--
-- Consents are CONSENT templates and FORM templates filed under the "Consent
-- form" category (saved before CONSENT was a kind of its own). A signer is unset
-- when rules has no "requiredSigner" string, or a blank one; any named signer is
-- left alone.
--
-- Idempotent: every row this sets now names a signer, so a re-run matches
-- nothing.
--
-- Reversible: each row this sets also carries "requiredSignerBackfilled": true
-- (dropped the next time the template is saved from the builder, when the
-- signer becomes the practice's own choice). To undo:
--   UPDATE "Template"
--   SET rules = rules - 'requiredSigner' - 'requiredSignerBackfilled'
--   WHERE rules ? 'requiredSignerBackfilled';
UPDATE "Template"
SET rules = (
    CASE WHEN jsonb_typeof(rules) = 'object' THEN rules ELSE '{}'::jsonb END
  ) || '{"requiredSigner": "NONE", "requiredSignerBackfilled": true}'::jsonb
WHERE (
    kind = 'CONSENT'
    OR (kind = 'FORM' AND rules ->> 'category' = 'Consent form')
  )
  AND (rules IS NULL OR jsonb_typeof(rules) IN ('object', 'null'))
  AND COALESCE(btrim(
    CASE WHEN jsonb_typeof(rules -> 'requiredSigner') = 'string'
      THEN rules ->> 'requiredSigner'
    END
  ), '') = '';
