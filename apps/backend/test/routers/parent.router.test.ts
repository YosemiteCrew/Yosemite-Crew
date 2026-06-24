import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

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
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
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

const findRoute = (path: string, method: string) => {
  const layer = ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );
  return layer?.route;
};

describe("parent.router", () => {
  it("guards the PMS parent update route with org membership + companions:edit", () => {
    const route = findRoute("/pms/parents/:id", "put");
    expect(route).toBeDefined();
    // authorizeCognito, then withOrgPermissions, requirePermission, then the controller.
    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(4);
    expect(requirePermission).toHaveBeenCalledWith("companions:edit:any");
  });

  it("guards the PMS parent create route with org membership + companions:edit", () => {
    const route = findRoute("/pms/parents", "post");
    expect(route).toBeDefined();
    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the mobile parent update route self-scoped (no org-permission middleware)", () => {
    const route = findRoute("/:id", "put");
    expect(route).toBeDefined();
    // Mobile updates authorise by self-ownership only — no withOrgPermissions layer.
    expect(route?.stack[0]?.handle).toBe(authorizeCognitoMobile);
    expect(route?.stack.length).toBe(2);
  });
});
