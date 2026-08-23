-- Backfill the `medicalRecords` co-parent permission.
--
-- The pet passport carries the vaccination, parasite-treatment,
-- rabies-titration and clinical-exam history a vet has signed. Access to it now
-- needs its own explicit grant rather than riding on `companionProfile`: a
-- primary parent who shared profile details has not thereby shared the medical
-- history.
--
-- CO_PARENT gets false. Nobody gains access to clinical records as a side
-- effect of a deployment - it is granted deliberately, by the primary parent,
-- or not at all. Co-parents who were reaching the passport through
-- `companionProfile` will lose it until it is granted, which is the intended
-- direction for this class of record.
--
-- PRIMARY gets true for consistency with the rest of their permission blob.
-- It changes nothing operationally: primary parents bypass the permission check
-- entirely, because the set describes what they have DELEGATED.
--
-- Idempotent: only rows missing the key are touched, so a re-run is a no-op and
-- an already-granted co-parent is never silently revoked.
UPDATE "ParentPatient"
SET permissions = jsonb_set(permissions, '{medicalRecords}', 'false'::jsonb, true)
WHERE role = 'CO_PARENT'
  AND NOT (permissions ? 'medicalRecords');

UPDATE "ParentPatient"
SET permissions = jsonb_set(permissions, '{medicalRecords}', 'true'::jsonb, true)
WHERE role = 'PRIMARY'
  AND NOT (permissions ? 'medicalRecords');
