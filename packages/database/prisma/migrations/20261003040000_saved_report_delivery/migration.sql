CREATE TABLE "SavedReportView" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedReportView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportDeliverySchedule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "recipients" TEXT[],
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "claimUntil" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportDeliverySchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedReportView_organisationId_name_key" ON "SavedReportView"("organisationId", "name");
CREATE INDEX "SavedReportView_organisationId_createdAt_idx" ON "SavedReportView"("organisationId", "createdAt");
CREATE INDEX "ReportDeliverySchedule_active_nextRunAt_idx" ON "ReportDeliverySchedule"("active", "nextRunAt");
CREATE INDEX "ReportDeliverySchedule_organisationId_createdAt_idx" ON "ReportDeliverySchedule"("organisationId", "createdAt");
CREATE INDEX "ReportDeliverySchedule_viewId_idx" ON "ReportDeliverySchedule"("viewId");

ALTER TABLE "SavedReportView" ADD CONSTRAINT "SavedReportView_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportDeliverySchedule" ADD CONSTRAINT "ReportDeliverySchedule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportDeliverySchedule" ADD CONSTRAINT "ReportDeliverySchedule_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "SavedReportView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedReportView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportDeliverySchedule" ENABLE ROW LEVEL SECURITY;
