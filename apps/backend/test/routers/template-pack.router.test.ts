import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const orgPermissions = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissions);
const permissionMiddlewares: Record<string, jest.Mock> = {};
const requirePermission = jest.fn((permission: string) => {
  permissionMiddlewares[permission] ??= jest.fn((_req, _res, next) => next());
  return permissionMiddlewares[permission];
});

const TemplatePackController = {
  createPack: jest.fn(),
  listPacks: jest.fn(),
  publishPack: jest.fn(),
  getCatalog: jest.fn(),
  installPack: jest.fn(),
  uninstallPack: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("src/controllers/web/template-pack.controller", () => ({
  TemplatePackController,
}));

const router = jest.requireActual("../../src/routers/template-pack.router")
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

describe("template-pack.router", () => {
  it.each([
    ["post", "/", "integrations:edit:any", TemplatePackController.createPack],
    ["get", "/", "integrations:view:any", TemplatePackController.listPacks],
    [
      "post",
      "/:id/publish",
      "integrations:edit:any",
      TemplatePackController.publishPack,
    ],
    [
      "post",
      "/:id/install",
      "integrations:edit:any",
      TemplatePackController.installPack,
    ],
    [
      "delete",
      "/:id/install",
      "integrations:edit:any",
      TemplatePackController.uninstallPack,
    ],
  ])(
    "%s %s runs session auth, org permissions, %s, then the controller",
    (method, path, permission, handler) => {
      const route = findRoute(path, method);
      expect(route).toBeDefined();
      expect(route!.stack.map((entry) => entry.handle)).toEqual([
        authorizeCognito,
        orgPermissions,
        permissionMiddlewares[permission],
        handler,
      ]);
    },
  );

  it("serves the catalog to any authenticated org session (no permission gate)", () => {
    const route = findRoute("/catalog", "get");
    expect(route).toBeDefined();
    expect(route!.stack.map((entry) => entry.handle)).toEqual([
      authorizeCognito,
      orgPermissions,
      TemplatePackController.getCatalog,
    ]);
  });

  it("registers /catalog before /:id routes so it is never captured as a pack id", () => {
    const catalogIndex = layers.findIndex(
      (entry) => entry.route?.path === "/catalog",
    );
    const idIndex = layers.findIndex(
      (entry) => entry.route?.path === "/:id/publish",
    );
    expect(catalogIndex).toBeGreaterThanOrEqual(0);
    expect(catalogIndex).toBeLessThan(idIndex);
  });

  it("registers exactly the six management routes", () => {
    expect(layers.filter((entry) => entry.route)).toHaveLength(6);
  });
});
