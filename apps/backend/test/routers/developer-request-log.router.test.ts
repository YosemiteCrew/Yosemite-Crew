import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const orgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissionsMiddleware);
const permissionMiddlewares: Record<string, jest.Mock> = {};
const requirePermission = jest.fn((permission: string) => {
  permissionMiddlewares[permission] ??= jest.fn((_req, _res, next) => next());
  return permissionMiddlewares[permission];
});

const DeveloperRequestLogController = {
  listRequestLogs: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("src/controllers/web/developer-request-log.controller", () => ({
  DeveloperRequestLogController,
}));

const router = jest.requireActual(
  "../../src/routers/developer-request-log.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const layers = (router as unknown as { stack: Layer[] }).stack ?? [];

describe("developer-request-log.router", () => {
  it("registers GET / with the management-plane session auth chain", () => {
    const route = layers.find(
      (entry) => entry.route?.path === "/" && entry.route?.methods?.get,
    )?.route;
    expect(route).toBeDefined();
    const handles = route?.stack.map((entry) => entry.handle);
    expect(handles).toEqual([
      authorizeCognito,
      orgPermissionsMiddleware,
      permissionMiddlewares["integrations:view:any"],
      DeveloperRequestLogController.listRequestLogs,
    ]);
  });

  it("guards with the integrations view permission", () => {
    expect(requirePermission).toHaveBeenCalledWith("integrations:view:any");
  });
});
