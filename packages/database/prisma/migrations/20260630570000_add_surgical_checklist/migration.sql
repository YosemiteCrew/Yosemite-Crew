-- CreateEnum
CREATE TYPE "ChecklistPhase" AS ENUM ('SIGN_IN', 'TIME_OUT', 'SIGN_OUT');
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SURGICAL_CHECKLIST_COMPLETED';

-- CreateTable SurgicalChecklist
CREATE TABLE "SurgicalChecklist" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "encounterId"    TEXT NOT NULL,
    "phase"          "ChecklistPhase"  NOT NULL DEFAULT 'SIGN_IN',
    "status"         "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "conductedBy"    TEXT,
    "completedAt"    TIMESTAMP(3),
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgicalChecklist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SurgicalChecklist_organisationId_patientId_idx"   ON "SurgicalChecklist"("organisationId", "patientId");
CREATE INDEX "SurgicalChecklist_organisationId_encounterId_idx" ON "SurgicalChecklist"("organisationId", "encounterId");

-- CreateTable SurgicalChecklistItem
CREATE TABLE "SurgicalChecklistItem" (
    "id"          TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "isChecked"   BOOLEAN NOT NULL DEFAULT false,
    "checkedBy"   TEXT,
    "checkedAt"   TIMESTAMP(3),
    "notes"       TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgicalChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SurgicalChecklistItem_checklistId_idx" ON "SurgicalChecklistItem"("checklistId");

-- AddForeignKey
ALTER TABLE "SurgicalChecklistItem"
    ADD CONSTRAINT "SurgicalChecklistItem_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "SurgicalChecklist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
