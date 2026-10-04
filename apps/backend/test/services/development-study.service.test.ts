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
} from "@yosemite-crew/types";

// Mock the Prisma client before importing the service
const mockPrisma = {
  developmentStudy: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  designedExperiment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  experimentFactor: {
    create: jest.fn(),
  },
  experimentResponse: {
    create: jest.fn(),
  },
  experimentRun: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  experimentRunFactorValue: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  experimentRunResponseValue: {
    upsert: jest.fn(),
  },
  experimentModel: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  experimentPlot: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  processParameterRange: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  processParameterRangeLink: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("@yosemite-crew/database", () => ({
  prisma: mockPrisma,
}));

// Import the service after mocking
import { DevelopmentStudyService } from "../../src/services/development-study.service.js";

describe("DevelopmentStudyService", () => {
  let service: DevelopmentStudyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DevelopmentStudyService();
  });

  describe("createStudy", () => {
    it("should create a development study with DRAFT status", async () => {
      const input = {
        organisationId: "org-1",
        productName: "Test Product",
        productCode: "TP-001",
        description: "Test description",
        createdById: "user-1",
      };

      const expectedStudy = {
        id: "study-1",
        ...input,
        status: DevelopmentStudyStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.developmentStudy.create.mockResolvedValue(expectedStudy);

      const result = await service.createStudy(input);

      expect(mockPrisma.developmentStudy.create).toHaveBeenCalledWith({
        data: {
          organisationId: "org-1",
          productName: "Test Product",
          productCode: "TP-001",
          description: "Test description",
          status: DevelopmentStudyStatus.DRAFT,
          createdById: "user-1",
        },
      });
      expect(result).toEqual(expectedStudy);
    });
  });

  describe("getStudyById", () => {
    it("should return study when found", async () => {
      const study = {
        id: "study-1",
        organisationId: "org-1",
        productName: "Test Product",
        status: DevelopmentStudyStatus.DRAFT,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.developmentStudy.findUnique.mockResolvedValue(study);

      const result = await service.getStudyById("study-1");

      expect(mockPrisma.developmentStudy.findUnique).toHaveBeenCalledWith({
        where: { id: "study-1" },
      });
      expect(result).toEqual(study);
    });

    it("should return null when not found", async () => {
      mockPrisma.developmentStudy.findUnique.mockResolvedValue(null);

      const result = await service.getStudyById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createExperiment", () => {
    it("should create a designed experiment with DESIGNED status", async () => {
      const input = {
        studyId: "study-1",
        name: "Test Experiment",
        description: "Test description",
        designType: ExperimentDesignType.FULL_FACTORIAL,
        resolution: 4,
        centrePoints: 2,
        blocks: 1,
        replicates: 2,
        randomSeed: "seed123",
        createdById: "user-1",
      };

      const expectedExperiment = {
        id: "exp-1",
        ...input,
        aliases: null,
        status: ExperimentStatus.DESIGNED,
        runOrderLocked: false,
        runOrderLockedAt: null,
        runOrderLockedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.designedExperiment.create.mockResolvedValue(
        expectedExperiment,
      );

      const result = await service.createExperiment(input);

      expect(mockPrisma.designedExperiment.create).toHaveBeenCalledWith({
        data: {
          studyId: "study-1",
          name: "Test Experiment",
          description: "Test description",
          designType: ExperimentDesignType.FULL_FACTORIAL,
          resolution: 4,
          aliases: undefined,
          centrePoints: 2,
          blocks: 1,
          replicates: 2,
          randomSeed: "seed123",
          status: ExperimentStatus.DESIGNED,
          createdById: "user-1",
        },
      });
      expect(result).toEqual(expectedExperiment);
    });
  });

  describe("addFactor", () => {
    it("should add a factor to an experiment", async () => {
      const input = {
        experimentId: "exp-1",
        name: "Temperature",
        displayName: "Temperature (C)",
        type: FactorType.CONTINUOUS,
        role: FactorRole.INPUT,
        unit: "Celsius",
        lowLevel: 20,
        highLevel: 80,
        goal: "Maximize yield",
        isConstant: false,
        sortOrder: 0,
      };

      const expectedFactor = {
        id: "factor-1",
        ...input,
        levels: null,
        constantValue: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.experimentFactor.create.mockResolvedValue(expectedFactor);

      const result = await service.addFactor(input);

      expect(mockPrisma.experimentFactor.create).toHaveBeenCalledWith({
        data: {
          experimentId: "exp-1",
          name: "Temperature",
          displayName: "Temperature (C)",
          type: FactorType.CONTINUOUS,
          role: FactorRole.INPUT,
          unit: "Celsius",
          lowLevel: 20,
          highLevel: 80,
          levels: undefined,
          goal: "Maximize yield",
          isConstant: false,
          constantValue: undefined,
          sortOrder: 0,
        },
      });
      expect(result).toEqual(expectedFactor);
    });
  });

  describe("lockRunOrder", () => {
    it("should lock run order and generate seed if not provided", async () => {
      const input = {
        experimentId: "exp-1",
        lockedBy: "user-1",
      };

      const expectedExperiment = {
        id: "exp-1",
        studyId: "study-1",
        name: "Test Experiment",
        designType: ExperimentDesignType.FULL_FACTORIAL,
        runOrderLocked: true,
        runOrderLockedAt: expect.any(Date),
        runOrderLockedBy: "user-1",
        randomSeed: expect.any(String),
        status: ExperimentStatus.RUN_ORDER_LOCKED,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.designedExperiment.update.mockResolvedValue(
        expectedExperiment,
      );

      const result = await service.lockRunOrder(input);

      expect(mockPrisma.designedExperiment.update).toHaveBeenCalledWith({
        where: { id: "exp-1" },
        data: {
          runOrderLocked: true,
          runOrderLockedAt: expect.any(Date),
          runOrderLockedBy: "user-1",
          randomSeed: expect.any(String),
          status: ExperimentStatus.RUN_ORDER_LOCKED,
        },
      });
      expect(result.runOrderLocked).toBe(true);
      expect(result.runOrderLockedBy).toBe("user-1");
      expect(result.randomSeed).toBeDefined();
    });

    it("should use provided seed", async () => {
      const input = {
        experimentId: "exp-1",
        lockedBy: "user-1",
        randomSeed: "custom-seed",
      };

      const expectedExperiment = {
        id: "exp-1",
        randomSeed: "custom-seed",
        runOrderLocked: true,
        runOrderLockedBy: "user-1",
        status: ExperimentStatus.RUN_ORDER_LOCKED,
      };

      mockPrisma.designedExperiment.update.mockResolvedValue(
        expectedExperiment,
      );

      const result = await service.lockRunOrder(input);

      expect(result.randomSeed).toBe("custom-seed");
    });
  });

  describe("fitModel", () => {
    it("should create an experiment model with FITTED status", async () => {
      const input = {
        experimentId: "exp-1",
        name: "Linear Model",
        type: ModelType.LINEAR,
        formula: "Y = b0 + b1*X1 + b2*X2",
        terms: { linear: ["X1", "X2"] },
        anovaTable: {
          source: "Model",
          df: 2,
          ss: 100,
          ms: 50,
          f: 10,
          p: 0.001,
        },
        lackOfFit: { df: 1, ss: 5, ms: 5, f: 1, p: 0.3 },
        estimates: { b0: 50, b1: 2.5, b2: 1.8 },
        residuals: [1, -1, 0.5, -0.5],
        rSquared: 0.95,
        rSquaredAdjusted: 0.93,
        rSquaredPredicted: 0.88,
        pValue: 0.001,
        fittedBy: "user-1",
        environmentHash: "hash123",
        environmentSnapshot: { node: "18.0.0", packages: {} },
      };

      const expectedModel = {
        id: "model-1",
        ...input,
        status: ModelFitStatus.FITTED,
        fittedAt: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.experimentModel.create.mockResolvedValue(expectedModel);

      const result = await service.fitModel(input);

      expect(mockPrisma.experimentModel.create).toHaveBeenCalledWith({
        data: {
          experimentId: "exp-1",
          name: "Linear Model",
          type: ModelType.LINEAR,
          formula: "Y = b0 + b1*X1 + b2*X2",
          terms: { linear: ["X1", "X2"] },
          anovaTable: {
            source: "Model",
            df: 2,
            ss: 100,
            ms: 50,
            f: 10,
            p: 0.001,
          },
          lackOfFit: { df: 1, ss: 5, ms: 5, f: 1, p: 0.3 },
          estimates: { b0: 50, b1: 2.5, b2: 1.8 },
          residuals: [1, -1, 0.5, -0.5],
          rSquared: 0.95,
          rSquaredAdjusted: 0.93,
          rSquaredPredicted: 0.88,
          pValue: 0.001,
          status: ModelFitStatus.FITTED,
          fittedBy: "user-1",
          environmentHash: "hash123",
          environmentSnapshot: { node: "18.0.0", packages: {} },
        },
      });
      expect(result.status).toBe(ModelFitStatus.FITTED);
      expect(result.fittedBy).toBe("user-1");
    });
  });

  describe("createParameterRange", () => {
    it("should create a process parameter range", async () => {
      const input = {
        studyId: "study-1",
        parameterName: "Temperature",
        lowerBound: 20,
        upperBound: 80,
        unit: "Celsius",
        confidenceLevel: 0.95,
        evidenceType: "designed_experiment",
      };

      const expectedRange = {
        id: "range-1",
        ...input,
        isStale: false,
        staleReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.processParameterRange.create.mockResolvedValue(expectedRange);

      const result = await service.createParameterRange(input);

      expect(mockPrisma.processParameterRange.create).toHaveBeenCalledWith({
        data: {
          studyId: "study-1",
          parameterName: "Temperature",
          lowerBound: 20,
          upperBound: 80,
          unit: "Celsius",
          confidenceLevel: 0.95,
          evidenceType: "designed_experiment",
          isStale: false,
        },
      });
      expect(result.isStale).toBe(false);
    });
  });

  describe("linkRangeToExperiment", () => {
    it("should link a range to an experiment", async () => {
      const input = {
        rangeId: "range-1",
        experimentId: "exp-1",
        modelId: "model-1",
        linkType: "evidence",
        linkedBy: "user-1",
      };

      const expectedLink = {
        id: "link-1",
        ...input,
        linkedAt: expect.any(Date),
        isStale: false,
        staledAt: null,
        staledBy: null,
        staleReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.processParameterRangeLink.create.mockResolvedValue(
        expectedLink,
      );

      const result = await service.linkRangeToExperiment(input);

      expect(mockPrisma.processParameterRangeLink.create).toHaveBeenCalledWith({
        data: {
          rangeId: "range-1",
          experimentId: "exp-1",
          modelId: "model-1",
          linkType: "evidence",
          linkedBy: "user-1",
          isStale: false,
        },
      });
      expect(result.isStale).toBe(false);
    });
  });

  describe("markRangeStale", () => {
    it("should mark a range link as stale", async () => {
      const input = {
        linkId: "link-1",
        staledBy: "user-1",
        staleReason: "Model refitted",
      };

      const expectedLink = {
        id: "link-1",
        rangeId: "range-1",
        experimentId: "exp-1",
        modelId: "model-1",
        linkType: "evidence",
        linkedBy: "user-1",
        linkedAt: new Date(),
        isStale: true,
        staledAt: expect.any(Date),
        staledBy: "user-1",
        staleReason: "Model refitted",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.processParameterRangeLink.update.mockResolvedValue(
        expectedLink,
      );

      const result = await service.markRangeStale(input);

      expect(mockPrisma.processParameterRangeLink.update).toHaveBeenCalledWith({
        where: { id: "link-1" },
        data: {
          isStale: true,
          staledAt: expect.any(Date),
          staledBy: "user-1",
          staleReason: "Model refitted",
        },
      });
      expect(result.isStale).toBe(true);
      expect(result.staledBy).toBe("user-1");
      expect(result.staleReason).toBe("Model refitted");
    });
  });
});
