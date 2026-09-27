-- Record the appointment's companion on form submissions a pet parent filled in
-- on an appointment without naming the companion.
--
-- A parent reads, downloads and signs their form submissions through their link
-- to the submission's companion, so a submission that names no companion is
-- given the one its appointment records. New submissions are recorded this way
-- when they are made.
--
-- Only rows the parent filled in (the parent is also the submitter) that name
-- no companion are touched, so a re-run is a no-op.
UPDATE "FormSubmission" AS fs
SET "patientId" = a.patient ->> 'id'
FROM "Appointment" AS a
WHERE fs."appointmentId" = a.id
  AND fs."patientId" IS NULL
  AND fs."parentId" IS NOT NULL
  AND fs."submittedBy" = fs."parentId"
  AND a.patient ->> 'id' IS NOT NULL;
