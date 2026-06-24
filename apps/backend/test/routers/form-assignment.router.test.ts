import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const FormAssignmentController = {
  createForAppointment: jest.fn(),
  listForAppointment: jest.fn(),
  listForCompanion: jest.fn(),
  listForOrganisation: jest.fn(),
  resend: jest.fn(),
  cancel: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("src/controllers/web/form-assignment.controller", () => ({
  FormAssignmentController,
}));

const formAssignmentRouter = jest.requireActual(
  "../../src/routers/form-assignment.router",
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
    (formAssignmentRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("form-assignment.router", () => {
  it("registers the assignment lifecycle routes", () => {
    expect(
      findRoute(
        "/organisations/:organisationId/appointments/:appointmentId/assignments",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisations/:organisationId/appointments/:appointmentId/assignments",
        "get",
      ),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/assignments", "get"),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisations/:organisationId/companions/:companionId/assignments",
        "get",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/assignments/:assignmentId/\$resend`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/assignments/:assignmentId/\$cancel`,
        "post",
      ),
    ).toBeDefined();
  });

  it("protects the routes with auth and org permissions middleware", () => {
    const createRoute = findRoute(
      "/organisations/:organisationId/appointments/:appointmentId/assignments",
      "post",
    );

    expect(createRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(withOrgPermissions).toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith("forms:edit:any");
    expect(FormAssignmentController.createForAppointment).toHaveBeenCalledTimes(
      0,
    );
  });
});
