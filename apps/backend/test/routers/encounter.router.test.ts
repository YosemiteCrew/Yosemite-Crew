import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const withEncounterOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
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
  requireWebAuth,
}));

jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  withEncounterOrgPermissions,
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

    expect(route?.stack[0]?.handle).toBe(requireWebAuth);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
  });

  it("derives the organisation from the encounter on every :id addressed route", () => {
    const derivedOrgHandlers = withEncounterOrgPermissions.mock.results.map(
      (result) => result.value,
    );
    const idRoutes: Array<[string, string]> = [
      ["/:id", "patch"],
      ["/:id", "get"],
      [String.raw`/:id/\$discharge`, "post"],
      [String.raw`/:id/\$assign-unit`, "post"],
      [String.raw`/:id/\$unit-assignments`, "get"],
      [String.raw`/:id/\$admission-unit-assignments`, "get"],
      [String.raw`/:id/\$start`, "post"],
      [String.raw`/:id/\$ready-for-discharge`, "post"],
      [String.raw`/:id/\$undo-ready-for-discharge`, "post"],
    ];

    expect(idRoutes).toHaveLength(
      withEncounterOrgPermissions.mock.calls.length,
    );

    for (const [path, method] of idRoutes) {
      const route = findRoute(path, method);

      expect(route).toBeDefined();
      expect(derivedOrgHandlers).toContain(route?.stack[1]?.handle);
    }
  });

  it("scopes the collection routes to the requested organisation", () => {
    const requestedOrgHandlers = withOrgPermissions.mock.results.map(
      (result) => result.value,
    );

    for (const [path, method] of [
      ["/", "post"],
      ["/", "get"],
      [String.raw`/\$active-inpatients`, "get"],
    ] as Array<[string, string]>) {
      const route = findRoute(path, method);

      expect(route).toBeDefined();
      expect(requestedOrgHandlers).toContain(route?.stack[1]?.handle);
    }
  });
});
