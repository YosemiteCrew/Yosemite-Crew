-- Backfill the older template, clinical-artifact, and task-schedule tables.
-- This follows the rendered-document backfill so dependent foreign keys can be attached.

DO $$
BEGIN
  CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TemplateOwnershipType" AS ENUM ('YC_LIBRARY', 'ORG_TEMPLATE', 'USER_TEMPLATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TemplateScope" AS ENUM (
    'ORGANISATION',
    'SPECIALITY',
    'SERVICE',
    'APPOINTMENT_KIND',
    'INPATIENT',
    'OUTPATIENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TemplateInstanceStatus" AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'SIGNED',
    'VOID'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TaskScheduleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "ownerUserId" TEXT,
    "ownership" "TemplateOwnershipType" NOT NULL DEFAULT 'ORG_TEMPLATE',
    "kind" "TemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "scope" "TemplateScope" NOT NULL DEFAULT 'ORGANISATION',
    "rules" JSONB,
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Template_organisationId_ownership_kind_status_idx"
  ON "Template"("organisationId", "ownership", "kind", "status");
CREATE INDEX IF NOT EXISTS "Template_organisationId_scope_idx"
  ON "Template"("organisationId", "scope");
CREATE INDEX IF NOT EXISTS "Template_ownerUserId_idx"
  ON "Template"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Template_ownership_kind_status_idx"
  ON "Template"("ownership", "kind", "status");

CREATE TABLE IF NOT EXISTS "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaSnapshot" JSONB NOT NULL,
    "renderConfigSnapshot" JSONB,
    "validationSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TemplateVersion_templateId_version_key" UNIQUE ("templateId", "version")
);

CREATE INDEX IF NOT EXISTS "TemplateVersion_templateId_idx"
  ON "TemplateVersion"("templateId");
CREATE INDEX IF NOT EXISTS "TemplateVersion_publishedAt_idx"
  ON "TemplateVersion"("publishedAt");

CREATE TABLE IF NOT EXISTS "TemplateInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "caseId" TEXT,
    "encounterId" TEXT,
    "status" "TemplateInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "data" JSONB NOT NULL,
    "authorId" TEXT,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "generatedPdfUrl" TEXT,
    "generatedPdf" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TemplateInstance_templateId_idx"
  ON "TemplateInstance"("templateId");
CREATE INDEX IF NOT EXISTS "TemplateInstance_organisationId_appointmentId_idx"
  ON "TemplateInstance"("organisationId", "appointmentId");
CREATE INDEX IF NOT EXISTS "TemplateInstance_organisationId_encounterId_idx"
  ON "TemplateInstance"("organisationId", "encounterId");
CREATE INDEX IF NOT EXISTS "TemplateInstance_organisationId_caseId_idx"
  ON "TemplateInstance"("organisationId", "caseId");
CREATE INDEX IF NOT EXISTS "TemplateInstance_status_idx"
  ON "TemplateInstance"("status");

CREATE TABLE IF NOT EXISTS "ClinicalArtifact" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "caseId" TEXT,
    "encounterId" TEXT,
    "kind" "ClinicalArtifactKind" NOT NULL,
    "status" "ClinicalArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "templateVersionId" TEXT,
    "authorId" TEXT,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClinicalArtifact_organisationId_kind_status_idx"
  ON "ClinicalArtifact"("organisationId", "kind", "status");
CREATE INDEX IF NOT EXISTS "ClinicalArtifact_organisationId_appointmentId_idx"
  ON "ClinicalArtifact"("organisationId", "appointmentId");
CREATE INDEX IF NOT EXISTS "ClinicalArtifact_organisationId_encounterId_idx"
  ON "ClinicalArtifact"("organisationId", "encounterId");
CREATE INDEX IF NOT EXISTS "ClinicalArtifact_organisationId_caseId_idx"
  ON "ClinicalArtifact"("organisationId", "caseId");
CREATE INDEX IF NOT EXISTS "ClinicalArtifact_templateId_templateVersion_idx"
  ON "ClinicalArtifact"("templateId", "templateVersion");
CREATE INDEX IF NOT EXISTS "ClinicalArtifact_templateVersionId_idx"
  ON "ClinicalArtifact"("templateVersionId");

