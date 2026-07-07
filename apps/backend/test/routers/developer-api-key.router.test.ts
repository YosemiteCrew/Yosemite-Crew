import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const orgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissionsMiddleware);
const permissionMiddlewares: Record<string, jest.Mock> = {};
const requirePermission = jest.fn((permission: string) => {
  permissionMiddlewares[permission] ??= jest.fn((_req, _res, next) => next());
  return permissionMiddlewares[permission];
});

const DeveloperApiKeyController = {
  createApiKey: jest.fn(),
  listApiKeys: jest.fn(),
  revokeApiKey: jest.fn(),
  rotateApiKey: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("src/controllers/web/developer-api-key.controller", () => ({
  DeveloperApiKeyController,
}));

const router = jest.requireActual("../../src/routers/developer-api-key.router")
  .default as Router;

type Layer = {
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

describe("developer-api-key.router", () => {
  it.each([
    ["/", "post", DeveloperApiKeyController.createApiKey],
    ["/", "get", DeveloperApiKeyController.listApiKeys],
    ["/:keyId", "delete", DeveloperApiKeyController.revokeApiKey],
    ["/:keyId/rotate", "post", DeveloperApiKeyController.rotateApiKey],
  ] as const)(
    "registers %s %s to the matching controller action",
    (path, method, handler) => {
      const route = findRoute(path, method);
      expect(route).toBeDefined();
      expect(route?.stack.at(-1)?.handle).toBe(handler);
    },
  );

  it("guards the rotate route with session auth and the edit permission", () => {
    const route = findRoute("/:keyId/rotate", "post");
    const handles = route?.stack.map((entry) => entry.handle);
    expect(handles).toEqual([
      authorizeCognito,
      orgPermissionsMiddleware,
      permissionMiddlewares["integrations:edit:any"],
      DeveloperApiKeyController.rotateApiKey,
    ]);
  });

  it("read routes use the view permission, mutating routes the edit permission", () => {
    expect(findRoute("/", "get")?.stack[2]?.handle).toBe(
      permissionMiddlewares["integrations:view:any"],
    );
    for (const [path, method] of [
      ["/", "post"],
      ["/:keyId", "delete"],
      ["/:keyId/rotate", "post"],
    ] as const) {
      expect(findRoute(path, method)?.stack[2]?.handle).toBe(
        permissionMiddlewares["integrations:edit:any"],
      );
    }
  });
});
