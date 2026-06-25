-- CreateEnum
CREATE TYPE "VaccineType" AS ENUM ('RABIES', 'CORE', 'NON_CORE', 'OTHER');

-- CreateEnum
CREATE TYPE "ParasiteTreatmentType" AS ENUM ('ECHINOCOCCUS', 'TICK', 'FLEA', 'OTHER');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "microchipImplantedAt" TIMESTAMP(3),
ADD COLUMN     "microchipLocation" TEXT;

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vaccineType" "VaccineType" NOT NULL DEFAULT 'OTHER',
    "vaccineName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "dateAdministered" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "administeringVetId" TEXT,
    "administeringVetName" TEXT,
    "vetLicenseNumber" TEXT,
    "site" TEXT,
    "route" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParasiteTreatment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "treatmentType" "ParasiteTreatmentType" NOT NULL DEFAULT 'OTHER',
    "productName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "treatedAt" TIMESTAMP(3) NOT NULL,
    "administeringVetId" TEXT,
    "administeringVetName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParasiteTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RabiesTitration" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "approvedLab" TEXT NOT NULL,
    "sampleDate" TIMESTAMP(3) NOT NULL,
    "resultIuMl" DOUBLE PRECISION NOT NULL,
    "reportUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RabiesTitration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetPassport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "issuingCountry" TEXT,
    "issuingAuthority" TEXT,
    "issuingVetId" TEXT,
    "issuingVetName" TEXT,
    "issuingVetLicense" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RecordStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetPassport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vaccination_patientId_idx" ON "Vaccination"("patientId");

-- CreateIndex
CREATE INDEX "Vaccination_organisationId_idx" ON "Vaccination"("organisationId");

-- CreateIndex
CREATE INDEX "Vaccination_patientId_vaccineType_idx" ON "Vaccination"("patientId", "vaccineType");

-- CreateIndex
CREATE INDEX "Vaccination_validUntil_idx" ON "Vaccination"("validUntil");

-- CreateIndex
CREATE INDEX "ParasiteTreatment_patientId_idx" ON "ParasiteTreatment"("patientId");

-- CreateIndex
CREATE INDEX "ParasiteTreatment_organisationId_idx" ON "ParasiteTreatment"("organisationId");

-- CreateIndex
CREATE INDEX "ParasiteTreatment_patientId_treatmentType_idx" ON "ParasiteTreatment"("patientId", "treatmentType");

-- CreateIndex
CREATE INDEX "RabiesTitration_patientId_idx" ON "RabiesTitration"("patientId");

-- CreateIndex
CREATE INDEX "RabiesTitration_organisationId_idx" ON "RabiesTitration"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "PetPassport_passportNumber_key" ON "PetPassport"("passportNumber");

-- CreateIndex
CREATE INDEX "PetPassport_patientId_idx" ON "PetPassport"("patientId");

-- CreateIndex
CREATE INDEX "PetPassport_organisationId_idx" ON "PetPassport"("organisationId");

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParasiteTreatment" ADD CONSTRAINT "ParasiteTreatment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabiesTitration" ADD CONSTRAINT "RabiesTitration_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetPassport" ADD CONSTRAINT "PetPassport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

