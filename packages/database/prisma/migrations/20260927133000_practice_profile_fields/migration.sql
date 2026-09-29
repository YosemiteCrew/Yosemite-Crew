CREATE TYPE "PracticeProfileFieldEntity" AS ENUM ('CLIENT', 'PATIENT');
CREATE TYPE "PracticeProfileFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT'
);

CREATE TABLE "PracticeProfileField" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "entityType" "PracticeProfileFieldEntity" NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "PracticeProfileFieldType" NOT NULL,
  "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeProfileField_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PracticeProfileField_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- The value table's foreign key targets this key, and Postgres requires the
-- referenced unique constraint to already exist, so it is created here rather
-- than with the other indexes below.
CREATE UNIQUE INDEX "PracticeProfileField_id_organisationId_entityType_key"
  ON "PracticeProfileField"("id", "organisationId", "entityType");

-- Uniqueness covers ACTIVE rows only, mirroring 20260510000000. Removing a field
-- is a soft delete, so the row keeps its key and its stored values; a plain
-- unique index would squat that key and make the label impossible to add again
-- once a practice removed it by mistake. Prisma cannot express the WHERE
-- clause, so the constraint lives here and not in the schema.
CREATE UNIQUE INDEX "PracticeProfileField_organisationId_entityType_fieldKey_key"
  ON "PracticeProfileField"("organisationId", "entityType", "fieldKey")
  WHERE "isActive" = true;
CREATE INDEX "PracticeProfileField_organisationId_entityType_isActive_sortOrder_idx"
  ON "PracticeProfileField"("organisationId", "entityType", "isActive", "sortOrder");

CREATE TABLE "PracticeProfileFieldValue" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "entityType" "PracticeProfileFieldEntity" NOT NULL,
  "entityId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeProfileFieldValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PracticeProfileFieldValue_fieldId_organisationId_entityType_fkey"
    FOREIGN KEY ("fieldId", "organisationId", "entityType")
    REFERENCES "PracticeProfileField"("id", "organisationId", "entityType")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PracticeProfileFieldValue_fieldId_entityId_key"
  ON "PracticeProfileFieldValue"("fieldId", "entityId");
CREATE INDEX "PracticeProfileFieldValue_organisationId_entityType_entityId_idx"
  ON "PracticeProfileFieldValue"("organisationId", "entityType", "entityId");

-- ENABLE without FORCE, as 20260818090000 and 20260923170000. The API connects
-- as the owning role, which bypasses row level security, so the reads this
-- change makes visible are the same before and after. It only denies the anon
-- and authenticated PostgREST roles, which no code path here uses.
--
-- deployed-code-survives: both tables are created above in this same migration,
-- so the deployed application has no query that names either of them. The
-- reader and writer for them ship with this migration, as does the API role
-- that bypasses RLS, so nothing the running code does changes.
ALTER TABLE "PracticeProfileField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeProfileFieldValue" ENABLE ROW LEVEL SECURITY;
