-- CreateEnum
CREATE TYPE "PathologyType" AS ENUM ('HISTOPATHOLOGY', 'CYTOLOGY', 'CULTURE_SENSITIVITY', 'HAEMATOLOGY', 'BIOCHEMISTRY', 'URINALYSIS', 'PCR', 'SEROLOGY', 'NECROPSY', 'OTHER');

-- CreateEnum
CREATE TYPE "PathologyStatus" AS ENUM ('PENDING', 'RECEIVED_BY_LAB', 'PROCESSING', 'RESULTS_AVAILABLE', 'REVIEWED');

-- CreateTable
CREATE TABLE "PathologySubmission" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "pathologyType" "PathologyType" NOT NULL,
    "sampleType" TEXT NOT NULL,
    "anatomicSite" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "collectedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "labName" TEXT,
    "labRefNumber" TEXT,
    "clinicalHistory" TEXT,
    "differentials" TEXT,
    "results" TEXT,
    "diagnosis" TEXT,
    "interpretation" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "status" "PathologyStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathologySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PathologySubmission_organisationId_patientId_idx" ON "PathologySubmission"("organisationId", "patientId");
CREATE INDEX "PathologySubmission_organisationId_status_idx" ON "PathologySubmission"("organisationId", "status");
