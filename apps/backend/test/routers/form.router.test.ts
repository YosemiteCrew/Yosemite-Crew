import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const withAppointmentOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const FormController = {
  createForm: jest.fn(),
  getFormListForOrganisation: jest.fn(),
  getFormForAdmin: jest.fn(),
  updateForm: jest.fn(),
  publishForm: jest.fn(),
  unpublishForm: jest.fn(),
  archiveForm: jest.fn(),
  submitFormFromPMS: jest.fn(),
  getSOAPNotesByAppointment: jest.fn(),
  getFormsForAppointment: jest.fn(),
  getFormForClient: jest.fn(),
  submitForm: jest.fn(),
  getFormSubmissions: jest.fn(),
  listFormSubmissions: jest.fn(),
  getConsentFormForParent: jest.fn(),
  getFormSubmissionPDF: jest.fn(),
};

const FormSigningController = {
  startSigning: jest.fn(),
  getSignedDocument: jest.fn(),
  startSigningMobile: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  withAppointmentOrgPermissions: () => withAppointmentOrgPermissionsMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/controllers/web/form.controller", () => ({
  FormController,
}));

jest.mock("../../src/controllers/web/formSigning.contorller", () => ({
  FormSigningController,
}));

const formRouter = jest.requireActual("../../src/routers/form.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "post" | "get" | "put") => {
  const layer = (
    (formRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("form.router", () => {
  it("secures admin create-form with cognito auth, org scoping and RBAC", () => {
    const route = findRoute("/admin/:orgId", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      FormController.createForm,
    ]);
  });

  it("secures PMS start-signing with cognito auth, org scoping and RBAC", () => {
    const route = findRoute("/form-submissions/:submissionId/sign", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      FormSigningController.startSigning,
    ]);
  });

  it("scopes appointment forms with appointment-org permissions", () => {
    const route = findRoute("/appointments/:appointmentId/forms", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withAppointmentOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      FormController.getFormsForAppointment,
    ]);
  });

  it("leaves the public form route unauthenticated", () => {
    const route = findRoute("/public/:formId", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      FormController.getFormForClient,
    ]);
  });

  it("guards mobile signing with mobile cognito auth", () => {
    const route = findRoute(
      "/mobile/form-submissions/:submissionId/sign",
      "post",
    );

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognitoMobile,
      FormSigningController.startSigningMobile,
    ]);
  });

  it("never exposes an admin mutation with the controller as the first handler", () => {
    const route = findRoute("/admin/:orgId", "post");
    const handlers = route?.stack.map((layer) => layer.handle) ?? [];

    expect(handlers[0]).toBe(authorizeCognito);
    expect(handlers[0]).not.toBe(FormController.createForm);
  });
});
