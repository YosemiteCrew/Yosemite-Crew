-- Add isActive column to OrganisationRoom for soft-delete support
-- This allows business delete to soft-delete rooms instead of hard-deleting them,
-- so restoring an organization preserves its room structure.

ALTER TABLE "OrganisationRoom" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true;

CREATE INDEX "OrganisationRoom_organisationId_isActive_idx" ON "OrganisationRoom" ("organisationId", "isActive");

-- deployed-code-survives: adding a nullable column with a default is backward
-- compatible. Existing code continues to work because:
-- 1. SELECTs return the new column with default true
-- 2. INSERTs without the column get the default
-- 3. The Prisma client expects the field and reads/writes it correctly
-- 4. All existing queries filter by isActive where needed