CREATE TABLE IF NOT EXISTS "SoapNote" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "subjective" JSONB,
    "objective" JSONB,
    "assessment" JSONB,
    "plan" JSONB,
    "diagnoses" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoapNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SoapNote_artifactId_key" UNIQUE ("artifactId")
);

CREATE INDEX IF NOT EXISTS "SoapNote_artifactId_idx"
  ON "SoapNote"("artifactId");

CREATE TABLE IF NOT EXISTS "TaskSchedule" (
    "id" TEXT NOT NULL,
    "templateInstanceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templateKind" "TemplateKind" NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "caseId" TEXT,
    "encounterId" TEXT,
    "companionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "activatedBy" TEXT,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastMaterializedAt" TIMESTAMP(3),
    "status" "TaskScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduleInput" JSONB,
    "materializedSeeds" JSONB,
    "generatedTaskIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TaskSchedule_templateInstanceId_key" UNIQUE ("templateInstanceId")
);

CREATE INDEX IF NOT EXISTS "TaskSchedule_organisationId_status_idx"
  ON "TaskSchedule"("organisationId", "status");
CREATE INDEX IF NOT EXISTS "TaskSchedule_templateId_templateVersion_idx"
  ON "TaskSchedule"("templateId", "templateVersion");
CREATE INDEX IF NOT EXISTS "TaskSchedule_appointmentId_idx"
  ON "TaskSchedule"("appointmentId");
CREATE INDEX IF NOT EXISTS "TaskSchedule_encounterId_idx"
  ON "TaskSchedule"("encounterId");
CREATE INDEX IF NOT EXISTS "TaskSchedule_companionId_idx"
  ON "TaskSchedule"("companionId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateVersion'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'Template'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TemplateVersion_templateId_fkey'
  ) THEN
    ALTER TABLE "TemplateVersion"
      ADD CONSTRAINT "TemplateVersion_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "Template"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateInstance'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'Template'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TemplateInstance_templateId_fkey'
  ) THEN
    ALTER TABLE "TemplateInstance"
      ADD CONSTRAINT "TemplateInstance_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "Template"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ClinicalArtifact'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateVersion'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalArtifact_templateVersionId_fkey'
  ) THEN
    ALTER TABLE "ClinicalArtifact"
      ADD CONSTRAINT "ClinicalArtifact_templateVersionId_fkey"
      FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'SoapNote'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SoapNote_artifactId_fkey'
  ) THEN
    ALTER TABLE "SoapNote"
      ADD CONSTRAINT "SoapNote_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'Prescription'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Prescription_artifactId_fkey'
  ) THEN
    ALTER TABLE "Prescription"
      ADD CONSTRAINT "Prescription_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'DischargeSummary'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DischargeSummary_artifactId_fkey'
  ) THEN
    ALTER TABLE "DischargeSummary"
      ADD CONSTRAINT "DischargeSummary_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'VitalRecord'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VitalRecord_artifactId_fkey'
  ) THEN
    ALTER TABLE "VitalRecord"
      ADD CONSTRAINT "VitalRecord_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'RenderedDocument'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateInstance'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RenderedDocument_templateInstanceId_fkey'
  ) THEN
    ALTER TABLE "RenderedDocument"
      ADD CONSTRAINT "RenderedDocument_templateInstanceId_fkey"
      FOREIGN KEY ("templateInstanceId") REFERENCES "TemplateInstance"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'RenderedDocument'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RenderedDocument_clinicalArtifactId_fkey'
  ) THEN
    ALTER TABLE "RenderedDocument"
      ADD CONSTRAINT "RenderedDocument_clinicalArtifactId_fkey"
      FOREIGN KEY ("clinicalArtifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'DocumentSignature'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'RenderedDocument'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentSignature_renderedDocumentId_fkey'
  ) THEN
    ALTER TABLE "DocumentSignature"
      ADD CONSTRAINT "DocumentSignature_renderedDocumentId_fkey"
      FOREIGN KEY ("renderedDocumentId") REFERENCES "RenderedDocument"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TaskSchedule'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateInstance'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskSchedule_templateInstanceId_fkey'
  ) THEN
    ALTER TABLE "TaskSchedule"
      ADD CONSTRAINT "TaskSchedule_templateInstanceId_fkey"
      FOREIGN KEY ("templateInstanceId") REFERENCES "TemplateInstance"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
