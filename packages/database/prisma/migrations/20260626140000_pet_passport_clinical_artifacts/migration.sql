-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicalArtifactKind" ADD VALUE 'IMMUNIZATION';
ALTER TYPE "ClinicalArtifactKind" ADD VALUE 'RABIES_TITRATION';
ALTER TYPE "ClinicalArtifactKind" ADD VALUE 'PARASITE_TREATMENT';

-- DropForeignKey
ALTER TABLE "Vaccination" DROP CONSTRAINT "Vaccination_patientId_fkey";

-- DropForeignKey
ALTER TABLE "ParasiteTreatment" DROP CONSTRAINT "ParasiteTreatment_patientId_fkey";

-- DropForeignKey
ALTER TABLE "RabiesTitration" DROP CONSTRAINT "RabiesTitration_patientId_fkey";

-- DropIndex
DROP INDEX "ParasiteTreatment_patientId_idx";

-- DropIndex
DROP INDEX "ParasiteTreatment_organisationId_idx";

-- DropIndex
DROP INDEX "ParasiteTreatment_patientId_treatmentType_idx";

-- DropIndex
DROP INDEX "RabiesTitration_patientId_idx";

-- DropIndex
DROP INDEX "RabiesTitration_organisationId_idx";

-- AlterTable
ALTER TABLE "ParasiteTreatment" DROP COLUMN "administeringVetId",
DROP COLUMN "administeringVetName",
DROP COLUMN "organisationId",
DROP COLUMN "patientId",
ADD COLUMN     "artifactId" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "RabiesTitration" DROP COLUMN "organisationId",
DROP COLUMN "patientId",
ADD COLUMN     "artifactId" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB;

-- DropTable
DROP TABLE "Vaccination";

-- CreateTable
CREATE TABLE "Immunization" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "vaccineType" "VaccineType" NOT NULL DEFAULT 'OTHER',
    "vaccineName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "dateAdministered" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "site" TEXT,
    "route" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalArtifactAttestation" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "primarySource" BOOLEAN NOT NULL DEFAULT true,
    "signatoryUserId" TEXT,
    "signatoryName" TEXT,
    "signatoryLicence" TEXT,
    "sourceDocumentId" TEXT,
    "documensoDocumentId" TEXT,
    "signingStatus" TEXT,
    "signedPdfUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalArtifactAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Immunization_artifactId_key" ON "Immunization"("artifactId");

-- CreateIndex
CREATE INDEX "Immunization_artifactId_idx" ON "Immunization"("artifactId");

-- CreateIndex
CREATE INDEX "Immunization_validUntil_idx" ON "Immunization"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalArtifactAttestation_artifactId_key" ON "ClinicalArtifactAttestation"("artifactId");

-- CreateIndex
CREATE INDEX "ClinicalArtifactAttestation_artifactId_idx" ON "ClinicalArtifactAttestation"("artifactId");

-- CreateIndex
CREATE INDEX "ClinicalArtifactAttestation_signatoryUserId_idx" ON "ClinicalArtifactAttestation"("signatoryUserId");

-- CreateIndex
CREATE INDEX "ClinicalArtifactAttestation_sourceDocumentId_idx" ON "ClinicalArtifactAttestation"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParasiteTreatment_artifactId_key" ON "ParasiteTreatment"("artifactId");

-- CreateIndex
CREATE INDEX "ParasiteTreatment_artifactId_idx" ON "ParasiteTreatment"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "RabiesTitration_artifactId_key" ON "RabiesTitration"("artifactId");

-- CreateIndex
CREATE INDEX "RabiesTitration_artifactId_idx" ON "RabiesTitration"("artifactId");

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RabiesTitration" ADD CONSTRAINT "RabiesTitration_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParasiteTreatment" ADD CONSTRAINT "ParasiteTreatment_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalArtifactAttestation" ADD CONSTRAINT "ClinicalArtifactAttestation_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

