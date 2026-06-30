-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM (
    'OPEN','INVESTIGATING','PENDING_RESPONSE','RESOLVED','CLOSED','ESCALATED'
);
CREATE TYPE "ComplaintCategory" AS ENUM (
    'CLINICAL_CARE','COMMUNICATION','BILLING','WAIT_TIMES',
    'FACILITIES','STAFF_CONDUCT','OUTCOME_CONCERN','OTHER'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CLIENT_COMPLAINT_OPENED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CLIENT_COMPLAINT_RESOLVED';

-- CreateTable ClientComplaint
CREATE TABLE "ClientComplaint" (
    "id"              TEXT NOT NULL,
    "organisationId"  TEXT NOT NULL,
    "clientId"        TEXT NOT NULL,
    "patientId"       TEXT,
    "encounterId"     TEXT,
    "status"          "ComplaintStatus"  NOT NULL DEFAULT 'OPEN',
    "category"        "ComplaintCategory" NOT NULL DEFAULT 'OTHER',
    "summary"         TEXT NOT NULL,
    "description"     TEXT,
    "reportedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedBy"      TEXT,
    "assignedTo"      TEXT,
    "resolvedAt"      TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientComplaint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientComplaint_organisationId_status_idx"   ON "ClientComplaint"("organisationId", "status");
CREATE INDEX "ClientComplaint_organisationId_clientId_idx" ON "ClientComplaint"("organisationId", "clientId");

-- CreateTable ClientComplaintNote
CREATE TABLE "ClientComplaintNote" (
    "id"          TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorId"    TEXT,
    "content"     TEXT NOT NULL,
    "isInternal"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientComplaintNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientComplaintNote_complaintId_idx" ON "ClientComplaintNote"("complaintId");

-- AddForeignKey
ALTER TABLE "ClientComplaintNote"
    ADD CONSTRAINT "ClientComplaintNote_complaintId_fkey"
    FOREIGN KEY ("complaintId") REFERENCES "ClientComplaint"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
