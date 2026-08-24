import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());
const companionGuard = jest.fn((_req, _res, next) => next());
const requireCompanionPermission = jest.fn();

const CompanionController = {
  createCompanionMobile: jest.fn(),
  getCompanionById: jest.fn(),
  getCompanionByIdPMS: jest.fn(),
  updateCompanion: jest.fn(),
  deleteCompanion: jest.fn(),
  getProfileUploadUrl: jest.fn(),
  searchCompanionByName: jest.fn(),
  createCompanionPMS: jest.fn(),
  listParentCompanionsNotInOrganisation: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/middlewares/companion-access", () => ({
  requireCompanionPermission: (...args: unknown[]) => {
    requireCompanionPermission(...args);
    return companionGuard;
  },
}));

jest.mock("../../src/controllers/app/companion.controller", () => ({
  CompanionController,
}));

const companionRouter = jest.requireActual("../../src/routers/companion.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "put" | "delete") =>
  ((companionRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("companion.router", () => {
  it("protects the PMS org route with auth", () => {
    const route = findRoute("/org/:id", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CompanionController.getCompanionByIdPMS,
    ]);
  });

  // `withOrgPermissions` is load bearing twice over: `requirePermission` answers
  // 500 when no permission set has been loaded, so this route could only ever
  // error without it; and `Patient` rows are not org-scoped in the schema, so
  // the search behind it would otherwise span every companion in the product.
  it("requires auth, org scope and RBAC for companion name search", () => {
    const route = findRoute("/org/search", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      CompanionController.searchCompanionByName,
    ]);
  });

  it("does not expose companion name search without authentication", () => {
    const handlers =
      findRoute("/org/search", "get")?.stack.map((layer) => layer.handle) ?? [];

    expect(handlers[0]).toBe(requireWebAuth);
    expect(handlers).not.toContain(requireMobileAuth);
  });

  it("keeps the mobile routes on mobile auth", () => {
    expect(
      findRoute("/:id", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireMobileAuth,
      companionGuard,
      CompanionController.getCompanionById,
    ]);
  });

  /**
   * `Patient` rows are not scoped to a parent in the schema, and the handlers
   * behind these two routes look the row up by id alone - `getById` runs a bare
   * `findUnique`, and `update` writes with a bare `where: { id }`. Mobile auth
   * on its own therefore let any signed-in parent read, and overwrite, any of
   * the companions in the product. The guard is what supplies the ownership
   * test, so its presence is the assertion.
   */
  it.each([
    ["get", "read"],
    ["put", "overwrite"],
  ] as const)(
    "gates %s /:id so a parent cannot %s another's companion",
    (method) => {
      const handles = findRoute("/:id", method)?.stack.map((l) => l.handle);
      expect(handles).toContain(requireMobileAuth);
      expect(handles).toContain(companionGuard);
      expect(requireCompanionPermission).toHaveBeenCalledWith(
        "companionProfile",
        "id",
      );
    },
  );

  it("leaves delete to the service, which resolves the link itself", () => {
    // CompanionService.delete already resolves the parent, finds the link and
    // rejects a non-PRIMARY caller, including the role-specific behaviour the
    // permission blob does not describe. Adding the blanket guard here would
    // second-guess that with a coarser rule.
    const handles = findRoute("/:id", "delete")?.stack.map((l) => l.handle);
    expect(handles).toEqual([
      requireMobileAuth,
      CompanionController.deleteCompanion,
    ]);
  });
});
