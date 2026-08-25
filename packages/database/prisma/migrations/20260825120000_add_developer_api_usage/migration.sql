-- CreateTable
CREATE TABLE "DeveloperApiUsage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastReportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperApiUsage_organisationId_billingPeriod_key" ON "DeveloperApiUsage"("organisationId", "billingPeriod");

-- CreateIndex
CREATE INDEX "DeveloperApiUsage_billingPeriod_idx" ON "DeveloperApiUsage"("billingPeriod");
