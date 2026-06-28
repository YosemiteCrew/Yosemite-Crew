import type { NextFunction, Request, Response } from "express";
import {
  authorizeApiKey,
  requireScope,
} from "../../src/middlewares/api-key-auth";
import { DeveloperApiKeyService } from "../../src/services/developer-api-key.service";

jest.mock("../../src/services/developer-api-key.service", () => ({
  DeveloperApiKeyService: { verify: jest.fn() },
}));

const verifyMock = DeveloperApiKeyService.verify as jest.Mock;

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (headers: Record<string, string> = {}): Request =>
  ({
    header: (name: string) => headers[name.toLowerCase()],
  }) as unknown as Request;

describe("authorizeApiKey", () => {
  let next: NextFunction;
  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  it("401 when no key is presented", async () => {
    const res = buildRes();
    await authorizeApiKey(buildReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 when the key is invalid", async () => {
    verifyMock.mockResolvedValue(null);
    const res = buildRes();
    await authorizeApiKey(
      buildReq({ authorization: "Bearer yc_live_bad" }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("binds the org and calls next for a valid Bearer key", async () => {
    verifyMock.mockResolvedValue({
      id: "k",
      organisationId: "org-9",
      scopes: ["x"],
      environment: "live",
    });
    const req = buildReq({ authorization: "Bearer yc_live_good" });
    const res = buildRes();

    await authorizeApiKey(req, res, next);

    expect(verifyMock).toHaveBeenCalledWith("yc_live_good");
    expect((req as unknown as { organisationId: string }).organisationId).toBe(
      "org-9",
    );
    expect(next).toHaveBeenCalled();
  });

  it("accepts the X-API-Key header", async () => {
    verifyMock.mockResolvedValue({
      id: "k",
      organisationId: "org-9",
      scopes: [],
      environment: "live",
    });
    const res = buildRes();
    await authorizeApiKey(buildReq({ "x-api-key": "yc_live_good" }), res, next);
    expect(verifyMock).toHaveBeenCalledWith("yc_live_good");
    expect(next).toHaveBeenCalled();
  });

  it("ignores a non-Bearer Authorization header", async () => {
    const res = buildRes();
    await authorizeApiKey(buildReq({ authorization: "Basic abc" }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireScope", () => {
  let next: NextFunction;
  beforeEach(() => {
    next = jest.fn();
  });

  it("403 when the scope is absent", () => {
    const req = { apiKey: { scopes: ["a"] } } as unknown as Request;
    const res = buildRes();
    requireScope("b")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes when the scope is present", () => {
    const req = { apiKey: { scopes: ["b"] } } as unknown as Request;
    requireScope("b")(req, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("wildcard scope passes everything", () => {
    const req = { apiKey: { scopes: ["*"] } } as unknown as Request;
    requireScope("anything")(req, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("403 when there is no apiKey context", () => {
    requireScope("b")({} as Request, buildRes(), next);
    expect(next).not.toHaveBeenCalled();
  });
});
