import type { Request, Response } from "express";
import { DeveloperExportController } from "../../src/controllers/web/developer-export.controller";
import {
  DeveloperExportService,
  DeveloperExportServiceError,
} from "../../src/services/developer-export.service";
import { InvalidCursorError } from "../../src/utils/cursor-pagination";

jest.mock("src/services/developer-export.service", () => {
  class DeveloperExportServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
      public readonly code: string,
    ) {
      super(message);
      this.name = "DeveloperExportServiceError";
    }
  }
  return {
    DeveloperExportService: {
      create: jest.fn(),
      list: jest.fn(),
      get: jest.fn(),
    },
    DeveloperExportServiceError,
    EXPORTABLE_RESOURCES: [
      "appointments",
      "patients",
      "encounters",
      "invoices",
      "organization",
      "usage",
    ],
  };
});

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const mockService = DeveloperExportService as unknown as {
  create: jest.Mock;
  list: jest.Mock;
  get: jest.Mock;
};

const buildRes = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const buildReq = (input: {
  organisationId?: string;
  body?: unknown;
  query?: unknown;
  params?: Record<string, string>;
}): Request =>
  ({
    organisationId: input.organisationId,
    body: input.body ?? {},
    query: input.query ?? {},
    params: input.params ?? {},
  }) as unknown as Request;

describe("DeveloperExportController.createExport", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s without organisation context", async () => {
    const res = buildRes();
    await DeveloperExportController.createExport(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s on an unknown resource name", async () => {
    const res = buildRes();
    await DeveloperExportController.createExport(
      buildReq({
        organisationId: "org-1",
        body: { resources: ["payments"] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_request" }),
    );
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("400s on an empty resource list", async () => {
    const res = buildRes();
    await DeveloperExportController.createExport(
      buildReq({ organisationId: "org-1", body: { resources: [] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("202s with the queued job, defaulting format to ndjson", async () => {
    const job = { id: "job-1", status: "QUEUED" };
    mockService.create.mockResolvedValue(job);
    const res = buildRes();

    await DeveloperExportController.createExport(
      buildReq({
        organisationId: "org-1",
        body: { resources: ["patients", "invoices"] },
      }),
      res,
    );

    expect(mockService.create).toHaveBeenCalledWith({
      organisationId: "org-1",
      resources: ["patients", "invoices"],
      format: "ndjson",
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ data: job });
  });

  it("409s with conflict_pending_export when a job is already pending", async () => {
    mockService.create.mockRejectedValue(
      new DeveloperExportServiceError(
        "An export is already queued or running for this organisation",
        409,
        "conflict_pending_export",
      ),
    );
    const res = buildRes();

    await DeveloperExportController.createExport(
      buildReq({ organisationId: "org-1", body: { resources: ["usage"] } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "An export is already queued or running for this organisation",
      code: "conflict_pending_export",
    });
  });

  it("500s with internal_error on unexpected failures", async () => {
    mockService.create.mockRejectedValue(new Error("boom"));
    const res = buildRes();

    await DeveloperExportController.createExport(
      buildReq({ organisationId: "org-1", body: { resources: ["usage"] } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
      code: "internal_error",
    });
  });
});

describe("DeveloperExportController.listExports", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s without organisation context", async () => {
    const res = buildRes();
    await DeveloperExportController.listExports(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns the { data, pagination } list envelope with a clamped limit", async () => {
    mockService.list.mockResolvedValue({
      items: [{ id: "job-1" }],
      pagination: { nextCursor: null, hasMore: false, limit: 100 },
    });
    const res = buildRes();

    await DeveloperExportController.listExports(
      buildReq({ organisationId: "org-1", query: { limit: "500" } }),
      res,
    );

    expect(mockService.list).toHaveBeenCalledWith({
      organisationId: "org-1",
      limit: 100,
      cursor: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "job-1" }],
      pagination: { nextCursor: null, hasMore: false, limit: 100 },
    });
  });

  it("400s on a tampered cursor", async () => {
    mockService.list.mockRejectedValue(new InvalidCursorError());
    const res = buildRes();

    await DeveloperExportController.listExports(
      buildReq({ organisationId: "org-1", query: { cursor: "forged" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid pagination cursor",
      code: "invalid_request",
    });
  });
});

describe("DeveloperExportController.getExport", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s without organisation context", async () => {
    const res = buildRes();
    await DeveloperExportController.getExport(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404s for a job that is absent or another org's", async () => {
    mockService.get.mockResolvedValue(null);
    const res = buildRes();

    await DeveloperExportController.getExport(
      buildReq({ organisationId: "org-1", params: { id: "job-9" } }),
      res,
    );

    expect(mockService.get).toHaveBeenCalledWith("org-1", "job-9");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Export not found",
      code: "not_found",
    });
  });

  it("200s with the job including its download URL", async () => {
    const job = {
      id: "job-1",
      status: "COMPLETED",
      downloadUrl: "https://cdn.example/developer-exports/org-1/job-1.ndjson",
    };
    mockService.get.mockResolvedValue(job);
    const res = buildRes();

    await DeveloperExportController.getExport(
      buildReq({ organisationId: "org-1", params: { id: "job-1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: job });
  });
});
