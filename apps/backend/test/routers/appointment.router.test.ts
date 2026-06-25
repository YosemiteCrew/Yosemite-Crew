import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const orgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const appointmentOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
const permissionMiddleware = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => orgPermissionsMiddleware);
const withAppointmentOrgPermissions = jest.fn(
  () => appointmentOrgPermissionsMiddleware,
);
const requirePermission = jest.fn(() => permissionMiddleware);

const AppointmentController = {
  createRequestedFromMobile: jest.fn(),
  rescheduleFromMobile: jest.fn(),
  getDocumentUplaodURL: jest.fn(),
  createFromPms: jest.fn(),
  acceptRequested: jest.fn(),
  rejectRequested: jest.fn(),
  cancelFromMobile: jest.fn(),
  cancelFromPMS: jest.fn(),
  checkInAppointment: jest.fn(),
  checkInAppointmentForPMS: jest.fn(),
  admitFromPMS: jest.fn(),
  markReadyForBillingForPMS: jest.fn(),
  reverseReadyForBillingForPMS: jest.fn(),
  updateFromPms: jest.fn(),
  attachFormsToAppointment: jest.fn(),
  getById: jest.fn(),
  listByCompanion: jest.fn(),
  listByCompanionForOrganisation: jest.fn(),
  listByParent: jest.fn(),
  listByOrganisation: jest.fn(),
  listByLead: jest.fn(),
  listBySupportStaff: jest.fn(),
  listByDateRange: jest.fn(),
  search: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withAppointmentOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/appointment.prisma.controller", () => ({
  AppointmentController,
}));

const appointmentRouter = jest.requireActual(
  "../../src/routers/appointment.router",
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
    (appointmentRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("appointment.router", () => {
  it("registers the inpatient admit PMS route with org permissions", () => {
    const admitRoute = findRoute(
      "/pms/:organisationId/:appointmentId/admit",
      "post",
    );

    expect(admitRoute).toBeDefined();
    expect(admitRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(admitRoute?.stack.map((layer) => layer.handle)).toContain(
      orgPermissionsMiddleware,
    );
    expect(admitRoute?.stack.map((layer) => layer.handle)).toContain(
      permissionMiddleware,
    );
    expect(AppointmentController.admitFromPMS).toHaveBeenCalledTimes(0);
    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
  });

  it("registers the reverse PMS ready-for-billing route", () => {
    const reverseRoute = findRoute(
      "/pms/:organisationId/:appointmentId/ready-for-billing",
      "delete",
    );

    expect(reverseRoute).toBeDefined();
    expect(reverseRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(reverseRoute?.stack.map((layer) => layer.handle)).toContain(
      orgPermissionsMiddleware,
    );
    expect(reverseRoute?.stack.map((layer) => layer.handle)).toContain(
      permissionMiddleware,
    );
    expect(
      AppointmentController.reverseReadyForBillingForPMS,
    ).toHaveBeenCalledTimes(0);
  });

  it("binds appointment detail reads through appointment org permissions", () => {
    const detailRoute = findRoute("/pms/:organisationId/:appointmentId", "get");

    expect(detailRoute).toBeDefined();
    expect(detailRoute?.stack.map((layer) => layer.handle)).toContain(
      appointmentOrgPermissionsMiddleware,
    );
  });
});
