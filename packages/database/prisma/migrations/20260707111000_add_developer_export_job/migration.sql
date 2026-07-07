-- CreateEnum
CREATE TYPE "DeveloperExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "DeveloperExportJobs" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "status" "DeveloperExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "resources" TEXT[],
    "format" TEXT NOT NULL,
    "s3Key" TEXT,
    "error" TEXT,
    "rowCounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperExportJobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperExportJobs_organisationId_createdAt_idx" ON "DeveloperExportJobs"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "DeveloperExportJobs_organisationId_status_idx" ON "DeveloperExportJobs"("organisationId", "status");
