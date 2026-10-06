import type { Request, Response, Router } from "express";
import {
  DevelopmentStudyStatus,
  ExperimentDesignType,
  ExperimentStatus,
  FactorRole,
  FactorType,
  ModelFitStatus,
  ModelType,
  PlotType,
  RunStatus,
} from "@yosemite-crew/types";

const pass = jest.fn((_req, _res, next) => next());
const service = {
  createStudy: jest.fn(),
  getStudiesByOrganisation: jest.fn(),
  getStudyById: jest.fn(),
  updateStudyStatus: jest.fn(),
  createExperiment: jest.fn(),
  getExperimentById: jest.fn(),
  getExperimentsByStudy: jest.fn(),
  updateExperimentStatus: jest.fn(),
  addFactor: jest.fn(),
  addResponse: jest.fn(),
  lockRunOrder: jest.fn(),
  generateRuns: jest.fn(),
  createRun: jest.fn(),
  getRunsByExperiment: jest.fn(),
  updateRunStatus: jest.fn(),
  setRunFactorValue: jest.fn(),
  setRunResponseValue: jest.fn(),
  fitModel: jest.fn(),
  getModelsByExperiment: jest.fn(),
  updateModelStatus: jest.fn(),
  createPlot: jest.fn(),
  getPlotsByExperiment: jest.fn(),
  createParameterRange: jest.fn(),
  getParameterRangesByStudy: jest.fn(),
  linkRangeToExperiment: jest.fn(),
  markRangeStale: jest.fn(),
  getRangeLinksByRange: jest.fn(),
  getRangeLinksByExperiment: jest.fn(),
  getRangeLinksByModel: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ requireWebAuth: pass }));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => pass,
  withDevelopmentStudyOrgPermissions: () => pass,
  withDesignedExperimentOrgPermissions: () => pass,
  withExperimentRunOrgPermissions: () => pass,
  withExperimentModelOrgPermissions: () => pass,
  withProcessParameterRangeOrgPermissions: () => pass,
  withProcessParameterRangeLinkOrgPermissions: () => pass,
}));
jest.mock("../../src/services/development-study.service", () => ({
  MAX_GENERATED_RUNS: 1_000,
  DevelopmentStudyService: jest.fn(() => service),
}));

const router = jest.requireActual("../../src/routers/development-study.router")
  .default as Router;

type Method = "get" | "post" | "patch";
type RequestParts = Pick<Request, "body" | "params" | "query"> & {
  userId?: string;
};
type ResponseMock = Response & {
  status: jest.Mock;
  json: jest.Mock;
};
type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};
const layers = router.stack as unknown as RouteLayer[];

const response = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as ResponseMock;
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const handlerFor = (method: Method, path: string) => {
  const layer = layers.find(
    (candidate) =>
      candidate.route?.path === path && candidate.route.methods[method],
  );
  if (!layer?.route) throw new Error(`Missing ${method.toUpperCase()} ${path}`);
  return layer.route.stack.at(-1)?.handle as (
    req: Request,
    res: Response,
  ) => Promise<void>;
};

const invoke = async (
  method: Method,
  path: string,
  parts: Partial<RequestParts> = {},
) => {
  const req = {
    body: {},
    params: {},
    query: {},
    userId: "user-1",
    ...parts,
  } as unknown as Request;
  const res = response();
  await handlerFor(method, path)(req, res);
  return res;
};

const uuid = "00000000-0000-4000-8000-000000000001";

