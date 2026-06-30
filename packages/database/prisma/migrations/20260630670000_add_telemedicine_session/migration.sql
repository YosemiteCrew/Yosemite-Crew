-- CreateEnum
CREATE TYPE "TelemedicinePlatform" AS ENUM ('VIDEO_CALL', 'PHONE_CALL', 'CHAT', 'EMAIL');

-- CreateEnum
CREATE TYPE "TelemedicineStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "TelemedicineSession" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "clientId" TEXT NOT NULL,
    "patientId" TEXT,
    "platform" "TelemedicinePlatform" NOT NULL,
    "status" "TelemedicineStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "conductedBy" TEXT,
    "chiefComplaint" TEXT,
    "clinicianNotes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "recordingUrl" TEXT,
    "externalSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemedicineSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelemedicineSession_organisationId_clientId_idx" ON "TelemedicineSession"("organisationId", "clientId");
CREATE INDEX "TelemedicineSession_organisationId_status_idx" ON "TelemedicineSession"("organisationId", "status");
CREATE INDEX "TelemedicineSession_organisationId_appointmentId_idx" ON "TelemedicineSession"("organisationId", "appointmentId");
