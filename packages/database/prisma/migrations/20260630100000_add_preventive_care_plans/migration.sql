-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'CARE_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CARE_PLAN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CARE_PLAN_CANCELLED';
ALTER TYPE "AuditEventType" ADD VALUE 'CARE_PLAN_ITEM_COMPLETED';

-- CreateEnum
CREATE TYPE "PreventiveCareFrequency" AS ENUM (
    'WEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL', 'CUSTOM'
);

CREATE TYPE "PreventiveCareStatus" AS ENUM (
    'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'
);

-- CreateTable
CREATE TABLE "PreventiveCarePlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PreventiveCareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveCarePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreventiveCareItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "careType" TEXT NOT NULL,
    "frequency" "PreventiveCareFrequency" NOT NULL,
    "intervalDays" INTEGER,
    "lastDoneAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveCareItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreventiveCarePlan_organisationId_patientId_status_idx"
    ON "PreventiveCarePlan"("organisationId", "patientId", "status");

CREATE INDEX "PreventiveCarePlan_organisationId_patientId_idx"
    ON "PreventiveCarePlan"("organisationId", "patientId");

CREATE INDEX "PreventiveCareItem_organisationId_nextDueAt_idx"
    ON "PreventiveCareItem"("organisationId", "nextDueAt");

CREATE INDEX "PreventiveCareItem_planId_idx"
    ON "PreventiveCareItem"("planId");

-- AddForeignKey
ALTER TABLE "PreventiveCareItem"
    ADD CONSTRAINT "PreventiveCareItem_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "PreventiveCarePlan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
