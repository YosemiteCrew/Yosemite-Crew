-- A possible duplicate patient pair that a practice has reviewed and marked
-- as not the same patient, so it stops appearing in that practice's review
-- queue. Nothing here combines or changes patient records.

CREATE TABLE "PatientDuplicateDismissal" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientAId" TEXT NOT NULL,
    "patientBId" TEXT NOT NULL,
    "dismissedById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientDuplicateDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientDuplicateDismissal_organisationId_patientAId_patient_key"
    ON "PatientDuplicateDismissal"("organisationId", "patientAId", "patientBId");

CREATE INDEX "PatientDuplicateDismissal_organisationId_dismissedAt_idx"
    ON "PatientDuplicateDismissal"("organisationId", "dismissedAt");

CREATE INDEX "PatientDuplicateDismissal_patientAId_idx"
    ON "PatientDuplicateDismissal"("patientAId");

CREATE INDEX "PatientDuplicateDismissal_patientBId_idx"
    ON "PatientDuplicateDismissal"("patientBId");

ALTER TABLE "PatientDuplicateDismissal"
    ADD CONSTRAINT "PatientDuplicateDismissal_patientAId_fkey"
    FOREIGN KEY ("patientAId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientDuplicateDismissal"
    ADD CONSTRAINT "PatientDuplicateDismissal_patientBId_fkey"
    FOREIGN KEY ("patientBId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- deployed-code-survives: the table is created earlier in this same migration,
--   so no deployed query names it and the enable takes rows away from no
--   existing reader. Its only reader and writer is the duplicate review service
--   shipping in this same PR, which connects as the owning role and bypasses
--   row-level security, matching every other ENABLE ROW LEVEL SECURITY in this
--   migration set.
-- Deny direct Supabase PostgREST access; the API connects as the owning role.
ALTER TABLE "PatientDuplicateDismissal" ENABLE ROW LEVEL SECURITY;
