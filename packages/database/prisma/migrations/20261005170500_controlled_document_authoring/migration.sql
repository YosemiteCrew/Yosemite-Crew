CREATE TYPE "ControlledDocumentVersionStatus" AS ENUM ('DRAFT', 'EFFECTIVE', 'SUPERSEDED');
CREATE TYPE "DocumentAuthoringLockKind" AS ENUM ('CHECK_OUT', 'CO_AUTHORING');
CREATE TYPE "AuthoringSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

CREATE TABLE "ControlledDocument" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "latestVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ControlledDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ControlledDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "majorVersion" INTEGER NOT NULL DEFAULT 1,
    "minorVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "ControlledDocumentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "renditionUrl" TEXT NOT NULL,
    "renditionContentType" TEXT NOT NULL,
    "contributorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlledDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthoringSession" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "status" "AuthoringSessionStatus" NOT NULL DEFAULT 'OPEN',
    "editorProvider" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "workingState" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "invitedMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contributorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openedBy" TEXT NOT NULL,
    "closedBy" TEXT,
    "producedVersionId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthoringSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentAuthoringLock" (
    "documentId" TEXT NOT NULL,
    "kind" "DocumentAuthoringLockKind" NOT NULL,
    "holderId" TEXT NOT NULL,
    "sessionId" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAuthoringLock_pkey" PRIMARY KEY ("documentId")
);

CREATE TABLE "AuthoringSessionMember" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "contributedAt" TIMESTAMP(3),
    CONSTRAINT "AuthoringSessionMember_pkey" PRIMARY KEY ("sessionId", "userId")
);

CREATE UNIQUE INDEX "ControlledDocument_latestVersionId_key" ON "ControlledDocument"("latestVersionId");
CREATE INDEX "ControlledDocument_organisationId_updatedAt_idx" ON "ControlledDocument"("organisationId", "updatedAt");
CREATE UNIQUE INDEX "ControlledDocumentVersion_supersedesVersionId_key" ON "ControlledDocumentVersion"("supersedesVersionId");
CREATE UNIQUE INDEX "ControlledDocumentVersion_documentId_majorVersion_minorVersion_key" ON "ControlledDocumentVersion"("documentId", "majorVersion", "minorVersion");
CREATE INDEX "ControlledDocumentVersion_documentId_createdAt_idx" ON "ControlledDocumentVersion"("documentId", "createdAt");
CREATE UNIQUE INDEX "AuthoringSession_producedVersionId_key" ON "AuthoringSession"("producedVersionId");
CREATE INDEX "AuthoringSession_organisationId_documentId_status_idx" ON "AuthoringSession"("organisationId", "documentId", "status");
CREATE INDEX "AuthoringSession_baseVersionId_idx" ON "AuthoringSession"("baseVersionId");
CREATE UNIQUE INDEX "DocumentAuthoringLock_sessionId_key" ON "DocumentAuthoringLock"("sessionId");
CREATE INDEX "AuthoringSessionMember_userId_lastActiveAt_idx" ON "AuthoringSessionMember"("userId", "lastActiveAt");

ALTER TABLE "ControlledDocument" ADD CONSTRAINT "ControlledDocument_latestVersionId_fkey" FOREIGN KEY ("latestVersionId") REFERENCES "ControlledDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ControlledDocumentVersion" ADD CONSTRAINT "ControlledDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlledDocumentVersion" ADD CONSTRAINT "ControlledDocumentVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "ControlledDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoringSession" ADD CONSTRAINT "AuthoringSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthoringSession" ADD CONSTRAINT "AuthoringSession_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "ControlledDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoringSession" ADD CONSTRAINT "AuthoringSession_producedVersionId_fkey" FOREIGN KEY ("producedVersionId") REFERENCES "ControlledDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentAuthoringLock" ADD CONSTRAINT "DocumentAuthoringLock_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAuthoringLock" ADD CONSTRAINT "DocumentAuthoringLock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthoringSessionMember" ADD CONSTRAINT "AuthoringSessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ControlledDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ControlledDocumentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthoringSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentAuthoringLock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthoringSessionMember" ENABLE ROW LEVEL SECURITY;
