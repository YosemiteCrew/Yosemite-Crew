-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('WAITING', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "PatientCheckIn" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "triagePriority" "TriagePriority" NOT NULL DEFAULT 'NON_URGENT',
    "triageNote" TEXT,
    "assignedRoomId" TEXT,
    "checkedInBy" TEXT,
    "waitStartedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "waitMinutes" INTEGER,
    "status" "CheckInStatus" NOT NULL DEFAULT 'WAITING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientCheckIn_organisationId_status_idx" ON "PatientCheckIn"("organisationId", "status");
CREATE INDEX "PatientCheckIn_organisationId_patientId_idx" ON "PatientCheckIn"("organisationId", "patientId");
CREATE INDEX "PatientCheckIn_organisationId_arrivedAt_idx" ON "PatientCheckIn"("organisationId", "arrivedAt");
