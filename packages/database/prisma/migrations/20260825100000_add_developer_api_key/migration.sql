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

-- Enable row level security, as 20260818090000_enable_row_level_security does for
-- every table that existed when it ran. That migration is a one-shot loop, so a
-- table created after it ships unprotected: Supabase exposes everything in
-- `public` over PostgREST to the `anon` and `authenticated` keys, and with RLS
-- off those keys can read it directly. The API connects as the owning role, which
-- bypasses RLS, so Prisma queries are unaffected; enabling with no policy simply
-- denies the PostgREST path by default. CI enforces this.
ALTER TABLE "DeveloperApiKeys" ENABLE ROW LEVEL SECURITY;
