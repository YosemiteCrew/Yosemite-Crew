import type { Request, Response } from "express";
import { prisma } from "src/config/prisma";
import type { VerifiedApiKey } from "src/services/developer-api-key.service";
import logger from "src/utils/logger";

// Per-key rate limiting for the developer data plane (contract 5.3). A token
// bucket per key id approximates a sliding window: sustained rate refills the
// bucket, burst is its capacity. This runs after key verification and BEFORE
// the monthly quota increment, so rate-limited requests never consume quota.
//
// Accepted limitations for v1:
// - Buckets are per process: with N replicas behind a load balancer a key can
//   consume up to N x its tier's rate before it throttles.
// - Buckets live in memory, so every deploy or restart resets them.
// - Store or tier-lookup errors fail open (the request is allowed); the
//   monthly quota in DeveloperUsageService remains the backstop.
// A shared (redis-backed) store can replace the in-memory one via the async
// ApiKeyRateLimitStore interface without touching the algorithm.

export type DeveloperRateLimitTier = "free" | "pro" | "enterprise";

export const RATE_LIMIT_TIERS: Record<
  DeveloperRateLimitTier,
  { ratePerSecond: number; burst: number }
> = {
  free: { ratePerSecond: 5, burst: 20 },
  pro: { ratePerSecond: 20, burst: 100 },
  enterprise: { ratePerSecond: 100, burst: 500 },
};

type RateLimitBucket = { tokens: number; refilledAt: number };

// Structural mirror of ApiKeyRequest (api-key-auth.ts) to avoid an import cycle.
interface ApiKeyBearingRequest extends Request {
  apiKey?: VerifiedApiKey;
}

// Store is injectable so tests run against a plain Map and a Redis-backed
// implementation can slot in later. Methods may be sync or async - callers
// always await them.
export interface ApiKeyRateLimitStore {
  get(
    key: string,
  ): RateLimitBucket | undefined | Promise<RateLimitBucket | undefined>;
  set(key: string, bucket: RateLimitBucket): void | Promise<void>;
}

export const createInMemoryRateLimitStore = (): ApiKeyRateLimitStore => {
  const buckets = new Map<string, RateLimitBucket>();
  return {
    get: (key) => buckets.get(key),
    set: (key, bucket) => {
      buckets.set(key, bucket);
    },
  };
};

const TIER_CACHE_TTL_MS = 60_000;

const defaultGetTier = async (
  organisationId: string,
): Promise<DeveloperRateLimitTier> => {
  const sub = await prisma.developerSubscription.findUnique({
    where: { organisationId },
    select: { plan: true },
  });
  const plan = sub?.plan;
  return plan === "pro" || plan === "enterprise" ? plan : "free";
};

export interface ApiKeyRateLimiterOptions {
  store?: ApiKeyRateLimitStore;
  now?: () => number;
  getTier?: (organisationId: string) => Promise<DeveloperRateLimitTier>;
  tierCacheTtlMs?: number;
}

// Returns true when the request may proceed. Sets the X-RateLimit-* headers on
// every response and sends the 429 itself when the key is over its window.
export type ApiKeyRateLimitCheck = (
  req: Request,
  res: Response,
) => Promise<boolean>;

export const createApiKeyRateLimiter = (
  options: ApiKeyRateLimiterOptions = {},
): ApiKeyRateLimitCheck => {
  const store = options.store ?? createInMemoryRateLimitStore();
  const now = options.now ?? Date.now;
  const getTier = options.getTier ?? defaultGetTier;
  const tierCacheTtlMs = options.tierCacheTtlMs ?? TIER_CACHE_TTL_MS;
  const tierCache = new Map<
    string,
    { tier: DeveloperRateLimitTier; expiresAt: number }
  >();

  const resolveTier = async (
    organisationId: string,
  ): Promise<DeveloperRateLimitTier> => {
    const at = now();
    const cached = tierCache.get(organisationId);
    if (cached && cached.expiresAt > at) {
      return cached.tier;
    }
    const tier = await getTier(organisationId);
    tierCache.set(organisationId, { tier, expiresAt: at + tierCacheTtlMs });
    return tier;
  };

  return async (req, res) => {
    const apiKey = (req as ApiKeyBearingRequest).apiKey;
    if (!apiKey) {
      // Key verification has not run; there is nothing to key the window on.
      return true;
    }
    try {
      const { ratePerSecond, burst } =
        RATE_LIMIT_TIERS[await resolveTier(apiKey.organisationId)];
      const at = now();
      const bucket = (await store.get(apiKey.id)) ?? {
        tokens: burst,
        refilledAt: at,
      };
      const elapsedSeconds = Math.max(0, (at - bucket.refilledAt) / 1000);
      const tokens = Math.min(
        burst,
        bucket.tokens + elapsedSeconds * ratePerSecond,
      );

      res.setHeader("X-RateLimit-Limit", String(burst));
      if (tokens < 1) {
        await store.set(apiKey.id, { tokens, refilledAt: at });
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader(
          "X-RateLimit-Reset",
          String(Math.ceil((burst - tokens) / ratePerSecond)),
        );
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((1 - tokens) / ratePerSecond))),
        );
        res.status(429).json({
          message: "Rate limit exceeded for this API key.",
          code: "rate_limited",
        });
        return false;
      }

      const remaining = tokens - 1;
      await store.set(apiKey.id, { tokens: remaining, refilledAt: at });
      res.setHeader("X-RateLimit-Remaining", String(Math.floor(remaining)));
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.ceil((burst - remaining) / ratePerSecond)),
      );
      return true;
    } catch (error) {
      // Fail open by design: the per-key window only protects against bursts,
      // and the monthly quota check still backstops abuse. Denying every data
      // read because the limiter's store or tier lookup is unhealthy would turn
      // an internal degradation into a full data-plane outage for integrators.
      logger.error("API key rate limiter failed; allowing request", { error });
      return true;
    }
  };
};

// Shared limiter instance used by the data-plane auth middleware.
export const enforceApiKeyRateLimit = createApiKeyRateLimiter();
