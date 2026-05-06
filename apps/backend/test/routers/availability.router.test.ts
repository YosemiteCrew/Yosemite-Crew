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
    expect(route?.stack[0]?.handle).toBe(
      withOrgPermissions.mock.results[0]?.value,
    );
    expect(route?.stack[1]?.handle).toBe(
      requirePermission.mock.results[0]?.value,
    );
    expect(typeof route?.stack[2]?.handle).toBe("function");

    expect(withOrgPermissions).toHaveBeenCalledTimes(1);
    expect(requirePermission).toHaveBeenCalledWith("appointments:view:any");

    const handler = route?.stack[2]?.handle as unknown as
      | ((req: unknown, res: unknown) => unknown)
      | undefined;
    expect(handler).toBeDefined();
    handler?.({} as any, {} as any);
    expect(
      AvailabilityController.getOrganisationBaseAvailability,
    ).toHaveBeenCalled();
  });
});
