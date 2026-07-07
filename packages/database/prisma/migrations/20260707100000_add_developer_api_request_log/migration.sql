-- CreateTable
CREATE TABLE "DeveloperApiRequestLogs" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "environment" "DeveloperApiKeyEnvironment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperApiRequestLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperApiRequestLogs_organisationId_createdAt_idx" ON "DeveloperApiRequestLogs"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "DeveloperApiRequestLogs_apiKeyId_createdAt_idx" ON "DeveloperApiRequestLogs"("apiKeyId", "createdAt");
