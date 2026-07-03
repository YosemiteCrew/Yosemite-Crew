-- Add inpatient-only scoping to task templates so schedule templates can be
-- filtered to inpatient workflows without changing the legacy template kind.
ALTER TABLE "TaskTemplate"
ADD COLUMN "inpatientOnly" BOOLEAN NOT NULL DEFAULT false;
