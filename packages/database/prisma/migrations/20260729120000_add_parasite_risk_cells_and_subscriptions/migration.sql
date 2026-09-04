-- CreateEnum
CREATE TYPE "ParasiteRiskTier" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'EXTREME');

-- CreateTable
CREATE TABLE "ParasiteRiskCell" (
    "id" TEXT NOT NULL,
    "latBucket" DOUBLE PRECISION NOT NULL,
    "lonBucket" DOUBLE PRECISION NOT NULL,
    "countryCode" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "overallTier" "ParasiteRiskTier" NOT NULL,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "readings" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParasiteRiskCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParasiteRiskSubscription" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "latBucket" DOUBLE PRECISION NOT NULL,
    "lonBucket" DOUBLE PRECISION NOT NULL,
    "countryCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "alertTier" "ParasiteRiskTier" NOT NULL DEFAULT 'HIGH',
    "alertedTiers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParasiteRiskSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParasiteRiskCell_computedAt_idx" ON "ParasiteRiskCell"("computedAt");

-- CreateIndex
CREATE INDEX "ParasiteRiskCell_countryCode_idx" ON "ParasiteRiskCell"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "ParasiteRiskCell_latBucket_lonBucket_modelVersion_key" ON "ParasiteRiskCell"("latBucket", "lonBucket", "modelVersion");

-- CreateIndex
CREATE INDEX "ParasiteRiskSubscription_parentId_idx" ON "ParasiteRiskSubscription"("parentId");

-- CreateIndex
CREATE INDEX "ParasiteRiskSubscription_latBucket_lonBucket_idx" ON "ParasiteRiskSubscription"("latBucket", "lonBucket");

-- CreateIndex
CREATE UNIQUE INDEX "ParasiteRiskSubscription_parentId_latBucket_lonBucket_key" ON "ParasiteRiskSubscription"("parentId", "latBucket", "lonBucket");
