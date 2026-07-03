-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'supertokens';

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "authProfile" TEXT,
    "providerUserId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerUserId_key" ON "auth_identities"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "auth_identities_appUserId_idx" ON "auth_identities"("appUserId");

-- CreateIndex
CREATE INDEX "auth_identities_email_idx" ON "auth_identities"("email");
