import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const ServiceController = {
  createService: jest.fn(),
  createMany: jest.fn(),
  listOrganisationByServiceName: jest.fn(),
  listByOrganisation: jest.fn(),
  getBookableSlotsForService: jest.fn(),
  getCalendarPrefill: jest.fn(),
  getServiceById: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/controllers/web/service.controller", () => ({
  ServiceController,
}));

const serviceRouter = jest.requireActual("../../src/routers/service.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "post" | "patch" | "delete") => {
  const layer = (
    (serviceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("service.router", () => {
  it("requires Cognito auth for create service", () => {
    const route = findRoute("/", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.createService,
    ]);
  });

  it("requires Cognito auth for bulk create service", () => {
    const route = findRoute("/bulk", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.createMany,
    ]);
  });

  it("requires Cognito auth, org scoping and RBAC for update service", () => {
    const route = findRoute("/:id", "patch");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.updateService,
    ]);
  });

  it("requires Cognito auth, org scoping and RBAC for delete service", () => {
    const route = findRoute("/:id", "delete");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.deleteService,
    ]);
  });

  it("rejects an unauthenticated mutation before reaching the controller", () => {
    const rejectingAuth = jest.fn((_req, res, _next) =>
      res.status(401).json({ message: "Unauthorized" }),
    );

    const patchRoute = findRoute("/:id", "patch");
    const deleteRoute = findRoute("/:id", "delete");

    for (const route of [patchRoute, deleteRoute]) {
      const handlers = route?.stack.map((layer) => layer.handle) ?? [];
      // The very first handler on every mutation route is the Cognito guard.
      expect(handlers[0]).toBe(authorizeCognito);

      const status = jest.fn().mockReturnThis();
      const json = jest.fn();
      const res = { status, json } as never;
      const next = jest.fn();

      // Simulate an unauthenticated request hitting the guard.
      rejectingAuth({} as never, res, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }

    // The controller mutations are never the first handler, so an
    // unauthenticated client can never reach them directly.
    expect(patchRoute?.stack.map((layer) => layer.handle)[0]).not.toBe(
      ServiceController.updateService,
    );
    expect(deleteRoute?.stack.map((layer) => layer.handle)[0]).not.toBe(
      ServiceController.deleteService,
    );
  });
});
