import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { SuperAdminLabIngestionController } from "src/controllers/web/super-admin-lab-ingestion.controller";
import { LabIngestionQuarantineService } from "src/services/lab-ingestion-quarantine.service";
import logger from "src/utils/logger";

jest.mock("src/services/lab-ingestion-quarantine.service", () => ({
  LabIngestionQuarantineService: {
    listUnresolved: jest.fn(),
    resolve: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockedService = jest.mocked(LabIngestionQuarantineService);
const mockedLogger = jest.mocked(logger);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as unknown as Response["status"];
  return { res: { status, json } as unknown as Response, status, json };
};

describe("SuperAdminLabIngestionController.listQuarantine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.listUnresolved.mockResolvedValue({
      total: 1,
      returned: 1,
      results: [],
    } as never);
  });

  it("returns the unresolved rows for the default provider", async () => {
    const { res, status, json } = buildResponse();

    await SuperAdminLabIngestionController.listQuarantine(
      { query: {} } as Request,
      res,
    );

    expect(mockedService.listUnresolved).toHaveBeenCalledWith(undefined);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ total: 1, returned: 1, results: [] });
  });

  // The provider goes straight into a `where`, and the set this poller talks to is closed,
  // so it is validated against that set rather than trimmed and trusted.
  it("refuses a provider it does not know instead of querying on it", async () => {
    const { res, status, json } = buildResponse();

    await SuperAdminLabIngestionController.listQuarantine(
      { query: { provider: "not-a-provider" } } as unknown as Request,
      res,
    );

    expect(mockedService.listUnresolved).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: "Unknown provider.",
      code: "INVALID_LAB_PROVIDER",
    });
  });

  it("does not leak the underlying failure to the caller", async () => {
    mockedService.listUnresolved.mockRejectedValue(
      new Error("relation does not exist") as never,
    );
    const { res, status, json } = buildResponse();

    await SuperAdminLabIngestionController.listQuarantine(
      { query: {} } as Request,
      res,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: "Unable to list quarantined lab results.",
      code: "LAB_QUARANTINE_LIST_FAILED",
    });
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to list quarantined lab results",
      expect.any(Error),
    );
  });
});

describe("SuperAdminLabIngestionController.resolveQuarantine", () => {
  const ID = "3f1c2b4e-9a7d-4c11-8f2a-5b6d7e8f9a0b";

  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.resolve.mockResolvedValue(true as never);
  });

  it("resolves a held row", async () => {
    const { res, status, json } = buildResponse();

    await SuperAdminLabIngestionController.resolveQuarantine(
      { params: { id: ID } } as unknown as Request,
      res,
    );

    expect(mockedService.resolve).toHaveBeenCalledWith(ID);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ id: ID, resolved: true });
  });

  // The rows are uuid-keyed, so a malformed id is a bad request rather than a
  // miss - and it is answered without reaching the database at all.
  it("refuses a malformed id instead of querying on it", async () => {
    const { res, status } = buildResponse();

    await SuperAdminLabIngestionController.resolveQuarantine(
      { params: { id: "not-a-uuid" } } as unknown as Request,
      res,
    );

    expect(mockedService.resolve).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it("answers 404 when there was nothing unresolved to resolve", async () => {
    mockedService.resolve.mockResolvedValue(false as never);
    const { res, status, json } = buildResponse();

    await SuperAdminLabIngestionController.resolveQuarantine(
      { params: { id: ID } } as unknown as Request,
      res,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: "No unresolved quarantined result with that id.",
      code: "QUARANTINE_NOT_FOUND",
    });
  });
});