describe("developmentStudyRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const mock of Object.values(service))
      mock.mockResolvedValue({ id: uuid });
    service.getStudiesByOrganisation.mockResolvedValue([]);
    service.getExperimentsByStudy.mockResolvedValue([]);
    service.generateRuns.mockResolvedValue([]);
    service.getRunsByExperiment.mockResolvedValue([]);
    service.getModelsByExperiment.mockResolvedValue([]);
    service.getPlotsByExperiment.mockResolvedValue([]);
    service.getParameterRangesByStudy.mockResolvedValue([]);
    service.getRangeLinksByRange.mockResolvedValue([]);
    service.getRangeLinksByExperiment.mockResolvedValue([]);
    service.getRangeLinksByModel.mockResolvedValue([]);
  });

  it("registers every development study operation", () => {
    const operations = layers.flatMap((layer) =>
      layer.route
        ? Object.keys(layer.route.methods).map(
            (method) => `${method.toUpperCase()} ${layer.route?.path}`,
          )
        : [],
    );

    expect(operations).toHaveLength(29);
  });

  it("serves successful study and experiment operations", async () => {
    const cases: Array<{
      method: Method;
      path: string;
      parts?: Partial<RequestParts>;
      mock: jest.Mock;
      status?: number;
    }> = [
      {
        method: "post",
        path: "/studies",
        parts: {
          body: {
            organisationId: uuid,
            productName: "Compound A",
            productCode: "A-1",
            description: "Screening study",
          },
        },
        mock: service.createStudy,
        status: 201,
      },
      {
        method: "get",
        path: "/studies",
        parts: { query: { organisationId: uuid } },
        mock: service.getStudiesByOrganisation,
      },
      {
        method: "get",
        path: "/studies/:studyId",
        parts: { params: { studyId: uuid } },
        mock: service.getStudyById,
      },
      {
        method: "patch",
        path: "/studies/:studyId/status",
        parts: {
          params: { studyId: uuid },
          body: { status: DevelopmentStudyStatus.ACTIVE },
        },
        mock: service.updateStudyStatus,
      },
      {
        method: "post",
        path: "/studies/:studyId/experiments",
        parts: {
          params: { studyId: uuid },
          body: {
            name: "Factorial trial",
            designType: ExperimentDesignType.FULL_FACTORIAL,
          },
        },
        mock: service.createExperiment,
        status: 201,
      },
      {
        method: "get",
        path: "/experiments/:experimentId",
        parts: { params: { experimentId: uuid } },
        mock: service.getExperimentById,
      },
      {
        method: "get",
        path: "/studies/:studyId/experiments",
        parts: { params: { studyId: uuid } },
        mock: service.getExperimentsByStudy,
      },
      {
        method: "patch",
        path: "/experiments/:experimentId/status",
        parts: {
          params: { experimentId: uuid },
          body: { status: ExperimentStatus.IN_PROGRESS },
        },
        mock: service.updateExperimentStatus,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/factors",
        parts: {
          params: { experimentId: uuid },
          body: {
            name: "Temperature",
            type: FactorType.CONTINUOUS,
            role: FactorRole.INPUT,
          },
        },
        mock: service.addFactor,
        status: 201,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/responses",
        parts: {
          params: { experimentId: uuid },
          body: { name: "Yield", target: 90 },
        },
        mock: service.addResponse,
        status: 201,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/lock-run-order",
        parts: {
          params: { experimentId: uuid },
          body: { randomSeed: "seed" },
        },
        mock: service.lockRunOrder,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/generate-runs",
        parts: { params: { experimentId: uuid } },
        mock: service.generateRuns,
        status: 201,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/runs",
        parts: {
          params: { experimentId: uuid },
          body: { runNumber: 1 },
        },
        mock: service.createRun,
        status: 201,
      },
      {
        method: "get",
        path: "/experiments/:experimentId/runs",
        parts: { params: { experimentId: uuid } },
        mock: service.getRunsByExperiment,
      },
      {
        method: "patch",
        path: "/runs/:runId/status",
        parts: {
          params: { runId: uuid },
          body: { status: RunStatus.COMPLETED },
        },
        mock: service.updateRunStatus,
      },
      {
        method: "post",
        path: "/runs/:runId/factor-values",
        parts: {
          params: { runId: uuid },
          body: { factorId: uuid, value: 4 },
        },
        mock: service.setRunFactorValue,
      },
      {
        method: "post",
        path: "/runs/:runId/response-values",
        parts: {
          params: { runId: uuid },
          body: { responseId: uuid, value: 8 },
        },
        mock: service.setRunResponseValue,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/models",
        parts: {
          params: { experimentId: uuid },
          body: {
            name: "Linear model",
            type: ModelType.LINEAR,
            formula: "yield ~ temperature",
            terms: ["temperature"],
          },
        },
        mock: service.fitModel,
        status: 201,
      },
      {
        method: "get",
        path: "/experiments/:experimentId/models",
        parts: { params: { experimentId: uuid } },
        mock: service.getModelsByExperiment,
      },
      {
        method: "patch",
        path: "/models/:modelId/status",
        parts: {
          params: { modelId: uuid },
          body: { status: ModelFitStatus.REFINED },
        },
        mock: service.updateModelStatus,
      },
      {
        method: "post",
        path: "/experiments/:experimentId/plots",
        parts: {
          params: { experimentId: uuid },
          body: {
            modelId: uuid,
            type: PlotType.CONTOUR,
            title: "Contour",
            config: { x: "temperature" },
            imageData: "AQI=",
            pdfData: "AQI=",
          },
        },
        mock: service.createPlot,
        status: 201,
      },
      {
        method: "get",
        path: "/experiments/:experimentId/plots",
        parts: { params: { experimentId: uuid } },
        mock: service.getPlotsByExperiment,
      },
      {
        method: "post",
        path: "/studies/:studyId/ranges",
        parts: {
          params: { studyId: uuid },
          body: {
            parameterName: "Temperature",
            lowerBound: 10,
            upperBound: 20,
          },
        },
        mock: service.createParameterRange,
        status: 201,
      },
      {
        method: "get",
        path: "/studies/:studyId/ranges",
        parts: { params: { studyId: uuid } },
        mock: service.getParameterRangesByStudy,
      },
      {
        method: "post",
        path: "/ranges/:rangeId/links",
        parts: {
          params: { rangeId: uuid },
          body: { experimentId: uuid, modelId: uuid, linkType: "evidence" },
        },
        mock: service.linkRangeToExperiment,
        status: 201,
      },
      {
        method: "post",
        path: "/range-links/:linkId/stale",
        parts: {
          params: { linkId: uuid },
          body: { staleReason: "Model refitted" },
        },
        mock: service.markRangeStale,
      },
      {
        method: "get",
        path: "/ranges/:rangeId/links",
        parts: { params: { rangeId: uuid } },
        mock: service.getRangeLinksByRange,
      },
      {
        method: "get",
        path: "/experiments/:experimentId/range-links",
        parts: { params: { experimentId: uuid } },
        mock: service.getRangeLinksByExperiment,
      },
      {
        method: "get",
        path: "/models/:modelId/range-links",
        parts: { params: { modelId: uuid } },
        mock: service.getRangeLinksByModel,
      },
    ];

    for (const testCase of cases) {
      const res = await invoke(testCase.method, testCase.path, testCase.parts);
      expect(testCase.mock).toHaveBeenCalled();
      if (testCase.status) {
        expect(res.status).toHaveBeenCalledWith(testCase.status);
      }
      expect(res.json).toHaveBeenCalled();
    }
  });

  it("returns validation errors without calling services", async () => {
    const cases: Array<[Method, string]> = [
      ["post", "/studies"],
      ["patch", "/studies/:studyId/status"],
      ["post", "/studies/:studyId/experiments"],
      ["patch", "/experiments/:experimentId/status"],
      ["post", "/experiments/:experimentId/factors"],
      ["post", "/experiments/:experimentId/responses"],
      ["post", "/experiments/:experimentId/runs"],
      ["patch", "/runs/:runId/status"],
      ["post", "/runs/:runId/factor-values"],
      ["post", "/runs/:runId/response-values"],
      ["post", "/experiments/:experimentId/models"],
      ["patch", "/models/:modelId/status"],
      ["post", "/experiments/:experimentId/plots"],
      ["post", "/studies/:studyId/ranges"],
      ["post", "/ranges/:rangeId/links"],
      ["post", "/range-links/:linkId/stale"],
    ];

    for (const [method, path] of cases) {
      const res = await invoke(method, path, {
        params: {
          studyId: uuid,
          experimentId: uuid,
          runId: uuid,
          modelId: uuid,
          rangeId: uuid,
          linkId: uuid,
        },
      });
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it("rejects experiment replicate counts above the run limit", async () => {
    const res = await invoke("post", "/studies/:studyId/experiments", {
      params: { studyId: uuid },
      body: {
        name: "Oversized trial",
        designType: ExperimentDesignType.FULL_FACTORIAL,
        replicates: 1_001,
      },
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.createExperiment).not.toHaveBeenCalled();
  });

  it("returns not found for missing studies and experiments", async () => {
    service.getStudyById.mockResolvedValueOnce(null);
    service.getExperimentById.mockResolvedValueOnce(null);

    const study = await invoke("get", "/studies/:studyId", {
      params: { studyId: uuid },
    });
    const experiment = await invoke("get", "/experiments/:experimentId", {
      params: { experimentId: uuid },
    });

    expect(study.status).toHaveBeenCalledWith(404);
    expect(experiment.status).toHaveBeenCalledWith(404);
  });

  it("rejects a missing organisation query", async () => {
    const res = await invoke("get", "/studies");

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.getStudiesByOrganisation).not.toHaveBeenCalled();
  });

  it("rejects a structured organisation query", async () => {
    const res = await invoke("get", "/studies", {
      query: { organisationId: { not: uuid } } as never,
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.getStudiesByOrganisation).not.toHaveBeenCalled();
  });

  it("maps service failures to server errors", async () => {
    service.createStudy.mockRejectedValueOnce(new Error("database failed"));
    service.getStudiesByOrganisation.mockRejectedValueOnce(
      new Error("database failed"),
    );

    const create = await invoke("post", "/studies", {
      body: { organisationId: uuid, productName: "Compound A" },
    });
    const list = await invoke("get", "/studies", {
      query: { organisationId: uuid },
    });

    expect(create.status).toHaveBeenCalledWith(500);
    expect(create.json).toHaveBeenCalledWith({
      error: "Failed to create study",
    });
    expect(list.status).toHaveBeenCalledWith(500);
  });

  it("uses service error messages for run-order failures", async () => {
    service.lockRunOrder.mockRejectedValueOnce(new Error("Already locked"));
    service.generateRuns.mockRejectedValueOnce("failed");

    const lock = await invoke(
      "post",
      "/experiments/:experimentId/lock-run-order",
      { params: { experimentId: uuid }, body: {} },
    );
    const generate = await invoke(
      "post",
      "/experiments/:experimentId/generate-runs",
      { params: { experimentId: uuid } },
    );

    expect(lock.json).toHaveBeenCalledWith({ error: "Already locked" });
    expect(generate.json).toHaveBeenCalledWith({
      error: "Failed to generate runs",
    });
  });

  it("handles every run-order error shape", async () => {
    const invalid = await invoke(
      "post",
      "/experiments/:experimentId/lock-run-order",
      { params: { experimentId: uuid }, body: { randomSeed: 4 } },
    );
    service.lockRunOrder.mockRejectedValueOnce("failed");
    const lock = await invoke(
      "post",
      "/experiments/:experimentId/lock-run-order",
      { params: { experimentId: uuid }, body: {} },
    );
    service.generateRuns.mockRejectedValueOnce(new Error("Not locked"));
    const generate = await invoke(
      "post",
      "/experiments/:experimentId/generate-runs",
      { params: { experimentId: uuid } },
    );

    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(lock.json).toHaveBeenCalledWith({
      error: "Failed to lock run order",
    });
    expect(generate.json).toHaveBeenCalledWith({ error: "Not locked" });
  });

  it("creates plots without optional binary data", async () => {
    const res = await invoke("post", "/experiments/:experimentId/plots", {
      params: { experimentId: uuid },
      body: {
        type: PlotType.RESIDUALS,
        title: "Residuals",
        config: {},
      },
    });

    expect(service.createPlot).toHaveBeenCalledWith(
      expect.objectContaining({ imageData: undefined, pdfData: undefined }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns server errors when read operations fail", async () => {
    const cases: Array<{
      path: string;
      params: Record<string, string>;
      mock: jest.Mock;
    }> = [
      {
        path: "/studies/:studyId",
        params: { studyId: uuid },
        mock: service.getStudyById,
      },
      {
        path: "/experiments/:experimentId",
        params: { experimentId: uuid },
        mock: service.getExperimentById,
      },
      {
        path: "/studies/:studyId/experiments",
        params: { studyId: uuid },
        mock: service.getExperimentsByStudy,
      },
      {
        path: "/experiments/:experimentId/runs",
        params: { experimentId: uuid },
        mock: service.getRunsByExperiment,
      },
      {
        path: "/experiments/:experimentId/models",
        params: { experimentId: uuid },
        mock: service.getModelsByExperiment,
      },
      {
        path: "/experiments/:experimentId/plots",
        params: { experimentId: uuid },
        mock: service.getPlotsByExperiment,
      },
      {
        path: "/studies/:studyId/ranges",
        params: { studyId: uuid },
        mock: service.getParameterRangesByStudy,
      },
      {
        path: "/ranges/:rangeId/links",
        params: { rangeId: uuid },
        mock: service.getRangeLinksByRange,
      },
      {
        path: "/experiments/:experimentId/range-links",
        params: { experimentId: uuid },
        mock: service.getRangeLinksByExperiment,
      },
      {
        path: "/models/:modelId/range-links",
        params: { modelId: uuid },
        mock: service.getRangeLinksByModel,
      },
    ];

    for (const testCase of cases) {
      testCase.mock.mockRejectedValueOnce(new Error("database failed"));
      const res = await invoke("get", testCase.path, {
        params: testCase.params,
      });
      expect(res.status).toHaveBeenCalledWith(500);
    }
  });
});
