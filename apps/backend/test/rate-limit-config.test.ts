import {
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  resolveRateLimitMax,
  resolveRateLimitWindowMs,
} from "../src/utils/rate-limit-config";

describe("rate limit configuration", () => {
  it("keeps production's current ceiling when nothing is set", () => {
    expect(resolveRateLimitMax(undefined)).toBe(500);
    expect(DEFAULT_RATE_LIMIT_MAX).toBe(500);
    expect(resolveRateLimitWindowMs(undefined)).toBe(15 * 60 * 1000);
    expect(DEFAULT_RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("raises the ceiling only when an environment asks for it", () => {
    expect(resolveRateLimitMax("5000")).toBe(5000);
    expect(resolveRateLimitWindowMs("60000")).toBe(60_000);
  });

  it("falls back rather than accepting a value that would break the API", () => {
    // express-rate-limit reads max: 0 as "block everything", so a typo that
    // produced zero would take the API down instead of loosening it.
    expect(resolveRateLimitMax("0")).toBe(500);
    expect(resolveRateLimitMax("-1")).toBe(500);
    expect(resolveRateLimitMax("")).toBe(500);
    expect(resolveRateLimitMax("   ")).toBe(500);
    expect(resolveRateLimitMax("lots")).toBe(500);
    expect(resolveRateLimitMax("5e3")).toBe(500);
    expect(resolveRateLimitMax("500.5")).toBe(500);
    expect(resolveRateLimitWindowMs("0")).toBe(15 * 60 * 1000);
    expect(resolveRateLimitWindowMs("nope")).toBe(15 * 60 * 1000);
  });

  it("tolerates surrounding whitespace, which an env var routinely carries", () => {
    expect(resolveRateLimitMax(" 2000 ")).toBe(2000);
  });
});
