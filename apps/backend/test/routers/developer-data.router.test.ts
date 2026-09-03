import type { NextFunction, Request, Response } from "express";

/*
 * Guards are applied at module load, so the only way to prove a route is gated
 * rather than merely reachable is to record what each guard factory was called
 * with. A pass-through mock alone would let an ungated route pass this suite.
 */
const scopeCalls: unknown[] = [];
const permissionCalls: unknown[] = [];
let appointmentOrgResolverUsed = 0;
let plainOrgResolverUsed = 0;

const passThrough = (_req: Request, _res: Response, next: NextFunction) =>
  next();

jest.mock("src/middlewares/api-key-auth", () => ({
  authorizeApiKey: passThrough,
  requireScope: (scope: unknown) => {
    scopeCalls.push(scope);
    return passThrough;
  },
}));

jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions: () => {
    plainOrgResolverUsed += 1;
    return passThrough;
  },
  withAppointmentOrgPermissions: () => {
    appointmentOrgResolverUsed += 1;
    return passThrough;
  },
  requirePermission: (permission: unknown) => {
    permissionCalls.push(permission);
    return passThrough;
  },
}));

const handlers = {
  listOrganizations: jest.fn(),
  getUsage: jest.fn(),
  listAppointments: jest.fn(),
  getAppointment: jest.fn(),
};

jest.mock("src/controllers/web/developer-data.controller", () => ({
  DeveloperDataController: handlers,
}));

import developerDataRouter from "src/routers/developer-data.router";

type Layer = { route?: { path: string; stack: { name: string }[] } };
const layers = (developerDataRouter as unknown as { stack: Layer[] }).stack;
const routeFor = (path: string) =>
  layers.find((l) => l.route?.path === path)?.route;

describe("developer data router", () => {
  it("applies authorizeApiKey to the whole router, so no route is key-free", () => {
    // The router-level `use` is a stack entry with no `route`.
    expect(layers.some((l) => !l.route)).toBe(true);
  });

  it("registers exactly the four published routes", () => {
    const paths = layers.flatMap((l) => (l.route ? [l.route.path] : []));
    expect(paths).toEqual([
      "/organizations",
      "/usage",
      "/appointments",
      "/appointments/:appointmentId",
    ]);
  });

  it("gates both appointment routes on the appointments:read scope", () => {
    expect(scopeCalls).toEqual(["appointments:read", "appointments:read"]);
  });

  it("gates both appointment routes on appointments:view:any", () => {
    expect(permissionCalls).toEqual([
      "appointments:view:any",
      "appointments:view:any",
    ]);
  });

  /*
   * The by-id route must derive the organisation from the appointment, not from
   * the caller's x-org-id. Using the plain resolver there would let a holder of
   * two practices name practice A while fetching practice B's record.
   */
  it("resolves the org from the record on the by-id route, and from the request on the list route", () => {
    expect(appointmentOrgResolverUsed).toBe(1);
    expect(plainOrgResolverUsed).toBe(1);
  });

  it("puts scope, org resolution and permission ahead of each appointment handler", () => {
    for (const path of ["/appointments", "/appointments/:appointmentId"]) {
      // scope + org resolver + permission + handler
      expect(routeFor(path)?.stack.length).toBe(4);
    }
  });

  /*
   * Discovery cannot require an organisation - it is how a caller learns which
   * ones it may name - and usage belongs to the developer rather than to a
   * practice. Both are handler-only by design; this pins that so neither
   * silently acquires an org gate that would make it unreachable for a
   * developer-door account with no UserOrganization row (the #2551 failure).
   */
  it("leaves the two developer-scoped routes ungated by organisation", () => {
    expect(routeFor("/organizations")?.stack.length).toBe(1);
    expect(routeFor("/usage")?.stack.length).toBe(1);
  });
});
