import express from "express";
import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const CatalogController = {
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  getProductById: jest.fn(),
  getPackageDetail: jest.fn(),
  listProducts: jest.fn(),
  getOrganisationSummary: jest.fn(),
  listSpecialities: jest.fn(),
  createSpeciality: jest.fn(),
  updateSpeciality: jest.fn(),
  archiveSpeciality: jest.fn(),
  restoreSpeciality: jest.fn(),
  deleteSpeciality: jest.fn(),
  getSpecialityCatalog: jest.fn(),
  listServicesBySpeciality: jest.fn(),
  createService: jest.fn(),
  updateService: jest.fn(),
  archiveService: jest.fn(),
  restoreService: jest.fn(),
  deleteService: jest.fn(),
  listPackagesBySpeciality: jest.fn(),
  createPackage: jest.fn(),
  updatePackage: jest.fn(),
  archivePackage: jest.fn(),
  restorePackage: jest.fn(),
  deletePackage: jest.fn(),
  searchItems: jest.fn(),
  getArchiveCatalog: jest.fn(),
  resolveProduct: jest.fn(),
  getCatalogNearbyOrganisations: jest.fn(),
  getCatalogBookableSlots: jest.fn(),
  getCatalogCalendarPrefill: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/controllers/web/catalog.controller", () => ({
  CatalogController,
}));

const catalogRouter = jest.requireActual("../../src/routers/catalog.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
  handle?: {
    stack?: Layer[];
  };
  regexp?: RegExp;
};

const findRoute = (path: string, method: "get" | "post" | "patch" | "delete") =>
  ((catalogRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

const matchMountedRouteRegexp = (path: string) => {
  const app = express();
  app.use("/v1/catalog", catalogRouter);

  const mountedRouterLayer = (
    app as unknown as { _router: { stack: Layer[] } }
  )._router.stack.find((layer) => layer.handle?.stack?.length);

  const routeLayer = mountedRouterLayer?.handle?.stack?.find(
    (layer) => layer.route?.path === path,
  );

  return routeLayer?.regexp;
};

describe("catalog.router", () => {
  it("protects nearby catalog search", () => {
    const route = findRoute(
      "/organisations/:organisationId/services/nearby",
      "get",
    );

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.getCatalogNearbyOrganisations,
    ]);
  });

  it("protects catalog bookable slots", () => {
    const route = findRoute(
      "/organisations/:organisationId/bookable-slots",
      "post",
    );

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.getCatalogBookableSlots,
    ]);
  });

  it("protects catalog calendar prefill", () => {
    const route = findRoute(
      "/organisations/:organisationId/bookable-slots/calendar-prefill",
      "post",
    );

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.getCatalogCalendarPrefill,
    ]);
  });

  it("matches the mounted nearby URL", () => {
    const regexp = matchMountedRouteRegexp(
      "/organisations/:organisationId/services/nearby",
    );

    expect(regexp?.test("/organisations/org_1/services/nearby")).toBe(true);
    expect(regexp?.test("/services/nearby")).toBe(false);
  });
});
