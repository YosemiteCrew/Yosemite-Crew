-- CreateEnum
CREATE TYPE "DevelopmentStudyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExperimentDesignType" AS ENUM ('FULL_FACTORIAL', 'FRACTIONAL_FACTORIAL', 'SCREENING', 'CENTRAL_COMPOSITE', 'BOX_BEHNKEN', 'RESPONSE_SURFACE');

-- CreateEnum
CREATE TYPE "FactorType" AS ENUM ('CONTINUOUS', 'CATEGORICAL', 'BLOCK', 'MIXTURE');

-- CreateEnum
CREATE TYPE "FactorRole" AS ENUM ('INPUT', 'CONSTANT', 'RESPONSE');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DESIGNED', 'RUN_ORDER_LOCKED', 'IN_PROGRESS', 'COMPLETED', 'ANALYZED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'DEVIATED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('LINEAR', 'INTERACTION', 'QUADRATIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ModelFitStatus" AS ENUM ('FITTED', 'REFINED', 'STALE');

-- CreateEnum
CREATE TYPE "PlotType" AS ENUM ('PARETO', 'HALF_NORMAL', 'INTERACTION', 'CONTOUR', 'SURFACE', 'PREDICTED_OPERATING_REGION', 'RESIDUALS', 'ANOVA');

