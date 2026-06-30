-- CreateEnum
CREATE TYPE "PostOpCareStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'POST_OP_PLAN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'POST_OP_PLAN_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE 'POST_OP_PLAN_COMPLETED';

-- CreateTable
CREATE TABLE "PostOpCarePlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "surgicalProcedureId" TEXT,
    "status" "PostOpCareStatus" NOT NULL DEFAULT 'ACTIVE',
    "painScore" INTEGER,
    "analgesiaProtocol" TEXT,
    "woundCareInstructions" TEXT,
    "activityRestrictions" TEXT,
    "dietaryNotes" TEXT,
    "fluidTherapyNotes" TEXT,
    "monitoringParams" TEXT,
    "firstReviewAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "prescribedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostOpCarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostOpCarePlan_organisationId_patientId_idx" ON "PostOpCarePlan"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "PostOpCarePlan_encounterId_idx" ON "PostOpCarePlan"("encounterId");
