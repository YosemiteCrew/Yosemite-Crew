import express from "express";
import type { NextFunction, Request, Response, Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
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
  requireWebAuth,
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
    const route = findRoute(String.raw`/\$search-components`, "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      expect.any(Function),
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.searchCatalogOperation,
    ]);
  });

  it("requires Cognito auth for resolve selection", () => {
    const route = findRoute(String.raw`/\$resolve-selection`, "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      expect.any(Function),
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CatalogController.resolveProductOperation,
    ]);
  });

  it("matches the mounted search-components URL", () => {
    const routePath = matchMountedRouteRegexp(String.raw`/\$search-components`);

    expect(routePath).toBe(String.raw`/\$search-components`);
  });

  describe("attachOrganisationIdFromQuery", () => {
    const attachOrganisationIdFromQuery = findRoute("/", "get")?.stack[1]
      .handle as (req: Request, res: Response, next: NextFunction) => void;

    const runMiddleware = (
      query: Record<string, unknown>,
      params: Record<string, string> = {},
    ) => {
      const req = { query, params } as unknown as Request;
      const next = jest.fn();

      attachOrganisationIdFromQuery(req, {} as Response, next);

      return { req, next };
    };

    it("copies the organization query into params without the FHIR prefix", () => {
      const { req, next } = runMiddleware({
        organization: "Organization/org-1",
      });

      expect(req.params.organisationId).toBe("org-1");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("falls back to the provided-by query value", () => {
      const { req, next } = runMiddleware({ "provided-by": "org-2" });

      expect(req.params.organisationId).toBe("org-2");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("leaves params untouched when neither query value is a string", () => {
      const { req, next } = runMiddleware({ organization: ["Organization/a"] });

      expect(req.params.organisationId).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("does not overwrite an existing organisationId param", () => {
      const { req, next } = runMiddleware(
        { organization: "Organization/org-1" },
        { organisationId: "already-set" },
      );

      expect(req.params.organisationId).toBe("already-set");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
