-- CreateEnum
CREATE TYPE "SharedChatEntityType" AS ENUM ('COMPANION', 'APPOINTMENT', 'INVOICE', 'FORM', 'PRESCRIPTION', 'DOCUMENT');

-- CreateTable
CREATE TABLE "SharedChatEntity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "sessionId" TEXT,
    "messageId" TEXT,
    "entityType" "SharedChatEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT,
    "snapshot" JSONB,
    "sharedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedChatEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedChatEntity_organisationId_idx" ON "SharedChatEntity"("organisationId");

-- CreateIndex
CREATE INDEX "SharedChatEntity_channelId_idx" ON "SharedChatEntity"("channelId");

-- CreateIndex
CREATE INDEX "SharedChatEntity_entityType_entityId_idx" ON "SharedChatEntity"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SharedChatEntity_sharedById_idx" ON "SharedChatEntity"("sharedById");
