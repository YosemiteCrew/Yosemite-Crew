import type { Router } from "express";

const rateLimiters: { windowMs: number; max: number }[] = [];

jest.mock("express-rate-limit", () => ({
  __esModule: true,
  default: (options: { windowMs: number; max: number }) => {
    rateLimiters.push(options);
    const middleware = (_req: unknown, _res: unknown, next: () => void) =>
      next();
    return middleware;
  },
}));

const PublicBookingController = {
  getPractice: jest.fn(),
  getSlots: jest.fn(),
  submitRequest: jest.fn(),
  confirmRequest: jest.fn(),
};

jest.mock("../../src/controllers/app/public-booking.controller", () => ({
  PublicBookingController,
}));

const router = jest.requireActual(
  "../../src/routers/booking-page-public.router",
).default as Router;

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
};

const layers = (): Layer[] =>
  (router as unknown as { stack: Layer[] }).stack ?? [];

describe("booking-page-public.router", () => {
  it("exposes exactly the four public routes, confirm first", () => {
    const routes = layers()
      .filter((entry) => entry.route)
      .map(
        (entry) =>
          `${Object.keys(entry.route?.methods ?? {})[0]} ${entry.route?.path}`,
      );

    expect(routes).toEqual([
      "post /requests/confirm",
      "get /:slug",
      "get /:slug/slots",
      "post /:slug/requests",
    ]);
  });

  it("mounts no authentication middleware at all", () => {
    // Deliberate: this router is the anonymous surface. The assertion exists so
    // that adding a guard here - or removing the service-level checks because
    // "the router handles it" - is a visible decision.
    const moduleSource = jest
      .requireActual("node:fs")
      .readFileSync(
        require.resolve("../../src/routers/booking-page-public.router"),
        "utf8",
      ) as string;

    expect(moduleSource).not.toContain("requireWebAuth");
    expect(moduleSource).not.toContain("requireMobileAuth");
    expect(moduleSource).not.toContain("requireAnyAuth");
  });

  it("gives reads and writes separate per-IP budgets", () => {
    // Two limiters, and the write budget is the tighter one: an accepted write
    // puts mail in an address the caller chose.
    const budgets = rateLimiters.map((limiter) => limiter.max);
    expect(budgets).toEqual([60, 10]);
    expect(
      rateLimiters.every((limiter) => limiter.windowMs === 15 * 60 * 1000),
    ).toBe(true);
  });
});
