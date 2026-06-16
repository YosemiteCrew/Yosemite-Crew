-- Backfill the template-to-catalog join table that exists in schema.prisma.

CREATE TABLE IF NOT EXISTS "TemplateCatalogLink" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateCatalogLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TemplateCatalogLink_templateId_catalogItemId_key" UNIQUE ("templateId", "catalogItemId")
);

CREATE INDEX IF NOT EXISTS "TemplateCatalogLink_templateId_idx"
  ON "TemplateCatalogLink"("templateId");

CREATE INDEX IF NOT EXISTS "TemplateCatalogLink_catalogItemId_idx"
  ON "TemplateCatalogLink"("catalogItemId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateCatalogLink'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'Template'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TemplateCatalogLink_templateId_fkey'
  ) THEN
    ALTER TABLE "TemplateCatalogLink"
      ADD CONSTRAINT "TemplateCatalogLink_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "Template"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'TemplateCatalogLink'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'ProductItem'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TemplateCatalogLink_catalogItemId_fkey'
  ) THEN
    ALTER TABLE "TemplateCatalogLink"
      ADD CONSTRAINT "TemplateCatalogLink_catalogItemId_fkey"
      FOREIGN KEY ("catalogItemId") REFERENCES "ProductItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
