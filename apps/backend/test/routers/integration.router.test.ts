import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const IntegrationController = {
  listForOrganisation: jest.fn(),
  getForOrganisation: jest.fn(),
  updateCredentials: jest.fn(),
  enable: jest.fn(),
  disable: jest.fn(),
  validate: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/integration.controller", () => ({
  IntegrationController,
}));

const integrationRouter = jest.requireActual(
  "../../src/routers/integration.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const stack = () =>
  (integrationRouter as unknown as { stack: Layer[] }).stack ?? [];

const findRoute = (path: string, method: string) => {
  const layer = stack().find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );
  return layer?.route;
};

const indexOfPath = (path: string) =>
  stack().findIndex((entry) => entry.route?.path === path);

describe("integration.router", () => {
  it("guards the credential write routes with the edit permission", () => {
    const credentialsRoute = findRoute(
      "/pms/organisation/:organisationId/:provider/credentials",
      "post",
    );
    const validateRoute = findRoute(
      "/pms/organisation/:organisationId/:provider/validate",
      "post",
    );

    expect(credentialsRoute).toBeDefined();
    expect(validateRoute).toBeDefined();
    expect(credentialsRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(requirePermission).toHaveBeenCalledWith("integrations:edit:any");
  });
});
