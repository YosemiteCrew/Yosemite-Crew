-- Add Documenso signing state to document packets (merged clinical packet signing).
ALTER TABLE "WorkspaceDocumentPacket" ADD COLUMN "signing" JSONB;
