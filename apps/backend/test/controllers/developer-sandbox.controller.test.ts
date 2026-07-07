import type { Request, Response } from "express";
import { DeveloperSandboxController } from "../../src/controllers/web/developer-sandbox.controller";
import {
  DeveloperSandboxService,
  DeveloperSandboxServiceError,
} from "../../src/services/developer-sandbox.service";

jest.mock("src/services/developer-sandbox.service", () => {
  class DeveloperSandboxServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "DeveloperSandboxServiceError";
    }
  }
  return {
    DeveloperSandboxService: {
      create: jest.fn(),
      get: jest.fn(),
      teardown: jest.fn(),
    },
    DeveloperSandboxServiceError,
  };
});

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

jest.mock("src/utils/request", () => ({
  resolveUserIdFromRequest: jest.fn(() => "user-1"),
}));

const mockService = DeveloperSandboxService as unknown as {
  create: jest.Mock;
  get: jest.Mock;
  teardown: jest.Mock;
};

const buildRes = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const buildReq = (organisationId?: string): Request =>
  ({ organisationId, body: {} }) as unknown as Request;

const sandbox = {
  sandboxOrganisationId: "sandbox-org",
  createdAt: new Date("2026-07-07T00:00:00.000Z"),
  counts: {
    patients: 5,
    appointments: 8,
    cases: 3,
    encounters: 3,
    invoices: 4,
  },
  testKeyHint: "POST /v1/developers/api-keys ...",
};

describe("DeveloperSandboxController.createSandbox", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s without organisation context", async () => {
    const res = buildRes();
    await DeveloperSandboxController.createSandbox(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_request" }),
    );
  });

  it("201s on first creation with the seeded sandbox and key hint", async () => {
    mockService.create.mockResolvedValue({ sandbox, created: true });
    const res = buildRes();

    await DeveloperSandboxController.createSandbox(buildReq("dev-org"), res);

    expect(mockService.create).toHaveBeenCalledWith({
      organisationId: "dev-org",
      userId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: sandbox });
  });

  it("200s idempotently when the sandbox already exists", async () => {
    mockService.create.mockResolvedValue({ sandbox, created: false });
    const res = buildRes();

    await DeveloperSandboxController.createSandbox(buildReq("dev-org"), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: sandbox });
  });

  it("maps service errors to their status with the error envelope", async () => {
    mockService.create.mockRejectedValue(
      new DeveloperSandboxServiceError("Developer organisation not found", 404),
    );
    const res = buildRes();

    await DeveloperSandboxController.createSandbox(buildReq("dev-org"), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Developer organisation not found",
      code: "not_found",
    });
  });

  it("500s with internal_error on unexpected failures", async () => {
    mockService.create.mockRejectedValue(new Error("boom"));
    const res = buildRes();

    await DeveloperSandboxController.createSandbox(buildReq("dev-org"), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
      code: "internal_error",
    });
  });
});

describe("DeveloperSandboxController.getSandbox", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s without organisation context", async () => {
    const res = buildRes();
    await DeveloperSandboxController.getSandbox(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404s when no sandbox exists", async () => {
    mockService.get.mockResolvedValue(null);
    const res = buildRes();

    await DeveloperSandboxController.getSandbox(buildReq("dev-org"), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Sandbox not found",
      code: "not_found",
    });
  });

  it("200s with the sandbox status", async () => {
    mockService.get.mockResolvedValue(sandbox);
    const res = buildRes();

    await DeveloperSandboxController.getSandbox(buildReq("dev-org"), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: sandbox });
  });
});

describe("DeveloperSandboxController.deleteSandbox", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s without organisation context", async () => {
    const res = buildRes();
    await DeveloperSandboxController.deleteSandbox(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockService.teardown).not.toHaveBeenCalled();
  });

  it("204s after teardown", async () => {
    mockService.teardown.mockResolvedValue(undefined);
    const res = buildRes();

    await DeveloperSandboxController.deleteSandbox(buildReq("dev-org"), res);

    expect(mockService.teardown).toHaveBeenCalledWith("dev-org");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("404s when there is no sandbox to tear down", async () => {
    mockService.teardown.mockRejectedValue(
      new DeveloperSandboxServiceError("Sandbox not found", 404),
    );
    const res = buildRes();

    await DeveloperSandboxController.deleteSandbox(buildReq("dev-org"), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
