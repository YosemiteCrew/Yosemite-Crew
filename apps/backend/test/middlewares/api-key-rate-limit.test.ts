import type { Request, Response } from "express";
import {
  RATE_LIMIT_TIERS,
  createApiKeyRateLimiter,
  createInMemoryRateLimitStore,
  type ApiKeyRateLimitStore,
  type DeveloperRateLimitTier,
} from "../../src/middlewares/api-key-rate-limit";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerSubscription: { findUnique: jest.fn() },
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

import { prisma } from "../../src/config/prisma";

const subFindUnique = (
  prisma as unknown as { developerSubscription: { findUnique: jest.Mock } }
).developerSubscription.findUnique;

const buildRes = (): Response & { headers: Record<string, string> } => {
  const headers: Record<string, string> = {};
  const res: Partial<Response> & { headers: Record<string, string> } = {
    headers,
  };
  res.setHeader = jest.fn((name: string, value: unknown) => {
    headers[name] = String(value);
    return res;
  }) as never;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & { headers: Record<string, string> };
};

const buildReq = (keyId = "key-1", organisationId = "org-1"): Request =>
  ({
    apiKey: { id: keyId, organisationId, scopes: [], environment: "live" },
  }) as unknown as Request;

const freeTier = async (): Promise<DeveloperRateLimitTier> => "free";

describe("createApiKeyRateLimiter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows a request through when auth has not run (no apiKey)", async () => {
    const limiter = createApiKeyRateLimiter({ getTier: freeTier });
    const res = buildRes();
    await expect(limiter({} as Request, res)).resolves.toBe(true);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("sets the X-RateLimit headers on an allowed request", async () => {
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => 0,
    });
    const res = buildRes();
    await expect(limiter(buildReq(), res)).resolves.toBe(true);
    expect(res.headers["X-RateLimit-Limit"]).toBe("20");
    expect(res.headers["X-RateLimit-Remaining"]).toBe("19");
    expect(Number(res.headers["X-RateLimit-Reset"])).toBeGreaterThanOrEqual(1);
  });

  it("free tier: allows a burst of 20 then 429s with the contract shape", async () => {
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => 0,
    });
    for (let i = 0; i < 20; i += 1) {
      await expect(limiter(buildReq(), buildRes())).resolves.toBe(true);
    }
    const res = buildRes();
    await expect(limiter(buildReq(), res)).resolves.toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rate limit exceeded for this API key.",
      code: "rate_limited",
    });
    expect(res.headers["X-RateLimit-Remaining"]).toBe("0");
    expect(res.headers["Retry-After"]).toBe("1");
  });

  it("refills at the sustained rate: 200ms buys one token at 5 rps", async () => {
    let clock = 0;
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => clock,
    });
    for (let i = 0; i < 20; i += 1) {
      await limiter(buildReq(), buildRes());
    }
    await expect(limiter(buildReq(), buildRes())).resolves.toBe(false);

    clock = 200; // 0.2s * 5 rps = exactly 1 token
    await expect(limiter(buildReq(), buildRes())).resolves.toBe(true);
    await expect(limiter(buildReq(), buildRes())).resolves.toBe(false);
  });

  it("caps refill at the burst size", async () => {
    let clock = 0;
    const store = createInMemoryRateLimitStore();
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => clock,
      store,
    });
    await limiter(buildReq(), buildRes());
    clock = 3_600_000; // an hour later the bucket is full again, not larger
    const res = buildRes();
    await limiter(buildReq(), res);
    expect(res.headers["X-RateLimit-Remaining"]).toBe("19");
  });

  it("applies pro and enterprise tier limits", async () => {
    expect(RATE_LIMIT_TIERS.pro).toEqual({ ratePerSecond: 20, burst: 100 });
    expect(RATE_LIMIT_TIERS.enterprise).toEqual({
      ratePerSecond: 100,
      burst: 500,
    });
    const limiter = createApiKeyRateLimiter({
      getTier: async () => "enterprise",
      now: () => 0,
    });
    const res = buildRes();
    await limiter(buildReq(), res);
    expect(res.headers["X-RateLimit-Limit"]).toBe("500");
    expect(res.headers["X-RateLimit-Remaining"]).toBe("499");
  });

  it("tracks separate windows per key id", async () => {
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => 0,
    });
    for (let i = 0; i < 20; i += 1) {
      await limiter(buildReq("key-a"), buildRes());
    }
    await expect(limiter(buildReq("key-a"), buildRes())).resolves.toBe(false);
    await expect(limiter(buildReq("key-b"), buildRes())).resolves.toBe(true);
  });

  it("caches the tier lookup for ~60s and refreshes after expiry", async () => {
    let clock = 0;
    const getTier = jest.fn(async () => "free" as DeveloperRateLimitTier);
    const limiter = createApiKeyRateLimiter({ getTier, now: () => clock });

    await limiter(buildReq(), buildRes());
    clock = 30_000;
    await limiter(buildReq(), buildRes());
    expect(getTier).toHaveBeenCalledTimes(1);

    clock = 61_000;
    await limiter(buildReq(), buildRes());
    expect(getTier).toHaveBeenCalledTimes(2);
  });

  it("defaults to the free tier from the subscription lookup", async () => {
    subFindUnique.mockResolvedValue(null);
    const limiter = createApiKeyRateLimiter({ now: () => 0 });
    const res = buildRes();
    await expect(limiter(buildReq(), res)).resolves.toBe(true);
    expect(subFindUnique).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      select: { plan: true },
    });
    expect(res.headers["X-RateLimit-Limit"]).toBe("20");
  });

  it("uses the subscription plan when it is pro", async () => {
    subFindUnique.mockResolvedValue({ plan: "pro" });
    const limiter = createApiKeyRateLimiter({ now: () => 0 });
    const res = buildRes();
    await limiter(buildReq(), res);
    expect(res.headers["X-RateLimit-Limit"]).toBe("100");
  });

  it("fails open when the store throws, and logs the failure", async () => {
    const store: ApiKeyRateLimitStore = {
      get: () => {
        throw new Error("store down");
      },
      set: () => undefined,
    };
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => 0,
      store,
    });
    await expect(limiter(buildReq(), buildRes())).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      "API key rate limiter failed; allowing request",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("fails open when the tier lookup rejects", async () => {
    const limiter = createApiKeyRateLimiter({
      getTier: async () => {
        throw new Error("db down");
      },
      now: () => 0,
    });
    await expect(limiter(buildReq(), buildRes())).resolves.toBe(true);
  });

  it("works against an async (redis-style) store returning Promises", async () => {
    const buckets = new Map<string, { tokens: number; refilledAt: number }>();
    const store: ApiKeyRateLimitStore = {
      get: async (key) => buckets.get(key),
      set: async (key, bucket) => {
        buckets.set(key, bucket);
      },
    };
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => 0,
      store,
    });
    for (let i = 0; i < 20; i += 1) {
      await expect(limiter(buildReq(), buildRes())).resolves.toBe(true);
    }
    const res = buildRes();
    await expect(limiter(buildReq(), res)).resolves.toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("fails open when an async store rejects", async () => {
    const store: ApiKeyRateLimitStore = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => undefined,
    };
    const limiter = createApiKeyRateLimiter({
      getTier: freeTier,
      now: () => 0,
      store,
    });
    await expect(limiter(buildReq(), buildRes())).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      "API key rate limiter failed; allowing request",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});
