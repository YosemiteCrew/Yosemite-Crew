-- Add prescription dispense request workflow support.
CREATE TYPE "PrescriptionDispenseRequestStatus" AS ENUM ('PENDING', 'NOT_DISPENSED', 'DISPENSED');

CREATE TABLE "PrescriptionDispenseRequest" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "status" "PrescriptionDispenseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "medications" JSONB NOT NULL,
    "metadata" JSONB,
    "requestedBy" TEXT,
    "reviewedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionDispenseRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PrescriptionDispenseRequest"
    ADD CONSTRAINT "PrescriptionDispenseRequest_prescriptionId_fkey"
    FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PrescriptionDispenseRequest_prescriptionId_status_requestedAt_idx"
    ON "PrescriptionDispenseRequest"("prescriptionId", "status", "requestedAt");

CREATE INDEX "PrescriptionDispenseRequest_organisationId_status_idx"
    ON "PrescriptionDispenseRequest"("organisationId", "status");
