-- CreateEnum
CREATE TYPE "ClinicalAlertType" AS ENUM ('DRUG_INTERACTION', 'CRITICAL_LAB_VALUE', 'OVERDUE_VACCINATION', 'ALLERGY_CONTRAINDICATION', 'DOSE_CHECK', 'ABNORMAL_VITALS', 'SPECIALIST_REVIEW_DUE', 'WEIGHT_THRESHOLD', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicalAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "ClinicalAlertLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "alertType" "ClinicalAlertType" NOT NULL,
    "severity" "ClinicalAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "triggeredBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "acknowledgedNote" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalAlertLog_organisationId_patientId_idx" ON "ClinicalAlertLog"("organisationId", "patientId");
CREATE INDEX "ClinicalAlertLog_organisationId_severity_idx" ON "ClinicalAlertLog"("organisationId", "severity");
CREATE INDEX "ClinicalAlertLog_organisationId_dismissed_idx" ON "ClinicalAlertLog"("organisationId", "dismissed");
