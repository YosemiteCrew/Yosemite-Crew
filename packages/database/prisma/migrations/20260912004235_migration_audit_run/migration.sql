-- Read-only migration audit (#3056). Never writes clinic records; holds only
-- what a candidate CSV bundle contains and what is wrong with it, scoped to
-- the organisation that uploaded it.

-- CreateEnum
CREATE TYPE "MigrationAuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MigrationAuditSection" AS ENUM ('OWNERS', 'ANIMALS', 'APPOINTMENTS', 'ATTACHMENTS');

-- CreateEnum
CREATE TYPE "MigrationAuditSeverity" AS ENUM ('FATAL', 'ERROR', 'WARNING', 'INFORMATION');

-- CreateTable
CREATE TABLE "MigrationAuditRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "MigrationAuditStatus" NOT NULL DEFAULT 'PENDING',
    "inputHash" TEXT NOT NULL,
    "sourceFiles" JSONB NOT NULL,
    "summary" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MigrationAuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationAuditIssue" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "section" "MigrationAuditSection" NOT NULL,
    "severity" "MigrationAuditSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "diagnostics" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationAuditIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationAuditRun_organisationId_createdAt_idx" ON "MigrationAuditRun"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "MigrationAuditRun_organisationId_inputHash_idx" ON "MigrationAuditRun"("organisationId", "inputHash");

-- CreateIndex
CREATE INDEX "MigrationAuditIssue_auditRunId_idx" ON "MigrationAuditIssue"("auditRunId");

-- CreateIndex
CREATE INDEX "MigrationAuditIssue_auditRunId_section_severity_idx" ON "MigrationAuditIssue"("auditRunId", "section", "severity");

-- AddForeignKey
ALTER TABLE "MigrationAuditIssue" ADD CONSTRAINT "MigrationAuditIssue_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "MigrationAuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny direct Supabase PostgREST access; the API connects as the owning role.
ALTER TABLE "MigrationAuditRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MigrationAuditIssue" ENABLE ROW LEVEL SECURITY;
