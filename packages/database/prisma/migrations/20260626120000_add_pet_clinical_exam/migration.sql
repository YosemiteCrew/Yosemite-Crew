-- CreateTable
CREATE TABLE "PetClinicalExam" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "examinedAt" TIMESTAMP(3) NOT NULL,
    "examiningVetId" TEXT,
    "examiningVetName" TEXT,
    "vetLicenseNumber" TEXT,
    "fitForTravel" BOOLEAN NOT NULL DEFAULT true,
    "weightKg" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "findings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetClinicalExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetClinicalExam_patientId_idx" ON "PetClinicalExam"("patientId");

-- CreateIndex
CREATE INDEX "PetClinicalExam_organisationId_idx" ON "PetClinicalExam"("organisationId");

-- CreateIndex
CREATE INDEX "PetClinicalExam_patientId_examinedAt_idx" ON "PetClinicalExam"("patientId", "examinedAt");

-- AddForeignKey
ALTER TABLE "PetClinicalExam" ADD CONSTRAINT "PetClinicalExam_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
