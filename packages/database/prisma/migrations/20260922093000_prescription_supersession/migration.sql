ALTER TABLE "Prescription"
ADD COLUMN "supersedesId" TEXT;

CREATE UNIQUE INDEX "Prescription_supersedesId_key"
ON "Prescription"("supersedesId");

ALTER TABLE "Prescription"
ADD CONSTRAINT "Prescription_supersedesId_fkey"
FOREIGN KEY ("supersedesId") REFERENCES "Prescription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- deployed-code-survives: this migration only adds a nullable relationship and
-- its supporting constraints. Existing application versions neither select nor
-- write "supersedesId", so they continue to create and read prescriptions while
-- the new version rolls out.
