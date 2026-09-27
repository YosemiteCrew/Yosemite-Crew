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

CREATE UNIQUE INDEX "PracticeProfileField_organisationId_entityType_fieldKey_key"
  ON "PracticeProfileField"("organisationId", "entityType", "fieldKey");
CREATE UNIQUE INDEX "PracticeProfileField_id_organisationId_entityType_key"
  ON "PracticeProfileField"("id", "organisationId", "entityType");
CREATE INDEX "PracticeProfileField_organisationId_entityType_isActive_sortOrder_idx"
  ON "PracticeProfileField"("organisationId", "entityType", "isActive", "sortOrder");
CREATE UNIQUE INDEX "PracticeProfileFieldValue_fieldId_entityId_key"
  ON "PracticeProfileFieldValue"("fieldId", "entityId");
CREATE INDEX "PracticeProfileFieldValue_organisationId_entityType_entityId_idx"
  ON "PracticeProfileFieldValue"("organisationId", "entityType", "entityId");

ALTER TABLE "PracticeProfileField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeProfileFieldValue" ENABLE ROW LEVEL SECURITY;
