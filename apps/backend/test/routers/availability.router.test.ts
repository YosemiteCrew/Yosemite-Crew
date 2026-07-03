import type { Router } from "express";

const authorizeCognito = jest.fn(
  (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
);

const withOrgPermissions = jest.fn(() => {
  return (_req: unknown, _res: unknown, next: (err?: unknown) => void) =>
    next();
});
const requirePermission = jest.fn(() => {
  return (_req: unknown, _res: unknown, next: (err?: unknown) => void) =>
    next();
});

const AvailabilityController = {
  setAllBaseAvailability: jest.fn(),
  getBaseAvailability: jest.fn(),
  getOrganisationBaseAvailability: jest.fn(),
  deleteBaseAvailability: jest.fn(),
  setBaseAvailabilityForUser: jest.fn(),
  addWeeklyAvailabilityOverride: jest.fn(),
  getWeeklyAvailabilityOverride: jest.fn(),
  deleteWeeklyAvailabilityOverride: jest.fn(),
  addOccupancy: jest.fn(),
  addAllOccupancies: jest.fn(),
  getOccupancy: jest.fn(),
  getFinalAvailability: jest.fn(),
  getCurrentStatus: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/availability.controller", () => ({
  AvailabilityController,
}));

const availabilityRouter = jest.requireActual(
  "../../src/routers/availability.router",
).default as Router;

type Layer = {
  handle: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const layers = () =>
  (availabilityRouter as unknown as { stack: Layer[] }).stack ?? [];

const findRoute = (path: string, method: "get" | "post" | "delete") => {
  const layer = layers().find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );
  return layer?.route;
};

describe("availability.router", () => {
  it("applies Cognito auth via router.use", () => {
    expect(layers().some((layer) => layer.handle === authorizeCognito)).toBe(
      true,
    );
  });

  it("requires org permissions + appointments:view:any for org-wide base availability read", () => {
    const route = findRoute("/:orgId/base/all", "get");
    expect(requirePermission).toHaveBeenCalledWith("appointments:view:any");
    expect(route?.stack[0]?.handle).toEqual(expect.any(Function));
    expect(route?.stack[1]?.handle).toEqual(expect.any(Function));
    expect(route?.stack[2]?.handle).toEqual(expect.any(Function));

    const handler = route?.stack[2]?.handle as
      | ((req: unknown, res: unknown) => unknown)
      | undefined;
    handler?.({} as any, {} as any);
    expect(
      AvailabilityController.getOrganisationBaseAvailability,
    ).toHaveBeenCalled();
  });

  it("requires org permissions for mutating org-scoped routes", () => {
    const baseRoute = findRoute("/:orgId/base", "post");
    const bulkRoute = findRoute("/:orgId/occupancy/bulk", "post");

    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
    expect(baseRoute?.stack[0]?.handle).toEqual(expect.any(Function));
    expect(baseRoute?.stack[1]?.handle).toEqual(expect.any(Function));
    expect(baseRoute?.stack[2]?.handle).toEqual(expect.any(Function));
    expect(bulkRoute?.stack[0]?.handle).toEqual(expect.any(Function));
    expect(bulkRoute?.stack[1]?.handle).toEqual(expect.any(Function));
    expect(bulkRoute?.stack[2]?.handle).toEqual(expect.any(Function));
    expect(
      AvailabilityController.setAllBaseAvailability,
    ).not.toHaveBeenCalled();
  });
});
