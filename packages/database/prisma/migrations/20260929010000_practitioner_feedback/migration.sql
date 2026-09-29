ALTER TABLE "OrganisationRating"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ADD COLUMN "appointmentId" TEXT,
  ADD COLUMN "practitionerId" TEXT,
  ADD COLUMN "practitionerName" TEXT;

CREATE UNIQUE INDEX "OrganisationRating_appointmentId_userId_key"
  ON "OrganisationRating"("appointmentId", "userId");
