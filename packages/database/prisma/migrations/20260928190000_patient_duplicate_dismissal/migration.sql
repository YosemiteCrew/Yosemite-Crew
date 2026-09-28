CREATE TABLE "PatientDuplicateDismissal" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientAId" TEXT NOT NULL,
    "patientBId" TEXT NOT NULL,
    "dismissedById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientDuplicateDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientDuplicateDismissal_organisationId_patientAId_patientBId_key"
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

ALTER TABLE "PatientDuplicateDismissal" ENABLE ROW LEVEL SECURITY;
