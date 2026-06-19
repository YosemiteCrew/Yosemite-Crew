-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WorkspaceDocumentPacketStatus" AS ENUM ('DRAFT', 'FINAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceDocumentPacket" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "encounterId" TEXT NOT NULL,
  "companionId" TEXT,
  "status" "WorkspaceDocumentPacketStatus" NOT NULL DEFAULT 'DRAFT',
  "documents" JSONB NOT NULL,
  "signedBy" TEXT,
  "signedByName" TEXT,
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceDocumentPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceDocumentPacket_organisationId_idx"
  ON "WorkspaceDocumentPacket"("organisationId");
CREATE INDEX IF NOT EXISTS "WorkspaceDocumentPacket_organisationId_encounterId_idx"
  ON "WorkspaceDocumentPacket"("organisationId", "encounterId");
CREATE INDEX IF NOT EXISTS "WorkspaceDocumentPacket_organisationId_appointmentId_idx"
  ON "WorkspaceDocumentPacket"("organisationId", "appointmentId");
CREATE INDEX IF NOT EXISTS "WorkspaceDocumentPacket_organisationId_companionId_idx"
  ON "WorkspaceDocumentPacket"("organisationId", "companionId");
