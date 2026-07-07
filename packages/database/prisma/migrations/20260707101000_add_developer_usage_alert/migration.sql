-- CreateTable
CREATE TABLE "DeveloperUsageAlerts" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperUsageAlerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperUsageAlerts_organisationId_billingPeriod_threshold_key" ON "DeveloperUsageAlerts"("organisationId", "billingPeriod", "threshold");
