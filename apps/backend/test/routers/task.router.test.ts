import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const withTaskOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const TaskController = {
  createFromLibrary: jest.fn(),
  createFromTemplate: jest.fn(),
  createCustomTaskFromPms: jest.fn(),
  listEmployeeTasks: jest.fn(),
  listForCompanion: jest.fn(),
  getById: jest.fn(),
  updateTaskPMS: jest.fn(),
  changeStatusPMS: jest.fn(),
  createCustomTask: jest.fn(),
  listParentTasks: jest.fn(),
  updateTask: jest.fn(),
  changeStatus: jest.fn(),
};

const TaskLibraryController = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
};

const TaskTemplateController = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withTaskOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/task.controller", () => ({
  TaskController,
  TaskLibraryController,
  TaskTemplateController,
}));

const taskRouter = jest.requireActual("../../src/routers/task.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (taskRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("task.router", () => {
  it("protects task library write routes with authorizeCognito", () => {
    const createRoute = findRoute("/pms/library", "post");
    const updateRoute = findRoute("/pms/library/:libraryId", "put");

    expect(createRoute).toBeDefined();
    expect(updateRoute).toBeDefined();

    expect(createRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(updateRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
  });

  it("protects PMS task create, list, and detail routes with RBAC", () => {
    const createLibraryRoute = findRoute("/pms/from-library", "post");
    const createTemplateRoute = findRoute("/pms/from-template", "post");
    const createCustomRoute = findRoute("/pms/custom", "post");
    const employeeListRoute = findRoute(
      "/pms/organisation/:organisationId",
      "get",
    );
    const companionListRoute = findRoute("/pms/companion/:patientId", "get");
    const getTaskRoute = findRoute("/pms/:taskId", "get");
    const updateTaskRoute = findRoute("/pms/:taskId", "patch");
    const changeStatusRoute = findRoute("/pms/:taskId/status", "post");

    expect(createLibraryRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(createTemplateRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(createCustomRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(employeeListRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(companionListRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(getTaskRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(updateTaskRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(changeStatusRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );

    expect(withOrgPermissions).toHaveBeenCalled();
    expect(withTaskOrgPermissions).toHaveBeenCalledTimes(3);
    expect(requirePermission).toHaveBeenCalledWith([
      "tasks:edit:any",
      "tasks:edit:own",
    ]);
    expect(requirePermission).toHaveBeenCalledWith([
      "tasks:view:any",
      "tasks:view:own",
    ]);
  });
});
