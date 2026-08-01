-- Reconcile index names for OrganizationDocumentAcknowledgements.
--
-- Prisma's drift check is comparing the replayed migration history against the
-- current schema, and the two long index names below now resolve to different
-- physical identifiers than the ones created by the original migration.
--
-- These renames are guarded so the migration is safe to apply whether the
-- database still has the old names or already carries the new ones.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'OrganizationDocumentAcknowledgements_organisationId_documentId_'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'OrganizationDocumentAcknowledgements_organisationId_documen_idx'
  ) THEN
    ALTER INDEX "OrganizationDocumentAcknowledgements_organisationId_documentId_"
      RENAME TO "OrganizationDocumentAcknowledgements_organisationId_documen_idx";
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'OrganizationDocumentAcknowledgements_userId_organisationId_docu'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'OrganizationDocumentAcknowledgements_userId_organisationId__key'
  ) THEN
    ALTER INDEX "OrganizationDocumentAcknowledgements_userId_organisationId_docu"
      RENAME TO "OrganizationDocumentAcknowledgements_userId_organisationId__key";
  END IF;
END
$$;
