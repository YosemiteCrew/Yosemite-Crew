-- CreateEnum
CREATE TYPE "ImagingType" AS ENUM ('RADIOGRAPH', 'ULTRASOUND', 'CT_SCAN', 'MRI', 'ENDOSCOPY', 'FLUOROSCOPY', 'SCINTIGRAPHY', 'OTHER');

-- CreateEnum
CREATE TYPE "ImagingStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'REQUIRES_SPECIALIST');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'DIAGNOSTIC_IMAGE_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'DIAGNOSTIC_IMAGE_REVIEWED';

-- CreateTable
CREATE TABLE "DiagnosticImage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "imagingType" "ImagingType" NOT NULL,
    "bodyRegion" TEXT,
    "indication" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "takenBy" TEXT,
    "interpretedBy" TEXT,
    "interpretedAt" TIMESTAMP(3),
    "findings" TEXT,
    "impression" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "status" "ImagingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticImage_organisationId_patientId_idx" ON "DiagnosticImage"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "DiagnosticImage_encounterId_idx" ON "DiagnosticImage"("encounterId");
