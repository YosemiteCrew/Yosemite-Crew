-- AlterTable
ALTER TABLE "DeveloperApiKeys" ADD COLUMN     "ipAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rotatedFromId" TEXT,
ADD COLUMN     "rotationGraceUntil" TIMESTAMP(3);
