-- CreateEnum
CREATE TYPE "PhysiotherapyStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "PhysiotherapyPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "surgicalProcedureId" TEXT,
    "diagnosis" TEXT NOT NULL,
    "goals" TEXT,
    "frequency" TEXT,
    "durationMinutes" INTEGER,
    "totalSessions" INTEGER,
    "exercisePrescription" TEXT,
    "hydrotherapy" BOOLEAN NOT NULL DEFAULT false,
    "laserTherapy" BOOLEAN NOT NULL DEFAULT false,
    "therapeuticUltrasound" BOOLEAN NOT NULL DEFAULT false,
    "massage" BOOLEAN NOT NULL DEFAULT false,
    "acupuncture" BOOLEAN NOT NULL DEFAULT false,
    "tapeApplication" BOOLEAN NOT NULL DEFAULT false,
    "precautions" TEXT,
    "homeExercises" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "lastSessionAt" TIMESTAMP(3),
    "nextSessionAt" TIMESTAMP(3),
    "therapist" TEXT,
    "prescribedBy" TEXT,
    "status" "PhysiotherapyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysiotherapyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysiotherapyPlan_organisationId_patientId_idx" ON "PhysiotherapyPlan"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "PhysiotherapyPlan_encounterId_idx" ON "PhysiotherapyPlan"("encounterId");
