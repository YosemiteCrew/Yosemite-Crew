import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const EncounterController = {
  create: jest.fn(),
  update: jest.fn(),
  discharge: jest.fn(),
  assignUnit: jest.fn(),
  listUnitAssignments: jest.fn(),
  listAdmissionUnitAssignments: jest.fn(),
  start: jest.fn(),
  readyForDischarge: jest.fn(),
  undoReadyForDischarge: jest.fn(),
  listActiveInpatients: jest.fn(),
  getById: jest.fn(),
  list: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("src/controllers/web/case-encounter.controller", () => ({
  EncounterController,
}));

const router = jest.requireActual("../../src/routers/encounter.router")
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

describe("encounter.router", () => {
  it("registers the encounter action routes", () => {
    expect(findRoute(String.raw`/:id/\$discharge`, "post")).toBeDefined();
    expect(findRoute(String.raw`/:id/\$assign-unit`, "post")).toBeDefined();
    expect(findRoute(String.raw`/:id/\$unit-assignments`, "get")).toBeDefined();
    expect(
      findRoute(String.raw`/:id/\$admission-unit-assignments`, "get"),
    ).toBeDefined();
    expect(findRoute(String.raw`/:id/\$start`, "post")).toBeDefined();
    expect(
      findRoute(String.raw`/:id/\$ready-for-discharge`, "post"),
    ).toBeDefined();
    expect(
      findRoute(String.raw`/:id/\$undo-ready-for-discharge`, "post"),
    ).toBeDefined();
    expect(findRoute(String.raw`/\$active-inpatients`, "get")).toBeDefined();
  });

  it("protects the routes with auth and permissions middleware", () => {
    const route = findRoute(String.raw`/:id/\$discharge`, "post");

    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
  });
});
