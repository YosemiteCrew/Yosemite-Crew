import type { Request, Response } from "express";
import { DeveloperApiKeyController } from "../../../src/controllers/web/developer-api-key.controller";
import {
  DeveloperApiKeyService,
  DeveloperApiKeyServiceError,
} from "../../../src/services/developer-api-key.service";

jest.mock("../../../src/services/developer-api-key.service", () => {
  class Err extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    DeveloperApiKeyService: {
      issue: jest.fn(),
      list: jest.fn(),
      revoke: jest.fn(),
    },
    DeveloperApiKeyServiceError: Err,
  };
});

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const svc = DeveloperApiKeyService as unknown as {
  issue: jest.Mock;
  list: jest.Mock;
  revoke: jest.Mock;
};

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (
  over: {
    organisationId?: string;
    userId?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {},
): Request =>
  ({
    body: over.body ?? {},
    params: over.params ?? {},
    headers: {},
    organisationId: over.organisationId,
    userId: over.userId,
  }) as unknown as Request;

describe("DeveloperApiKeyController.createApiKey", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 without an organisationId", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ userId: "u" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("401 without a user", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ organisationId: "o" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("400 on an invalid body", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ organisationId: "o", userId: "u", body: { name: "" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.issue).not.toHaveBeenCalled();
  });

  it("201 with the issued key and normalised args", async () => {
    svc.issue.mockResolvedValue({ id: "k", apiKey: "yc_live_secret" });
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({
        organisationId: "o",
        userId: "u",
        body: { name: "CI", scopes: ["x"] },
      }),
      res,
    );
    expect(svc.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "o",
        name: "CI",
        createdBy: "u",
        expiresAt: null,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("coerces expiresAt to a Date", async () => {
    svc.issue.mockResolvedValue({});
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({
        organisationId: "o",
        userId: "u",
        body: { name: "CI", expiresAt: "2027-01-01T00:00:00.000Z" },
      }),
      res,
    );
    expect(svc.issue.mock.calls[0][0].expiresAt).toBeInstanceOf(Date);
  });

  it("maps a service error to its status", async () => {
    svc.issue.mockRejectedValue(new DeveloperApiKeyServiceError("bad", 400));
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ organisationId: "o", userId: "u", body: { name: "CI" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("500 on an unexpected error", async () => {
    svc.issue.mockRejectedValue(new Error("boom"));
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ organisationId: "o", userId: "u", body: { name: "CI" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperApiKeyController.listApiKeys", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 without an org", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("200 wrapping the keys in data", async () => {
    svc.list.mockResolvedValue([{ id: "k" }]);
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(
      buildReq({ organisationId: "o" }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: "k" }] });
  });

  it("500 on error", async () => {
    svc.list.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(
      buildReq({ organisationId: "o" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperApiKeyController.revokeApiKey", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 without an org", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.revokeApiKey(
      buildReq({ params: { keyId: "k" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("204 on success", async () => {
    svc.revoke.mockResolvedValue(undefined);
    const res = buildRes();
    await DeveloperApiKeyController.revokeApiKey(
      buildReq({ organisationId: "o", params: { keyId: "k" } }),
      res,
    );
    expect(svc.revoke).toHaveBeenCalledWith({
      organisationId: "o",
      keyId: "k",
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("404 maps the not-found service error", async () => {
    svc.revoke.mockRejectedValue(new DeveloperApiKeyServiceError("nf", 404));
    const res = buildRes();
    await DeveloperApiKeyController.revokeApiKey(
      buildReq({ organisationId: "o", params: { keyId: "k" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
