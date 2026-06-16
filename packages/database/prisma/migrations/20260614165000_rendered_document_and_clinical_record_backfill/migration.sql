-- Backfill the rendered-document and clinical-record model set that was added in schema.prisma.
-- Keep this before 20260614170000 so FORM_SUBMISSION can be added as a later enum value.

DO $$
BEGIN
  CREATE TYPE "TemplateKind" AS ENUM (
    'FORM',
    'SOAP_NOTE',
    'VITAL_RECORD',
    'PRESCRIPTION',
    'DISCHARGE_SUMMARY',
    'TASK_TEMPLATE',
    'CARE_PATHWAY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ClinicalArtifactKind" AS ENUM (
    'SOAP_NOTE',
    'PRESCRIPTION',
    'DISCHARGE_SUMMARY',
    'VITAL_RECORD'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ClinicalArtifactStatus" AS ENUM (
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
  CREATE TYPE "RenderedDocumentStatus" AS ENUM ('DRAFT', 'SIGNED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RenderedDocumentSourceKind" AS ENUM ('TEMPLATE_INSTANCE', 'CLINICAL_ARTIFACT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentSignatureSignerType" AS ENUM ('PMS_USER', 'PARENT', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RenderedDocument" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceKind" "RenderedDocumentSourceKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "templateInstanceId" TEXT,
    "clinicalArtifactId" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "templateVersionId" TEXT,
    "kind" "TemplateKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "status" "RenderedDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "signable" BOOLEAN NOT NULL DEFAULT true,
    "pdfUrl" TEXT,
    "pdf" JSONB,
    "signing" JSONB,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RenderedDocument_templateInstanceId_key"
  ON "RenderedDocument"("templateInstanceId");

CREATE UNIQUE INDEX IF NOT EXISTS "RenderedDocument_clinicalArtifactId_key"
  ON "RenderedDocument"("clinicalArtifactId");

CREATE INDEX IF NOT EXISTS "RenderedDocument_organisationId_kind_status_idx"
  ON "RenderedDocument"("organisationId", "kind", "status");

CREATE INDEX IF NOT EXISTS "RenderedDocument_sourceKind_sourceId_idx"
  ON "RenderedDocument"("sourceKind", "sourceId");

CREATE INDEX IF NOT EXISTS "RenderedDocument_templateId_templateVersion_idx"
  ON "RenderedDocument"("templateId", "templateVersion");

CREATE INDEX IF NOT EXISTS "RenderedDocument_templateVersionId_idx"
  ON "RenderedDocument"("templateVersionId");

ALTER TABLE IF EXISTS "RenderedDocument"
  ADD COLUMN IF NOT EXISTS "signing" JSONB;

CREATE TABLE IF NOT EXISTS "DocumentSignature" (
    "id" TEXT NOT NULL,
    "renderedDocumentId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "signerType" "DocumentSignatureSignerType" NOT NULL,
    "signatureText" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSignature_renderedDocumentId_key"
  ON "DocumentSignature"("renderedDocumentId");

CREATE INDEX IF NOT EXISTS "DocumentSignature_renderedDocumentId_idx"
  ON "DocumentSignature"("renderedDocumentId");

CREATE INDEX IF NOT EXISTS "DocumentSignature_signerId_idx"
  ON "DocumentSignature"("signerId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'RenderedDocument'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'TemplateInstance'
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
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'RenderedDocument'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'ClinicalArtifact'
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
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'DocumentSignature'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'RenderedDocument'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentSignature_renderedDocumentId_fkey'
  ) THEN
    ALTER TABLE "DocumentSignature"
      ADD CONSTRAINT "DocumentSignature_renderedDocumentId_fkey"
      FOREIGN KEY ("renderedDocumentId") REFERENCES "RenderedDocument"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Prescription" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "medications" JSONB,
    "instructions" JSONB,
    "notes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Prescription_artifactId_key" UNIQUE ("artifactId")
);

CREATE INDEX IF NOT EXISTS "Prescription_artifactId_idx"
  ON "Prescription"("artifactId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'Prescription'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Prescription_artifactId_fkey'
  ) THEN
    ALTER TABLE "Prescription"
      ADD CONSTRAINT "Prescription_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DischargeSummary" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "summary" JSONB,
    "diagnoses" JSONB,
    "medications" JSONB,
    "followUp" JSONB,
    "instructions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeSummary_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DischargeSummary_artifactId_key" UNIQUE ("artifactId")
);

CREATE INDEX IF NOT EXISTS "DischargeSummary_artifactId_idx"
  ON "DischargeSummary"("artifactId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'DischargeSummary'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DischargeSummary_artifactId_fkey'
  ) THEN
    ALTER TABLE "DischargeSummary"
      ADD CONSTRAINT "DischargeSummary_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "VitalRecord" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "vitals" JSONB NOT NULL,
    "notes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VitalRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VitalRecord_artifactId_key" UNIQUE ("artifactId")
);

CREATE INDEX IF NOT EXISTS "VitalRecord_artifactId_idx"
  ON "VitalRecord"("artifactId");

CREATE INDEX IF NOT EXISTS "VitalRecord_measuredAt_idx"
  ON "VitalRecord"("measuredAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'VitalRecord'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'ClinicalArtifact'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VitalRecord_artifactId_fkey'
  ) THEN
    ALTER TABLE "VitalRecord"
      ADD CONSTRAINT "VitalRecord_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "ClinicalArtifact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
