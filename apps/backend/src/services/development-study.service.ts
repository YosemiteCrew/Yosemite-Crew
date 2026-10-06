import {
  Prisma,
  FactorRole as PrismaFactorRole,
  FactorType as PrismaFactorType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "src/config/prisma";
import {
  DevelopmentStudyStatus,
  ExperimentDesignType,
  FactorType,
  FactorRole,
  ExperimentStatus,
  RunStatus,
  ModelType,
  ModelFitStatus,
  PlotType,
  DesignedExperiment,
  DevelopmentStudy,
  ExperimentFactor,
  ExperimentResponse,
  ExperimentRun,
  ExperimentRunFactorValue,
  ExperimentRunResponseValue,
  ExperimentModel,
  ExperimentPlot,
  ProcessParameterRange,
  ProcessParameterRangeLink,
} from "@yosemite-crew/types";

const MAX_GENERATED_RUNS = 1_000;

export interface CreateDevelopmentStudyInput {
  organisationId: string;
  productName: string;
  productCode?: string;
  description?: string;
  createdById: string;
}

export interface CreateDesignedExperimentInput {
  studyId: string;
  name: string;
  description?: string;
  designType: ExperimentDesignType;
  resolution?: number;
  aliases?: unknown;
  centrePoints?: number;
  blocks?: number;
  replicates?: number;
  randomSeed?: string;
  createdById: string;
}

export interface CreateExperimentFactorInput {
  experimentId: string;
  name: string;
  displayName?: string;
  type: FactorType;
  role?: FactorRole;
  unit?: string;
  lowLevel?: number;
  highLevel?: number;
  levels?: unknown;
  goal?: string;
  isConstant?: boolean;
  constantValue?: number;
  sortOrder?: number;
}

export interface CreateExperimentResponseInput {
  experimentId: string;
  name: string;
  displayName?: string;
  unit?: string;
  goal?: string;
  target?: number;
  lowerSpec?: number;
  upperSpec?: number;
  sortOrder?: number;
}

export interface LockRunOrderInput {
  experimentId: string;
  lockedBy: string;
  randomSeed?: string;
}

export interface CreateExperimentRunInput {
  experimentId: string;
  runNumber: number;
  standardOrder?: number;
  blockNumber?: number;
  seed?: string;
}

export interface UpdateRunStatusInput {
  runId: string;
  status: RunStatus;
  deviationNotes?: string;
  completedBy?: string;
}

export interface SetRunFactorValueInput {
  runId: string;
  factorId: string;
  value: number;
}

export interface SetRunResponseValueInput {
  runId: string;
  responseId: string;
  value: number;
}

export interface FitModelInput {
  experimentId: string;
  name: string;
  type: ModelType;
  formula: string;
  terms: unknown;
  anovaTable?: unknown;
  lackOfFit?: unknown;
  estimates?: unknown;
  residuals?: unknown;
  rSquared?: number;
  rSquaredAdjusted?: number;
  rSquaredPredicted?: number;
  pValue?: number;
  fittedBy: string;
  environmentHash?: string;
  environmentSnapshot?: unknown;
}

export interface CreateExperimentPlotInput {
  experimentId: string;
  modelId?: string;
  type: PlotType;
  title: string;
  config: unknown;
  imageData?: Uint8Array<ArrayBuffer>;
  pdfData?: Uint8Array<ArrayBuffer>;
  spreadsheetData?: unknown;
}

export interface CreateProcessParameterRangeInput {
  studyId: string;
  parameterName: string;
  lowerBound: number;
  upperBound: number;
  unit?: string;
  confidenceLevel?: number;
  evidenceType?: string;
}

export interface LinkRangeToExperimentInput {
  rangeId: string;
  experimentId: string;
  modelId?: string;
  linkType: string;
  linkedBy: string;
}

export interface MarkRangeStaleInput {
  linkId: string;
  staledBy: string;
  staleReason: string;
}

export class DevelopmentStudyService {
  private readonly prisma = prisma;

  async createStudy(
    input: CreateDevelopmentStudyInput,
  ): Promise<DevelopmentStudy> {
    return this.prisma.developmentStudy.create({
      data: {
        organisationId: input.organisationId,
        productName: input.productName,
        productCode: input.productCode,
        description: input.description,
        status: DevelopmentStudyStatus.DRAFT,
        createdById: input.createdById,
      },
    });
  }

  async getStudyById(studyId: string): Promise<DevelopmentStudy | null> {
    return this.prisma.developmentStudy.findUnique({
      where: { id: studyId },
    });
  }

  async getStudiesByOrganisation(
    organisationId: string,
  ): Promise<DevelopmentStudy[]> {
    return this.prisma.developmentStudy.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateStudyStatus(
    studyId: string,
    status: DevelopmentStudyStatus,
  ): Promise<DevelopmentStudy> {
    return this.prisma.developmentStudy.update({
      where: { id: studyId },
      data: { status },
    });
  }

  async createExperiment(
    input: CreateDesignedExperimentInput,
  ): Promise<DesignedExperiment> {
    return this.prisma.designedExperiment.create({
      data: {
        studyId: input.studyId,
        name: input.name,
        description: input.description,
        designType: input.designType,
        resolution: input.resolution,
        aliases: input.aliases as Prisma.InputJsonValue | undefined,
        centrePoints: input.centrePoints ?? 0,
        blocks: input.blocks ?? 1,
        replicates: input.replicates ?? 1,
        randomSeed: input.randomSeed,
        status: ExperimentStatus.DESIGNED,
        createdById: input.createdById,
      },
    });
  }

  async getExperimentById(
    experimentId: string,
  ): Promise<DesignedExperiment | null> {
    return this.prisma.designedExperiment.findUnique({
      where: { id: experimentId },
      include: {
        factors: { orderBy: { sortOrder: "asc" } },
        responses: { orderBy: { sortOrder: "asc" } },
        runs: { orderBy: { runNumber: "asc" } },
        models: { orderBy: { createdAt: "desc" } },
        plots: true,
      },
    });
  }

  async getExperimentsByStudy(studyId: string): Promise<DesignedExperiment[]> {
    return this.prisma.designedExperiment.findMany({
      where: { studyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateExperimentStatus(
    experimentId: string,
    status: ExperimentStatus,
  ): Promise<DesignedExperiment> {
    return this.prisma.designedExperiment.update({
      where: { id: experimentId },
      data: { status },
    });
  }

  async addFactor(
    input: CreateExperimentFactorInput,
  ): Promise<ExperimentFactor> {
    return this.prisma.experimentFactor.create({
      data: {
        experimentId: input.experimentId,
        name: input.name,
        displayName: input.displayName,
        type: input.type,
        role: input.role ?? FactorRole.INPUT,
        unit: input.unit,
        lowLevel: input.lowLevel,
        highLevel: input.highLevel,
        levels: input.levels as Prisma.InputJsonValue | undefined,
        goal: input.goal,
        isConstant: input.isConstant ?? false,
        constantValue: input.constantValue,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async addResponse(
    input: CreateExperimentResponseInput,
  ): Promise<ExperimentResponse> {
    return this.prisma.experimentResponse.create({
      data: {
        experimentId: input.experimentId,
        name: input.name,
        displayName: input.displayName,
        unit: input.unit,
        goal: input.goal,
        target: input.target,
        lowerSpec: input.lowerSpec,
        upperSpec: input.upperSpec,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async lockRunOrder(input: LockRunOrderInput): Promise<DesignedExperiment> {
    const seed = input.randomSeed ?? randomUUID();
    return this.prisma.designedExperiment.update({
      where: { id: input.experimentId },
      data: {
        runOrderLocked: true,
        runOrderLockedAt: new Date(),
        runOrderLockedBy: input.lockedBy,
        randomSeed: seed,
        status: ExperimentStatus.RUN_ORDER_LOCKED,
      },
    });
  }

  async generateRuns(experimentId: string): Promise<ExperimentRun[]> {
    const experiment = await this.prisma.designedExperiment.findUnique({
      where: { id: experimentId },
      include: {
        factors: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!experiment) {
      throw new Error("Experiment not found");
    }

    if (!experiment.runOrderLocked) {
      throw new Error("Run order must be locked before generating runs");
    }

    const inputFactors = experiment.factors.filter(
      (factor) => factor.role === PrismaFactorRole.INPUT,
    );
    const constantFactors = experiment.factors.filter(
      (factor) => factor.isConstant,
    );

    const runsPerReplicate = inputFactors.reduce((count, factor) => {
      if (
        factor.type === PrismaFactorType.CATEGORICAL &&
        factor.levels !== null
      ) {
        const levels = factor.levels as number[];
        return count * levels.length;
      }

      if (factor.type === PrismaFactorType.CONTINUOUS) {
        return count * 2;
      }

      return count;
    }, 1);

    const runCount = runsPerReplicate * experiment.replicates;
    if (!Number.isSafeInteger(runCount) || runCount > MAX_GENERATED_RUNS) {
      throw new Error("Experiment design exceeds the run limit");
    }

    const runs: ExperimentRun[] = [];
    for (let i = 1; i <= runCount; i++) {
      const run = await this.prisma.experimentRun.create({
        data: {
          experimentId,
          runNumber: i,
          standardOrder: i,
          status: RunStatus.PENDING,
        },
      });
      runs.push(run);

      for (const factor of constantFactors) {
        if (factor.constantValue !== null) {
          await this.prisma.experimentRunFactorValue.create({
            data: {
              runId: run.id,
              factorId: factor.id,
              value: factor.constantValue,
            },
          });
        }
      }
    }

    return runs;
  }

  async createRun(input: CreateExperimentRunInput): Promise<ExperimentRun> {
    return this.prisma.experimentRun.create({
      data: {
        experimentId: input.experimentId,
        runNumber: input.runNumber,
        standardOrder: input.standardOrder,
        blockNumber: input.blockNumber,
        seed: input.seed,
        status: RunStatus.PENDING,
      },
    });
  }

  async getRunsByExperiment(experimentId: string): Promise<ExperimentRun[]> {
    return this.prisma.experimentRun.findMany({
      where: { experimentId },
      orderBy: { runNumber: "asc" },
      include: {
        factorValues: { include: { factor: true } },
        responseValues: { include: { response: true } },
      },
    });
  }

  async updateRunStatus(input: UpdateRunStatusInput): Promise<ExperimentRun> {
    const data: Prisma.ExperimentRunUpdateInput = {
      status: input.status,
    };

    if (input.deviationNotes !== undefined) {
      data.deviationNotes = input.deviationNotes;
    }

    if (input.status === RunStatus.COMPLETED) {
      data.completedAt = new Date();
      data.completedBy = input.completedBy;
    }

    return this.prisma.experimentRun.update({
      where: { id: input.runId },
      data,
    });
  }

  async setRunFactorValue(
    input: SetRunFactorValueInput,
  ): Promise<ExperimentRunFactorValue> {
    return this.prisma.experimentRunFactorValue.upsert({
      where: {
        runId_factorId: {
          runId: input.runId,
          factorId: input.factorId,
        },
      },
      create: {
        runId: input.runId,
        factorId: input.factorId,
        value: input.value,
      },
      update: {
        value: input.value,
      },
    });
  }

  async setRunResponseValue(
    input: SetRunResponseValueInput,
  ): Promise<ExperimentRunResponseValue> {
    return this.prisma.experimentRunResponseValue.upsert({
      where: {
        runId_responseId: {
          runId: input.runId,
          responseId: input.responseId,
        },
      },
      create: {
        runId: input.runId,
        responseId: input.responseId,
        value: input.value,
      },
      update: {
        value: input.value,
      },
    });
  }

  async fitModel(input: FitModelInput): Promise<ExperimentModel> {
    return this.prisma.experimentModel.create({
      data: {
        experimentId: input.experimentId,
        name: input.name,
        type: input.type,
        formula: input.formula,
        terms: input.terms as Prisma.InputJsonValue,
        anovaTable: input.anovaTable as Prisma.InputJsonValue | undefined,
        lackOfFit: input.lackOfFit as Prisma.InputJsonValue | undefined,
        estimates: input.estimates as Prisma.InputJsonValue | undefined,
        residuals: input.residuals as Prisma.InputJsonValue | undefined,
        rSquared: input.rSquared,
        rSquaredAdjusted: input.rSquaredAdjusted,
        rSquaredPredicted: input.rSquaredPredicted,
        pValue: input.pValue,
        status: ModelFitStatus.FITTED,
        fittedBy: input.fittedBy,
        environmentHash: input.environmentHash,
        environmentSnapshot: input.environmentSnapshot as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getModelsByExperiment(
    experimentId: string,
  ): Promise<ExperimentModel[]> {
    return this.prisma.experimentModel.findMany({
      where: { experimentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateModelStatus(
    modelId: string,
    status: ModelFitStatus,
  ): Promise<ExperimentModel> {
    return this.prisma.experimentModel.update({
      where: { id: modelId },
      data: { status },
    });
  }

  async createPlot(input: CreateExperimentPlotInput): Promise<ExperimentPlot> {
    return this.prisma.experimentPlot.create({
      data: {
        experimentId: input.experimentId,
        modelId: input.modelId,
        type: input.type,
        title: input.title,
        config: input.config as Prisma.InputJsonValue,
        imageData: input.imageData,
        pdfData: input.pdfData,
        spreadsheetData: input.spreadsheetData as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getPlotsByExperiment(experimentId: string): Promise<ExperimentPlot[]> {
    return this.prisma.experimentPlot.findMany({
      where: { experimentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createParameterRange(
    input: CreateProcessParameterRangeInput,
  ): Promise<ProcessParameterRange> {
    return this.prisma.processParameterRange.create({
      data: {
        studyId: input.studyId,
        parameterName: input.parameterName,
        lowerBound: input.lowerBound,
        upperBound: input.upperBound,
        unit: input.unit,
        confidenceLevel: input.confidenceLevel,
        evidenceType: input.evidenceType,
        isStale: false,
      },
    });
  }

  async getParameterRangesByStudy(
    studyId: string,
  ): Promise<ProcessParameterRange[]> {
    return this.prisma.processParameterRange.findMany({
      where: { studyId },
      include: {
        experimentLinks: {
          include: {
            experiment: true,
            model: true,
          },
        },
      },
      orderBy: { parameterName: "asc" },
    });
  }

  async linkRangeToExperiment(
    input: LinkRangeToExperimentInput,
  ): Promise<ProcessParameterRangeLink> {
    return this.prisma.processParameterRangeLink.create({
      data: {
        rangeId: input.rangeId,
        experimentId: input.experimentId,
        modelId: input.modelId,
        linkType: input.linkType,
        linkedBy: input.linkedBy,
        isStale: false,
      },
    });
  }

  async markRangeStale(
    input: MarkRangeStaleInput,
  ): Promise<ProcessParameterRangeLink> {
    return this.prisma.processParameterRangeLink.update({
      where: { id: input.linkId },
      data: {
        isStale: true,
        staledAt: new Date(),
        staledBy: input.staledBy,
        staleReason: input.staleReason,
      },
    });
  }

  async getRangeLinksByRange(
    rangeId: string,
  ): Promise<ProcessParameterRangeLink[]> {
    return this.prisma.processParameterRangeLink.findMany({
      where: { rangeId },
      include: {
        experiment: true,
        model: true,
      },
    });
  }

  async getRangeLinksByExperiment(
    experimentId: string,
  ): Promise<ProcessParameterRangeLink[]> {
    return this.prisma.processParameterRangeLink.findMany({
      where: { experimentId },
      include: {
        range: true,
        model: true,
      },
    });
  }

  async getRangeLinksByModel(
    modelId: string,
  ): Promise<ProcessParameterRangeLink[]> {
    return this.prisma.processParameterRangeLink.findMany({
      where: { modelId },
      include: {
        range: true,
        experiment: true,
      },
    });
  }
}
