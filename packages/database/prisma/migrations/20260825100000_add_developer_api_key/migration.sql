-- CreateEnum
CREATE TYPE "DeveloperApiKeyEnvironment" AS ENUM ('live', 'test');

-- CreateEnum
CREATE TYPE "DeveloperApiKeyStatus" AS ENUM ('active', 'revoked');

-- CreateTable
CREATE TABLE "DeveloperApiKeys" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environment" "DeveloperApiKeyEnvironment" NOT NULL DEFAULT 'live',
    "status" "DeveloperApiKeyStatus" NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperApiKeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperApiKeys_prefix_key" ON "DeveloperApiKeys"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperApiKeys_hashedKey_key" ON "DeveloperApiKeys"("hashedKey");

-- CreateIndex
CREATE INDEX "DeveloperApiKeys_organisationId_idx" ON "DeveloperApiKeys"("organisationId");

-- CreateIndex
CREATE INDEX "DeveloperApiKeys_status_idx" ON "DeveloperApiKeys"("status");
