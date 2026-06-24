import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const TaskFhirController = {
  listEmployeeTasks: jest.fn(),
  listCompanionTasks: jest.fn(),
  create: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  changeStatus: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/task.fhir.controller", () => ({
  TaskFhirController,
}));

const router = jest.requireActual("../../src/routers/task.fhir.router")
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

describe("task.fhir.router", () => {
  it("exposes task collection and detail routes", () => {
    expect(findRoute("/organisation/:organisationId", "get")).toBeDefined();
    expect(findRoute("/companion/:patientId", "get")).toBeDefined();
    expect(
      findRoute("/organisation/:organisationId/:taskId", "patch"),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisation/:organisationId/:taskId/\$status`,
        "post",
      ),
    ).toBeDefined();
  });

  it("protects task routes with auth and RBAC", () => {
    const route = findRoute("/organisation/:organisationId", "get");
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
});
