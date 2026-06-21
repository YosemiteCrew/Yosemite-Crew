import express from "express";
import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const CatalogController = {
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  getProductById: jest.fn(),
  listProducts: jest.fn(),
  resolveProductOperation: jest.fn(),
  searchCatalogOperation: jest.fn(),
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

const healthcareServiceRouter = jest.requireActual(
  "../../src/routers/healthcare-service.router",
).default as Router;

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

const findRoute = (path: string, method: "post" | "get" | "patch") => {
  const layer = (
    (healthcareServiceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

const matchMountedRouteRegexp = (path: string) => {
  const app = express();
  app.use("/fhir/v1/healthcare-service", healthcareServiceRouter);

  const mountedRouterLayer = (
    app as unknown as { _router: { stack: Layer[] } }
  )._router.stack.find((layer) => layer.handle?.stack?.length);

  const routeLayer = mountedRouterLayer?.handle?.stack?.find(
    (layer) => layer.route?.path === path,
  );

  return routeLayer?.route?.path;
};

describe("healthcare-service.router", () => {
  it("requires Cognito auth for component search", () => {
    const route = findRoute("/$search-components", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      expect.any(Function),
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.searchCatalogOperation,
    ]);
  });

  it("requires Cognito auth for resolve selection", () => {
    const route = findRoute("/$resolve-selection", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      expect.any(Function),
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.resolveProductOperation,
    ]);
  });

  it("matches the mounted search-components URL", () => {
    const routePath = matchMountedRouteRegexp("/$search-components");

    expect(routePath).toBe("/$search-components");
  });
});
