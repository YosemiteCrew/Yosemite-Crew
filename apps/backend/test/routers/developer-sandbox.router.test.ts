import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const orgPermissions = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissions);
const permissionMiddlewares: Record<string, jest.Mock> = {};
const requirePermission = jest.fn((permission: string) => {
  permissionMiddlewares[permission] ??= jest.fn((_req, _res, next) => next());
  return permissionMiddlewares[permission];
});

const DeveloperSandboxController = {
  createSandbox: jest.fn(),
  getSandbox: jest.fn(),
  deleteSandbox: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("src/controllers/web/developer-sandbox.controller", () => ({
  DeveloperSandboxController,
}));

const router = jest.requireActual("../../src/routers/developer-sandbox.router")
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

const findRoute = (method: string) =>
  layers.find(
    (entry) =>
      entry.route?.path === "/" && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("developer-sandbox.router", () => {
  it.each([
    ["post", "integrations:edit:any", DeveloperSandboxController.createSandbox],
    ["get", "integrations:view:any", DeveloperSandboxController.getSandbox],
    [
      "delete",
      "integrations:edit:any",
      DeveloperSandboxController.deleteSandbox,
    ],
  ])(
    "%s / runs session auth, org permissions, %s, then the controller",
    (method, permission, handler) => {
      const route = findRoute(method);
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

  it("registers no other routes (management plane stays minimal)", () => {
    const routes = layers.filter((entry) => entry.route);
    expect(routes).toHaveLength(3);
  });
});
