-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('DEA_1_POSITIVE', 'DEA_1_NEGATIVE', 'TYPE_A', 'TYPE_B', 'TYPE_AB', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TransfusionReaction" AS ENUM ('NONE', 'FEBRILE', 'HAEMOLYTIC', 'ALLERGIC', 'ANAPHYLACTIC', 'CIRCULATORY_OVERLOAD', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'TRANSFUSION_RECORDED';
ALTER TYPE "AuditEventType" ADD VALUE 'TRANSFUSION_REACTION_REPORTED';

-- CreateTable
CREATE TABLE "BloodTransfusion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "donorId" TEXT,
    "productType" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "volumeMl" DOUBLE PRECISION NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "reaction" "TransfusionReaction" NOT NULL DEFAULT 'NONE',
    "reactionNotes" TEXT,
    "administeredBy" TEXT,
    "crossMatchDone" BOOLEAN NOT NULL DEFAULT false,
    "crossMatchResult" TEXT,
    "preTransfusionPCV" DOUBLE PRECISION,
    "postTransfusionPCV" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodTransfusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodTransfusion_organisationId_patientId_idx" ON "BloodTransfusion"("organisationId", "patientId");

-- CreateIndex
CREATE INDEX "BloodTransfusion_encounterId_idx" ON "BloodTransfusion"("encounterId");
