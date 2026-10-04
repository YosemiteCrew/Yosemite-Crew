import type { Router } from "express";

const rateLimiters: { windowMs: number; max: number }[] = [];

jest.mock("express-rate-limit", () => ({
  __esModule: true,
  default: (options: { windowMs: number; max: number }) => {
    rateLimiters.push(options);
    return (_req: unknown, _res: unknown, next: () => void) => next();
  },
}));

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
// Each guard carries the permission it was built for, so a test can read which
// permission sits on which route.
const requirePermission = jest.fn((permission: string) =>
  Object.assign(jest.fn(), { permission }),
);

const PracticeWebsiteController = {
  getConfig: jest.fn(),
  saveConfig: jest.fn(),
};
const PublicSiteController = { getSite: jest.fn() };

jest.mock("../../src/middlewares/auth", () => ({ requireWebAuth }));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("../../src/controllers/web/practice-website.controller", () => ({
  PracticeWebsiteController,
}));
jest.mock("../../src/controllers/app/public-site.controller", () => ({
  PublicSiteController,
}));

type Layer = {
  handle?: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: { permission?: string } }>;
  };
};

const layersOf = (router: Router): Layer[] =>
  (router as unknown as { stack: Layer[] }).stack ?? [];

describe("practice-website.router", () => {
  const router = jest.requireActual("../../src/routers/practice-website.router")
    .default as Router;
  const layers = layersOf(router);

  const permissionOn = (method: string) =>
    layers
      .find((entry) => entry.route?.methods?.[method])
      ?.route?.stack.map((step) => step.handle.permission)
      .find(Boolean);

  it("exposes read and save for one organisation", () => {
    expect(
      layers
        .filter((entry) => entry.route)
        .map((entry) => [
          entry.route?.path,
          Object.keys(entry.route?.methods ?? {}),
        ]),
    ).toEqual([
      ["/:organisationId", ["get"]],
      ["/:organisationId", ["put"]],
    ]);
  });

  it("requires a web session before any route", () => {
    const firstRoute = layers.findIndex((entry) => Boolean(entry.route));
    expect(layers.slice(0, firstRoute).map((entry) => entry.handle)).toContain(
      requireWebAuth,
    );
  });

  it("reads with teams:view:any and publishes with teams:edit:any", () => {
    expect(withOrgPermissions).toHaveBeenCalledTimes(2);
    expect(permissionOn("get")).toBe("teams:view:any");
    expect(permissionOn("put")).toBe("teams:edit:any");
  });
});

describe("practice-website-public.router", () => {
  const router = jest.requireActual(
    "../../src/routers/practice-website-public.router",
  ).default as Router;

  it("exposes only the anonymous site read, behind a per-IP budget", () => {
    expect(
      layersOf(router)
        .filter((entry) => entry.route)
        .map(
          (entry) =>
            `${Object.keys(entry.route?.methods ?? {})[0]} ${entry.route?.path}`,
        ),
    ).toEqual(["get /:slug"]);
    expect(rateLimiters).toEqual([
      expect.objectContaining({ windowMs: 15 * 60 * 1000, max: 60 }),
    ]);
  });
});
