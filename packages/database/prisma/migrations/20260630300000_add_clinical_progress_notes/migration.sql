-- CreateEnum
CREATE TYPE "ClinicalNoteType" AS ENUM (
  'SHIFT_NOTE',
  'PROGRESS_NOTE',
  'NURSE_NOTE',
  'SPECIALIST_NOTE',
  'DISCHARGE_SUMMARY',
  'OTHER'
);

-- CreateTable
CREATE TABLE "ClinicalProgressNote" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "noteType" "ClinicalNoteType" NOT NULL,
    "subjectiveFindings" TEXT,
    "objectiveFindings" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "freeText" TEXT,
    "authorId" TEXT,
    "authorName" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalProgressNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalProgressNote_organisationId_patientId_idx" ON "ClinicalProgressNote"("organisationId", "patientId");
CREATE INDEX "ClinicalProgressNote_organisationId_encounterId_idx" ON "ClinicalProgressNote"("organisationId", "encounterId");
