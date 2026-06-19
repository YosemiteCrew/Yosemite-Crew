import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const TaskScheduleFhirController = {
  listEncounterSchedules: jest.fn(),
  apply: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  cancel: jest.fn(),
  regenerate: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/task-schedule.fhir.controller", () => ({
  TaskScheduleFhirController,
}));

const router = jest.requireActual("../../src/routers/task-schedule.fhir.router")
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

describe("task-schedule.fhir.router", () => {
  it("exposes schedule lifecycle routes", () => {
    expect(
      findRoute("/organisation/:organisationId/encounter/:encounterId", "get"),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisation/:organisationId/template-instance/:instanceId/$apply",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisation/:organisationId/template-instance/:instanceId/$regenerate",
        "post",
      ),
    ).toBeDefined();
  });

  it("protects schedule routes with auth and RBAC", () => {
    const route = findRoute(
      "/organisation/:organisationId/encounter/:encounterId",
      "get",
    );
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissions.mock.results[0].value,
    );
    expect(requirePermission).toHaveBeenCalledWith([
      "tasks:view:any",
      "tasks:view:own",
    ]);
  });

  it("protects lifecycle routes with edit permissions", () => {
    findRoute(
      "/organisation/:organisationId/template-instance/:instanceId/$apply",
      "post",
    );
    expect(requirePermission).toHaveBeenCalledWith([
      "tasks:edit:any",
      "tasks:edit:own",
    ]);
  });
});
