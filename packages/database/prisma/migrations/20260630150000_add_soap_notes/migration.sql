-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'SOAP_NOTE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SOAP_NOTE_SIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'SOAP_NOTE_AMENDED';

-- CreateTable
CREATE TABLE "SOAPNote" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "authorId" TEXT,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedBy" TEXT,
    "isAmended" BOOLEAN NOT NULL DEFAULT false,
    "amendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOAPNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SOAPNote_organisationId_patientId_idx" ON "SOAPNote"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "SOAPNote_encounterId_idx" ON "SOAPNote"("encounterId");
