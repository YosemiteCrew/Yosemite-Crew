import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const withAppointmentOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const withTaskOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requireSuperAdmin = jest.fn((_req, _res, next) => next());
const resolveBodyPatientCompanion = jest.fn();
const resolveObservationSubmissionCompanion = jest.fn();
const resolveObservationTaskCompanion = jest.fn();
const companionGuards: Array<{
  feature: string;
  resolver: unknown;
  guard: jest.Mock;
}> = [];
const requireCompanionPermissionForResource = jest.fn(
  (feature: string, resolver: unknown) => {
    const guard = jest.fn((_req, _res, next) => next());
    companionGuards.push({ feature, resolver, guard });
    return guard;
  },
);

const ObservationToolDefinitionController = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
};

const ObservationToolSubmissionController = {
  createFromMobile: jest.fn(),
  linkAppointment: jest.fn(),
  linkAppointmentFromMobile: jest.fn(),
  getPreviewByTaskId: jest.fn(),
  listForPms: jest.fn(),
  getById: jest.fn(),
  listForAppointment: jest.fn(),
  createForAppointment: jest.fn(),
  getByTaskId: jest.fn(),
  listTaskPreviewsForAppointment: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withTaskOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/middlewares/super-admin", () => ({
  requireSuperAdmin,
}));

jest.mock("../../src/middlewares/companion-access", () => ({
  requireCompanionPermissionForResource,
  resolveBodyPatientCompanion,
  resolveObservationSubmissionCompanion,
  resolveObservationTaskCompanion,
}));

jest.mock("../../src/controllers/web/observationTool.controller", () => ({
  ObservationToolDefinitionController,
  ObservationToolSubmissionController,
}));

const observationToolRouter = jest.requireActual(
  "../../src/routers/observationTool.routes",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (observationToolRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

const handlesOf = (path: string, method: string) =>
  findRoute(path, method)?.stack.map((layer) => layer.handle) ?? [];

const companionGuardFor = (resolver: unknown) =>
  companionGuards.find((entry) => entry.resolver === resolver);

describe("observationTool.routes", () => {
  it.each([
    {
      path: "/mobile/tools/:toolId/submissions",
      method: "post",
      feature: "medicalRecords",
      resolver: resolveBodyPatientCompanion,
      handler: ObservationToolSubmissionController.createFromMobile,
    },
    {
      path: "/mobile/submissions/:submissionId/link-appointment",
      method: "post",
      feature: "appointments",
      resolver: resolveObservationSubmissionCompanion,
      handler: ObservationToolSubmissionController.linkAppointmentFromMobile,
    },
    {
      path: "/mobile/tasks/:taskId/preview",
      method: "get",
      feature: "medicalRecords",
      resolver: resolveObservationTaskCompanion,
      handler: ObservationToolSubmissionController.getPreviewByTaskId,
    },
  ])(
    "checks the companion before $method $path",
    ({ path, method, feature, resolver, handler }) => {
      const handles = handlesOf(path, method);
      const entry = companionGuardFor(resolver);

      expect(entry?.feature).toBe(feature);
      expect(handles).toEqual([requireMobileAuth, entry?.guard, handler]);
    },
  );

  it.each([
    ["/pms/tools", "post"],
    ["/pms/tools/:toolId", "patch"],
    ["/pms/tools/:toolId/archive", "post"],
  ])("limits %s %s to platform administrators", (path, method) => {
    const handles = handlesOf(path, method);
    expect(handles.slice(0, 2)).toEqual([requireWebAuth, requireSuperAdmin]);
  });

  it("protects mobile list and submission routes plus PMS create with auth", () => {
    const mobileListRoute = findRoute("/mobile/tools", "get");
    const mobileSubmitRoute = findRoute(
      "/mobile/tools/:toolId/submissions",
      "post",
    );
    const pmsCreateRoute = findRoute("/pms/tools", "post");

    expect(mobileListRoute?.stack.map((layer) => layer.handle)).toContain(
      requireMobileAuth,
    );
    expect(mobileSubmitRoute?.stack.map((layer) => layer.handle)).toContain(
      requireMobileAuth,
    );
    expect(pmsCreateRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
  });

  it("protects PMS submission, task, and appointment routes with RBAC", () => {
    const submissionListRoute = findRoute("/pms/submissions", "get");
    const submissionDetailRoute = findRoute(
      "/pms/submissions/:submissionId",
      "get",
    );
    const linkRoute = findRoute(
      "/pms/submissions/:submissionId/link-appointment",
      "post",
    );
    const appointmentSubmissionsRoute = findRoute(
      "/pms/appointments/:appointmentId/submissions",
      "post",
    );
    const appointmentCreateRoute = findRoute(
      "/pms/appointments/:appointmentId/submissions/create",
      "post",
    );
    const taskSubmissionRoute = findRoute(
      "/pms/tasks/:taskId/submission",
      "get",
    );
    const taskPreviewRoute = findRoute("/pms/tasks/:taskId/preview", "get");
    const appointmentTaskPreviewsRoute = findRoute(
      "/pms/appointments/:appointmentId/task-previews",
      "get",
    );

    expect(submissionListRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(submissionDetailRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(linkRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(
      appointmentSubmissionsRoute?.stack.map((layer) => layer.handle),
    ).toContain(requireWebAuth);
    expect(
      appointmentCreateRoute?.stack.map((layer) => layer.handle),
    ).toContain(requireWebAuth);
    expect(
      appointmentCreateRoute?.stack.map((layer) => layer.handle),
    ).toContain(ObservationToolSubmissionController.createForAppointment);
    expect(
      appointmentSubmissionsRoute?.stack.map((layer) => layer.handle),
    ).toContain(ObservationToolSubmissionController.listForAppointment);
    expect(taskSubmissionRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(taskPreviewRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(
      appointmentTaskPreviewsRoute?.stack.map((layer) => layer.handle),
    ).toContain(requireWebAuth);

    expect(withOrgPermissions).toHaveBeenCalledTimes(3);
    expect(withAppointmentOrgPermissions).toHaveBeenCalledTimes(3);
    expect(withTaskOrgPermissions).toHaveBeenCalledTimes(2);
    expect(requirePermission).toHaveBeenCalledWith("appointments:view:any");
    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
    expect(requirePermission).toHaveBeenCalledWith("tasks:view:any");
  });
});
