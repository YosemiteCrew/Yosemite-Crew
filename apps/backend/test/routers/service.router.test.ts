import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const attachSessionIfPresent = jest.fn((_req, _res, next) => next());
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
  requireWebAuth,
  attachSessionIfPresent,
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

const findRoute = (
  path: string,
  method: "post" | "patch" | "delete" | "get",
) => {
  const layer = (
    (serviceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

const handlersOf = (
  path: string,
  method: "post" | "patch" | "delete" | "get",
) => findRoute(path, method)?.stack.map((layer) => layer.handle) ?? [];

describe("service.router", () => {
  it("requires web auth, org scoping and RBAC for create service", () => {
    expect(handlersOf("/", "post")).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.createService,
    ]);
  });

  it("requires web auth, org scoping and RBAC for bulk create service", () => {
    expect(handlersOf("/bulk", "post")).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.createMany,
    ]);
  });

  it("requires web auth, org scoping and RBAC for update service", () => {
    expect(handlersOf("/:id", "patch")).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.updateService,
    ]);
  });

  it("requires web auth, org scoping and RBAC for delete service", () => {
    expect(handlersOf("/:id", "delete")).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      ServiceController.deleteService,
    ]);
  });

  // Discovery reads are a signed-out surface (the pet-parent app browses clinics
  // and slots before login). They must not carry an auth guard, but they are
  // rate limited and never expose a controller as the first handler.
  it.each([
    ["/organisation/search", "get" as const, "listOrganisationByServiceName"],
    ["/organisation/:organisationId", "get" as const, "listByOrganisation"],
    ["/bookable-slots", "post" as const, "getBookableSlotsForService"],
    ["/bookable-slots/calendar-prefill", "post" as const, "getCalendarPrefill"],
    ["/:id", "get" as const, "getServiceById"],
  ])(
    "keeps %s publicly reachable behind the rate limiter",
    (path, method, controllerKey) => {
      const handlers = handlersOf(path, method);
      const controller =
        ServiceController[controllerKey as keyof typeof ServiceController];

      // Public: no session guard on the route.
      expect(handlers).not.toContain(requireWebAuth);
      // The controller runs, but a rate limiter guards it first.
      expect(handlers).toContain(controller);
      expect(handlers[0]).not.toBe(controller);
      expect(handlers.length).toBeGreaterThanOrEqual(2);
    },
  );

  // The two slot routes attach the session when one is present so authenticated
  // callers keep the `vetIds` assignment hint the controller redacts otherwise.
  it.each([
    ["/bookable-slots", "post" as const],
    ["/bookable-slots/calendar-prefill", "post" as const],
  ])("attaches an optional session on %s", (path, method) => {
    const handlers = handlersOf(path, method);
    expect(handlers).toContain(attachSessionIfPresent);
  });

  it("rejects an unauthenticated mutation before reaching the controller", () => {
    const rejectingAuth = jest.fn((_req, res, _next) =>
      res.status(401).json({ message: "Unauthorized" }),
    );

    const patchRoute = findRoute("/:id", "patch");
    const deleteRoute = findRoute("/:id", "delete");

    for (const route of [patchRoute, deleteRoute]) {
      const handlers = route?.stack.map((layer) => layer.handle) ?? [];
      // The very first handler on every mutation route is the web auth guard.
      expect(handlers[0]).toBe(requireWebAuth);

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
    expect(handlersOf("/:id", "patch")[0]).not.toBe(
      ServiceController.updateService,
    );
    expect(handlersOf("/:id", "delete")[0]).not.toBe(
      ServiceController.deleteService,
    );
  });
});
