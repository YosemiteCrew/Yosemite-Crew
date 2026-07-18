import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { IntegrationController } from "../../../src/controllers/web/integration.controller";
import {
  IntegrationService,
  IntegrationServiceError,
} from "../../../src/services/integration.service";

jest.mock("../../../src/services/integration.service", () => {
  const actual = jest.requireActual<
    typeof import("../../../src/services/integration.service")
  >("../../../src/services/integration.service");
  return {
    ...actual,
    IntegrationService: {
      getCredentialMeta: jest.fn(),
    },
  };
});

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

describe("IntegrationController.credentialMeta", () => {
  const mockedService = jest.mocked(IntegrationService);
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<Request>;
  let res: Response;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      params: { organisationId: "org-1", provider: "IDEXX" },
      body: {},
      query: {},
    };
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
    jest.clearAllMocks();
  });

  it("returns only username and practiceId as JSON", async () => {
    mockedService.getCredentialMeta.mockResolvedValue({
      username: "vetuser",
      practiceId: "PRACTICE-123",
    });

    await IntegrationController.credentialMeta(req as Request, res);

    expect(mockedService.getCredentialMeta).toHaveBeenCalledWith(
      "org-1",
      "IDEXX",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload).toEqual({
      username: "vetuser",
      practiceId: "PRACTICE-123",
    });
    expect(payload).not.toHaveProperty("password");
    expect(JSON.stringify(payload)).not.toContain("password");
  });

  it("returns 400 when organisationId is missing", async () => {
    req.params = { provider: "IDEXX" } as Request["params"];

    await IntegrationController.credentialMeta(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "organisationId is required.",
    });
    expect(mockedService.getCredentialMeta).not.toHaveBeenCalled();
  });

  it("maps IntegrationServiceError to its status code", async () => {
    mockedService.getCredentialMeta.mockRejectedValue(
      new IntegrationServiceError("Unsupported integration provider.", 400),
    );

    await IntegrationController.credentialMeta(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Unsupported integration provider.",
    });
  });

  it("returns 500 on unexpected errors without leaking details", async () => {
    mockedService.getCredentialMeta.mockRejectedValue(new Error("boom"));

    await IntegrationController.credentialMeta(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Failed to fetch integration credential metadata.",
    });
  });
});
