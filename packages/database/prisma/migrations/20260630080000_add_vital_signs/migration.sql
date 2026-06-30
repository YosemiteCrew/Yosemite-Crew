-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'VITAL_SIGNS_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'VITAL_SIGNS_UPDATED';

-- CreateTable
CREATE TABLE "PatientVitalSign" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "weightKg" DOUBLE PRECISION,
    "temperatureCelsius" DOUBLE PRECISION,
    "pulseRateBpm" INTEGER,
    "respiratoryRateBpm" INTEGER,
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "bodyConditionScore" INTEGER,
    "mucosal" TEXT,
    "capRefillTimeSec" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientVitalSign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientVitalSign_organisationId_patientId_recordedAt_idx"
    ON "PatientVitalSign"("organisationId", "patientId", "recordedAt");

CREATE INDEX "PatientVitalSign_organisationId_patientId_idx"
    ON "PatientVitalSign"("organisationId", "patientId");
