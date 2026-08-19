ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WAITLIST_ENTRY_ADDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WAITLIST_ENTRY_OFFERED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WAITLIST_ENTRY_BOOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WAITLIST_ENTRY_CANCELLED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WAITLIST_ENTRY_EXPIRED';

CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "WaitlistEntry" (
    "id"              TEXT NOT NULL,
    "organisationId"  TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "requestedBy"     TEXT,
    "preferredLeadId" TEXT,
    "appointmentType" TEXT,
    "earliestDate"    TIMESTAMP(3),
    "latestDate"      TIMESTAMP(3),
    "notes"           TEXT,
    "status"          "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "offeredAt"       TIMESTAMP(3),
    "bookedAt"        TIMESTAMP(3),
    "expiresAt"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WaitlistEntry_organisationId_status_idx"
    ON "WaitlistEntry"("organisationId", "status");
CREATE INDEX "WaitlistEntry_organisationId_patientId_idx"
    ON "WaitlistEntry"("organisationId", "patientId");
CREATE INDEX "WaitlistEntry_organisationId_earliestDate_latestDate_idx"
    ON "WaitlistEntry"("organisationId", "earliestDate", "latestDate");