-- CreateTable
CREATE TABLE "DevelopmentStudy" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "description" TEXT,
    "status" "DevelopmentStudyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignedExperiment" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "designType" "ExperimentDesignType" NOT NULL,
    "resolution" INTEGER,
    "aliases" JSONB,
    "centrePoints" INTEGER NOT NULL DEFAULT 0,
    "blocks" INTEGER NOT NULL DEFAULT 1,
    "replicates" INTEGER NOT NULL DEFAULT 1,
    "randomSeed" TEXT,
    "runOrderLocked" BOOLEAN NOT NULL DEFAULT false,
    "runOrderLockedAt" TIMESTAMP(3),
    "runOrderLockedBy" TEXT,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DESIGNED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignedExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentFactor" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "type" "FactorType" NOT NULL,
    "role" "FactorRole" NOT NULL DEFAULT 'INPUT',
    "unit" TEXT,
    "lowLevel" DOUBLE PRECISION,
    "highLevel" DOUBLE PRECISION,
    "levels" JSONB,
    "goal" TEXT,
    "isConstant" BOOLEAN NOT NULL DEFAULT false,
    "constantValue" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentResponse" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "unit" TEXT,
    "goal" TEXT,
    "target" DOUBLE PRECISION,
    "lowerSpec" DOUBLE PRECISION,
    "upperSpec" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRun" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "standardOrder" INTEGER,
    "blockNumber" INTEGER,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "seed" TEXT,
    "deviationNotes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRunFactorValue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentRunFactorValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRunResponseValue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentRunResponseValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentModel" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ModelType" NOT NULL,
    "formula" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "anovaTable" JSONB,
    "lackOfFit" JSONB,
    "estimates" JSONB,
    "residuals" JSONB,
    "rSquared" DOUBLE PRECISION,
    "rSquaredAdjusted" DOUBLE PRECISION,
    "rSquaredPredicted" DOUBLE PRECISION,
    "pValue" DOUBLE PRECISION,
    "status" "ModelFitStatus" NOT NULL DEFAULT 'FITTED',
    "fittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fittedBy" TEXT NOT NULL,
    "environmentHash" TEXT,
    "environmentSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentPlot" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "modelId" TEXT,
    "type" "PlotType" NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "imageData" BYTEA,
    "pdfData" BYTEA,
    "spreadsheetData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentPlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessParameterRange" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "lowerBound" DOUBLE PRECISION NOT NULL,
    "upperBound" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "confidenceLevel" DOUBLE PRECISION,
    "evidenceType" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "staleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessParameterRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessParameterRangeLink" (
    "id" TEXT NOT NULL,
    "rangeId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "modelId" TEXT,
    "linkType" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedBy" TEXT NOT NULL,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "staledAt" TIMESTAMP(3),
    "staledBy" TEXT,
    "staleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessParameterRangeLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevelopmentStudy_organisationId_idx" ON "DevelopmentStudy"("organisationId");

-- CreateIndex
CREATE INDEX "DevelopmentStudy_organisationId_status_idx" ON "DevelopmentStudy"("organisationId", "status");

-- CreateIndex
CREATE INDEX "DevelopmentStudy_productCode_idx" ON "DevelopmentStudy"("productCode");

-- CreateIndex
CREATE INDEX "DesignedExperiment_studyId_idx" ON "DesignedExperiment"("studyId");

-- CreateIndex
CREATE INDEX "DesignedExperiment_studyId_status_idx" ON "DesignedExperiment"("studyId", "status");

-- CreateIndex
CREATE INDEX "DesignedExperiment_designType_idx" ON "DesignedExperiment"("designType");

-- CreateIndex
CREATE INDEX "ExperimentFactor_experimentId_sortOrder_idx" ON "ExperimentFactor"("experimentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentFactor_experimentId_name_key" ON "ExperimentFactor"("experimentId", "name");

-- CreateIndex
CREATE INDEX "ExperimentResponse_experimentId_sortOrder_idx" ON "ExperimentResponse"("experimentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentResponse_experimentId_name_key" ON "ExperimentResponse"("experimentId", "name");

-- CreateIndex
CREATE INDEX "ExperimentRun_experimentId_standardOrder_idx" ON "ExperimentRun"("experimentId", "standardOrder");

-- CreateIndex
CREATE INDEX "ExperimentRun_experimentId_blockNumber_idx" ON "ExperimentRun"("experimentId", "blockNumber");

-- CreateIndex
CREATE INDEX "ExperimentRun_experimentId_status_idx" ON "ExperimentRun"("experimentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentRun_experimentId_runNumber_key" ON "ExperimentRun"("experimentId", "runNumber");

-- CreateIndex
CREATE INDEX "ExperimentRunFactorValue_runId_idx" ON "ExperimentRunFactorValue"("runId");

-- CreateIndex
CREATE INDEX "ExperimentRunFactorValue_factorId_idx" ON "ExperimentRunFactorValue"("factorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentRunFactorValue_runId_factorId_key" ON "ExperimentRunFactorValue"("runId", "factorId");

-- CreateIndex
CREATE INDEX "ExperimentRunResponseValue_runId_idx" ON "ExperimentRunResponseValue"("runId");

-- CreateIndex
CREATE INDEX "ExperimentRunResponseValue_responseId_idx" ON "ExperimentRunResponseValue"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentRunResponseValue_runId_responseId_key" ON "ExperimentRunResponseValue"("runId", "responseId");

-- CreateIndex
CREATE INDEX "ExperimentModel_experimentId_idx" ON "ExperimentModel"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentModel_experimentId_status_idx" ON "ExperimentModel"("experimentId", "status");

-- CreateIndex
CREATE INDEX "ExperimentPlot_experimentId_idx" ON "ExperimentPlot"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentPlot_experimentId_type_idx" ON "ExperimentPlot"("experimentId", "type");

-- CreateIndex
CREATE INDEX "ProcessParameterRange_studyId_idx" ON "ProcessParameterRange"("studyId");

-- CreateIndex
CREATE INDEX "ProcessParameterRange_studyId_parameterName_idx" ON "ProcessParameterRange"("studyId", "parameterName");

-- CreateIndex
CREATE INDEX "ProcessParameterRangeLink_rangeId_idx" ON "ProcessParameterRangeLink"("rangeId");

-- CreateIndex
CREATE INDEX "ProcessParameterRangeLink_experimentId_idx" ON "ProcessParameterRangeLink"("experimentId");

-- CreateIndex
CREATE INDEX "ProcessParameterRangeLink_modelId_idx" ON "ProcessParameterRangeLink"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessParameterRangeLink_rangeId_experimentId_modelId_key" ON "ProcessParameterRangeLink"("rangeId", "experimentId", "modelId");

-- AddForeignKey
ALTER TABLE "DesignedExperiment" ADD CONSTRAINT "DesignedExperiment_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "DevelopmentStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentFactor" ADD CONSTRAINT "ExperimentFactor_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "DesignedExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResponse" ADD CONSTRAINT "ExperimentResponse_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "DesignedExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "DesignedExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRunFactorValue" ADD CONSTRAINT "ExperimentRunFactorValue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExperimentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRunFactorValue" ADD CONSTRAINT "ExperimentRunFactorValue_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "ExperimentFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRunResponseValue" ADD CONSTRAINT "ExperimentRunResponseValue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExperimentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRunResponseValue" ADD CONSTRAINT "ExperimentRunResponseValue_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ExperimentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentModel" ADD CONSTRAINT "ExperimentModel_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "DesignedExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentPlot" ADD CONSTRAINT "ExperimentPlot_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "DesignedExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentPlot" ADD CONSTRAINT "ExperimentPlot_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ExperimentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessParameterRange" ADD CONSTRAINT "ProcessParameterRange_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "DevelopmentStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessParameterRangeLink" ADD CONSTRAINT "ProcessParameterRangeLink_rangeId_fkey" FOREIGN KEY ("rangeId") REFERENCES "ProcessParameterRange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessParameterRangeLink" ADD CONSTRAINT "ProcessParameterRangeLink_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "DesignedExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessParameterRangeLink" ADD CONSTRAINT "ProcessParameterRangeLink_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ExperimentModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DevelopmentStudy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesignedExperiment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentFactor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentRunFactorValue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentRunResponseValue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentModel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExperimentPlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessParameterRange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessParameterRangeLink" ENABLE ROW LEVEL SECURITY;
