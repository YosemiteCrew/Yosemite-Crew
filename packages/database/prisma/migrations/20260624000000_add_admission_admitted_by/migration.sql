-- Records the authenticated user who admitted the patient (clicked "Convert to Inpatient").
ALTER TABLE "Admission" ADD COLUMN "admittedBy" TEXT;
