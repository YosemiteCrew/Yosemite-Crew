-- CreateTable
CREATE TABLE "HospitalizationMonitoring" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "encounterId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "observedBy" TEXT,
    "temperature" DECIMAL(65,30),
    "temperatureUnit" TEXT,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "spo2" INTEGER,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "etco2" INTEGER,
    "painScore" INTEGER,
    "crtSecs" DECIMAL(65,30),
    "mucousMembranes" TEXT,
    "inputMl" DECIMAL(65,30),
    "outputMl" DECIMAL(65,30),
    "mentalStatus" TEXT,
    "appetite" TEXT,
    "urination" TEXT,
    "defecation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalizationMonitoring_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalizationMonitoring_organisationId_patientId_idx" ON "HospitalizationMonitoring"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "HospitalizationMonitoring_organisationId_admissionId_idx" ON "HospitalizationMonitoring"("organisationId", "admissionId");

-- CreateIndex
CREATE INDEX "HospitalizationMonitoring_observedAt_idx" ON "HospitalizationMonitoring"("observedAt");
