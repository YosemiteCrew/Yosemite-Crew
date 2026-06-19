-- Backfill the template-backed form assignment model added in schema.prisma.

DO $$
BEGIN
  CREATE TYPE "FormAssignmentStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'VIEWED',
    'SUBMITTED',
    'SIGNED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FormAssignment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "appointmentId" TEXT,
    "encounterId" TEXT,
    "companionId" TEXT,
    "signerUserId" TEXT,
    "signerName" TEXT,
    "signerEmail" TEXT,
    "signerRole" TEXT,
    "mobileVisible" BOOLEAN NOT NULL DEFAULT true,
    "signingRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "FormAssignmentStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FormAssignment_organisationId_appointmentId_idx"
  ON "FormAssignment"("organisationId", "appointmentId");

CREATE INDEX IF NOT EXISTS "FormAssignment_organisationId_companionId_idx"
  ON "FormAssignment"("organisationId", "companionId");

CREATE INDEX IF NOT EXISTS "FormAssignment_organisationId_status_idx"
  ON "FormAssignment"("organisationId", "status");

CREATE INDEX IF NOT EXISTS "FormAssignment_templateId_templateVersion_idx"
  ON "FormAssignment"("templateId", "templateVersion");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'FormAssignment'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'Template'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FormAssignment_templateId_fkey'
  ) THEN
    ALTER TABLE "FormAssignment"
      ADD CONSTRAINT "FormAssignment_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "Template"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'FormAssignment'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'Appointment'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FormAssignment_appointmentId_fkey'
  ) THEN
    ALTER TABLE "FormAssignment"
      ADD CONSTRAINT "FormAssignment_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'FormAssignment'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'Patient'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FormAssignment_companionId_fkey'
  ) THEN
    ALTER TABLE "FormAssignment"
      ADD CONSTRAINT "FormAssignment_companionId_fkey"
      FOREIGN KEY ("companionId") REFERENCES "Patient"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
