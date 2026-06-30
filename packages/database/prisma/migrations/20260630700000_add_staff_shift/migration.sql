CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "StaffShift" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "staffId"        TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "shiftDate"      TIMESTAMP(3) NOT NULL,
    "startTime"      TIMESTAMP(3) NOT NULL,
    "endTime"        TIMESTAMP(3) NOT NULL,
    "breakMinutes"   INTEGER,
    "status"         "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes"          TEXT,
    "createdBy"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffShift_organisationId_shiftDate_idx" ON "StaffShift"("organisationId", "shiftDate");
CREATE INDEX "StaffShift_organisationId_staffId_idx" ON "StaffShift"("organisationId", "staffId");
CREATE INDEX "StaffShift_organisationId_status_idx" ON "StaffShift"("organisationId", "status");

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'STAFF_SHIFT_SCHEDULED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'STAFF_SHIFT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'STAFF_SHIFT_CANCELLED';
