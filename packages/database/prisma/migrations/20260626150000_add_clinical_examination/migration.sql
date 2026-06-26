-- AlterEnum
ALTER TYPE "ClinicalArtifactKind" ADD VALUE 'CLINICAL_EXAM';

-- CreateTable
CREATE TABLE "ClinicalExamination" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "examinedAt" TIMESTAMP(3) NOT NULL,
    "fitForTravel" BOOLEAN NOT NULL DEFAULT true,
    "findings" TEXT,
    "weightKg" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalExamination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalExamination_artifactId_key" ON "ClinicalExamination"("artifactId");

-- CreateIndex
CREATE INDEX "ClinicalExamination_artifactId_idx" ON "ClinicalExamination"("artifactId");

-- CreateIndex
CREATE INDEX "ClinicalExamination_examinedAt_idx" ON "ClinicalExamination"("examinedAt");

-- AddForeignKey
ALTER TABLE "ClinicalExamination" ADD CONSTRAINT "ClinicalExamination_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

