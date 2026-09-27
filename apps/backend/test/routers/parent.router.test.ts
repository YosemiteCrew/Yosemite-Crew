import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());

// One gate per permission, so a route's stack shows exactly which permission it checks.
const permissionGates = new Map<string, jest.Mock>();
const permissionGate = (permission: string) => {
  if (!permissionGates.has(permission)) {
    permissionGates.set(
      permission,
      jest.fn((_req, _res, next) => next()),
    );
  }
  return permissionGates.get(permission)!;
};

const ParentController = {
  createParentMobile: jest.fn(),
  getParentMobile: jest.fn(),
  updateParentMobile: jest.fn(),
  deleteParentMobile: jest.fn(),
  getProfileUploadUrl: jest.fn(),
  createParentPMS: jest.fn(),
  getParentPMS: jest.fn(),
  updateParentPMS: jest.fn(),
  searchByName: jest.fn(),
};

const CompanionController = {
  getCompanionsByParentId: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  requirePermission: (permission: string) => permissionGate(permission),
}));

jest.mock("../../src/controllers/app/parent.controller", () => ({
  ParentController,
}));

jest.mock("../../src/controllers/app/companion.controller", () => ({
  CompanionController,
}));

const router = jest.requireActual("../../src/routers/parent.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const handlersFor = (path: string, method: string) =>
  ((router as unknown as { stack: Layer[] }).stack ?? [])
    .find(
      (entry) =>
        entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
    )
    ?.route?.stack.map((layer) => layer.handle);

describe("parent.router", () => {
  describe("PMS routes act for a verified organisation", () => {
    it.each([
      ["get", "/pms/parents/:id", "companions:view:any", "getParentPMS"],
      ["get", "/pms/search", "companions:view:any", "searchByName"],
      ["post", "/pms/parents", "companions:edit:any", "createParentPMS"],
      ["put", "/pms/parents/:id", "companions:edit:any", "updateParentPMS"],
    ] as const)(
      "%s %s requires membership and %s",
      // Destructured from the rest tuple: under TypeScript 5.9, it.each over an
      // `as const` table types the callback as a union of tuples.
      (...[method, path, permission, handler]) => {
        expect(handlersFor(path, method)).toEqual([
          requireWebAuth,
          withOrgPermissionsMiddleware,
          permissionGate(permission),
          ParentController[handler],
        ]);
      },
    );
  });

  describe("mobile routes stay on mobile auth", () => {
    // Ownership is checked by the service against the caller's own parent
    // record, so there is no organisation layer here.
    it.each([
      ["get", "/:id", "getParentMobile"],
      ["put", "/:id", "updateParentMobile"],
      ["delete", "/:id", "deleteParentMobile"],
    ] as const)("%s %s", (...[method, path, handler]) => {
      expect(handlersFor(path, method)).toEqual([
        requireMobileAuth,
        ParentController[handler],
      ]);
    });

    it("lists companions through the caller-scoped handler", () => {
      expect(handlersFor("/:parentId/companions", "get")).toEqual([
        requireMobileAuth,
        CompanionController.getCompanionsByParentId,
      ]);
    });
  });
});
