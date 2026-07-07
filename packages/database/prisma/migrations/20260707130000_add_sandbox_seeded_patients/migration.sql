-- AlterTable
ALTER TABLE "DeveloperSandboxes" ADD COLUMN "seededPatientIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
