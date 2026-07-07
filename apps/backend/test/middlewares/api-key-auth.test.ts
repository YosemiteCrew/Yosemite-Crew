import type { NextFunction, Request, Response } from "express";
import {
  authorizeApiKey,
  authorizeApiKeyVerifyOnly,
  requireScope,
} from "../../src/middlewares/api-key-auth";
import { enforceApiKeyRateLimit } from "../../src/middlewares/api-key-rate-limit";
import { DeveloperApiKeyService } from "../../src/services/developer-api-key.service";
import { DeveloperUsageService } from "../../src/services/developer-usage.service";

jest.mock("../../src/services/developer-api-key.service", () => ({
  DeveloperApiKeyService: { verify: jest.fn() },
}));

jest.mock("../../src/services/developer-usage.service", () => ({
  DeveloperUsageService: { incrementAndCheck: jest.fn() },
}));

jest.mock("../../src/middlewares/api-key-rate-limit", () => ({
  enforceApiKeyRateLimit: jest.fn(),
}));

const verifyMock = DeveloperApiKeyService.verify as jest.Mock;
const incrementMock = DeveloperUsageService.incrementAndCheck as jest.Mock;
const rateLimitMock = enforceApiKeyRateLimit as jest.Mock;

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (headers: Record<string, string> = {}, ip?: string): Request =>
  ({
    header: (name: string) => headers[name.toLowerCase()],
    ip,
  }) as unknown as Request;

const verifiedKey = {
  id: "k",
  organisationId: "org-9",
  scopes: ["x"],
  environment: "live",
  ipAllowlist: [],
};

describe("authorizeApiKey", () => {
  let next: NextFunction;
  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    incrementMock.mockResolvedValue({ allowed: true, callCount: 1 });
    rateLimitMock.mockResolvedValue(true);
  });

  it("401 with missing_api_key when no key is presented", async () => {
    const res = buildRes();
    await authorizeApiKey(buildReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Missing API key",
      code: "missing_api_key",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("401 with invalid_api_key when the key is invalid", async () => {
    verifyMock.mockResolvedValue(null);
    const res = buildRes();
    await authorizeApiKey(
      buildReq({ authorization: "Bearer yc_live_bad" }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired API key",
      code: "invalid_api_key",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("binds the org and calls next for a valid Bearer key", async () => {
    verifyMock.mockResolvedValue(verifiedKey);
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
    verifyMock.mockResolvedValue(verifiedKey);
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

  it("401 when Bearer token is blank (empty after prefix strip)", async () => {
    const res = buildRes();
    await authorizeApiKey(buildReq({ authorization: "Bearer " }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 when x-api-key header is present but blank", async () => {
    const res = buildRes();
    await authorizeApiKey(buildReq({ "x-api-key": "   " }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("runs the per-key rate limit BEFORE the quota increment", async () => {
    verifyMock.mockResolvedValue(verifiedKey);
    rateLimitMock.mockResolvedValue(false);
    const res = buildRes();
    await authorizeApiKey(
      buildReq({ authorization: "Bearer yc_live_good" }),
      res,
      next,
    );
    expect(rateLimitMock).toHaveBeenCalled();
    expect(incrementMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("429 with quota_exceeded and Retry-After when quota is exhausted", async () => {
    verifyMock.mockResolvedValue(verifiedKey);
    incrementMock.mockResolvedValue({ allowed: false, callCount: 1001 });
    const res = buildRes();
    await authorizeApiKey(
      buildReq({ authorization: "Bearer yc_live_good" }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: "Monthly API quota exceeded. Upgrade to Pro to continue.",
      code: "quota_exceeded",
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      expect.stringMatching(/^\d+$/),
    );
    expect(next).not.toHaveBeenCalled();
  });

  describe("IP allowlist enforcement", () => {
    const withAllowlist = (allowlist: string[]) => ({
      ...verifiedKey,
      ipAllowlist: allowlist,
    });

    it("passes when the client IP is in the allowlist", async () => {
      verifyMock.mockResolvedValue(withAllowlist(["203.0.113.9"]));
      const req = buildReq(
        { authorization: "Bearer yc_live_good" },
        "203.0.113.9",
      );
      await authorizeApiKey(req, buildRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("401s with the invalid_api_key envelope (no allowlist leak) for a disallowed IP", async () => {
      verifyMock.mockResolvedValue(withAllowlist(["203.0.113.9"]));
      const res = buildRes();
      await authorizeApiKey(
        buildReq({ authorization: "Bearer yc_live_good" }, "198.51.100.7"),
        res,
        next,
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid or expired API key",
        code: "invalid_api_key",
      });
      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(incrementMock).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("matches an IPv4-mapped IPv6 client address against a plain IPv4 entry", async () => {
      verifyMock.mockResolvedValue(withAllowlist(["203.0.113.9"]));
      const req = buildReq(
        { authorization: "Bearer yc_live_good" },
        "::ffff:203.0.113.9",
      );
      await authorizeApiKey(req, buildRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("401s when the allowlist is non-empty but the client IP is unresolvable", async () => {
      verifyMock.mockResolvedValue(withAllowlist(["203.0.113.9"]));
      const res = buildRes();
      await authorizeApiKey(
        buildReq({ authorization: "Bearer yc_live_good" }),
        res,
        next,
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("ignores the client IP entirely when the allowlist is empty", async () => {
      verifyMock.mockResolvedValue(withAllowlist([]));
      const req = buildReq(
        { authorization: "Bearer yc_live_good" },
        "198.51.100.7",
      );
      await authorizeApiKey(req, buildRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  it("calls incrementAndCheck with the organisationId and key environment", async () => {
    verifyMock.mockResolvedValue({ ...verifiedKey, environment: "test" });
    const res = buildRes();
    await authorizeApiKey(
      buildReq({ authorization: "Bearer yc_test_good" }),
      res,
      next,
    );
    expect(incrementMock).toHaveBeenCalledWith("org-9", "test");
  });
});

describe("authorizeApiKeyVerifyOnly", () => {
  let next: NextFunction;
  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    rateLimitMock.mockResolvedValue(true);
  });

  it("verifies, rate limits, and skips the quota increment", async () => {
    verifyMock.mockResolvedValue(verifiedKey);
    const req = buildReq({ authorization: "Bearer yc_live_good" });
    const res = buildRes();

    await authorizeApiKeyVerifyOnly(req, res, next);

    expect(rateLimitMock).toHaveBeenCalled();
    expect(incrementMock).not.toHaveBeenCalled();
    expect((req as unknown as { organisationId: string }).organisationId).toBe(
      "org-9",
    );
    expect(next).toHaveBeenCalled();
  });

  it("still 401s an invalid key", async () => {
    verifyMock.mockResolvedValue(null);
    const res = buildRes();
    await authorizeApiKeyVerifyOnly(
      buildReq({ authorization: "Bearer yc_live_bad" }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireScope", () => {
  let next: NextFunction;
  beforeEach(() => {
    next = jest.fn();
  });

  it("403 with insufficient_scope when the scope is absent", () => {
    const req = { apiKey: { scopes: ["a"] } } as unknown as Request;
    const res = buildRes();
    requireScope("b")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Insufficient scope for this API key",
      code: "insufficient_scope",
    });
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
