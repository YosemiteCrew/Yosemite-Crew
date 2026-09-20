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
    userId?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {},
): Request =>
  ({
    body: over.body ?? {},
    params: over.params ?? {},
    headers: {},
    userId: over.userId,
  }) as unknown as Request;

describe("DeveloperApiKeyController.createApiKey", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 without a verified user", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("400 on an invalid body", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ userId: "u", body: { name: "" } }),
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
        userId: "u",
        body: { name: "CI", scopes: ["x"] },
      }),
      res,
    );
    expect(svc.issue).toHaveBeenCalledWith(
      expect.objectContaining({
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
      buildReq({ userId: "u", body: { name: "CI" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("500 on an unexpected error", async () => {
    svc.issue.mockRejectedValue(new Error("boom"));
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ userId: "u", body: { name: "CI" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/*
 * The regression that IS issue #2551.
 *
 * These routes were gated on `withOrgPermissions()` and keyed on an
 * organisation. A developer who signs up through the developer door never gets
 * one - provisioning grants the `developer` role and nothing else, and there is
 * no developer entry in the RBAC role model - so every request from the
 * portal's own audience failed before reaching a handler.
 *
 * A request carrying a session and NO organisation must now succeed.
 */
describe("a developer account with no organisation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("can issue a key", async () => {
    svc.issue.mockResolvedValue({ id: "k", apiKey: "yc_live_x" });
    const res = buildRes();
    await DeveloperApiKeyController.createApiKey(
      buildReq({ userId: "dev-1", body: { name: "CI" } }),
      res,
    );
    expect(svc.issue).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: "dev-1", createdBy: "dev-1" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("can list its own keys, scoped to itself", async () => {
    svc.list.mockResolvedValue([]);
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(
      buildReq({ userId: "dev-1" }),
      res,
    );
    expect(svc.list).toHaveBeenCalledWith("dev-1");
  });

  /* The owner comes from the session, never from anything the caller can set,
     so one developer cannot read or revoke another's keys by naming them. */
  it("ignores an owner supplied in the body", async () => {
    svc.list.mockResolvedValue([]);
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(
      buildReq({ userId: "dev-1", body: { ownerUserId: "dev-2" } }),
      res,
    );
    expect(svc.list).toHaveBeenCalledWith("dev-1");
  });
});

describe("DeveloperApiKeyController.listApiKeys", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 without a verified user", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("200 wrapping the keys in data", async () => {
    svc.list.mockResolvedValue([{ id: "k" }]);
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(buildReq({ userId: "u" }), res);
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: "k" }] });
  });

  it("500 on error", async () => {
    svc.list.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperApiKeyController.listApiKeys(buildReq({ userId: "u" }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperApiKeyController.revokeApiKey", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 without a verified user", async () => {
    const res = buildRes();
    await DeveloperApiKeyController.revokeApiKey(
      buildReq({ params: { keyId: "k" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("204 on success", async () => {
    svc.revoke.mockResolvedValue(undefined);
    const res = buildRes();
    await DeveloperApiKeyController.revokeApiKey(
      buildReq({ userId: "u", params: { keyId: "k" } }),
      res,
    );
    expect(svc.revoke).toHaveBeenCalledWith({
      ownerUserId: "u",
      keyId: "k",
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("404 maps the not-found service error", async () => {
    svc.revoke.mockRejectedValue(new DeveloperApiKeyServiceError("nf", 404));
    const res = buildRes();
    await DeveloperApiKeyController.revokeApiKey(
      buildReq({ userId: "u", params: { keyId: "k" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
