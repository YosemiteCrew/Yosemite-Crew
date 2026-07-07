import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const orgPermissions = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissions);
const permissionMiddlewares: Record<string, jest.Mock> = {};
const requirePermission = jest.fn((permission: string) => {
  permissionMiddlewares[permission] ??= jest.fn((_req, _res, next) => next());
  return permissionMiddlewares[permission];
});

const DeveloperExportController = {
  createExport: jest.fn(),
  listExports: jest.fn(),
  getExport: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("src/controllers/web/developer-export.controller", () => ({
  DeveloperExportController,
}));

const router = jest.requireActual("../../src/routers/developer-export.router")
  .default as Router;

type Layer = {
  handle: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const layers = (router as unknown as { stack: Layer[] }).stack ?? [];

const findRoute = (path: string, method: string) =>
  layers.find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("developer-export.router", () => {
  it.each([
    [
      "post",
      "/",
      "integrations:edit:any",
      DeveloperExportController.createExport,
    ],
    [
      "get",
      "/",
      "integrations:view:any",
      DeveloperExportController.listExports,
    ],
    [
      "get",
      "/:id",
      "integrations:view:any",
      DeveloperExportController.getExport,
    ],
  ])(
    "%s %s runs session auth, org permissions, %s, then the controller",
    (method, path, permission, handler) => {
      const route = findRoute(path, method);
      expect(route).toBeDefined();
      const chain = route!.stack.map((entry) => entry.handle);
      expect(chain).toEqual([
        authorizeCognito,
        orgPermissions,
        permissionMiddlewares[permission],
        handler,
      ]);
    },
  );

  it("registers exactly the three export routes", () => {
    const routes = layers.filter((entry) => entry.route);
    expect(routes).toHaveLength(3);
  });
});
