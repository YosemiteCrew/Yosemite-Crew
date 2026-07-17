import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const IntegrationController = {
  listForOrganisation: jest.fn(),
  getForOrganisation: jest.fn(),
  credentialMeta: jest.fn(),
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
  it("registers the non-secret credential-meta read before the generic provider route and guards it with the view permission", () => {
    const credentialMetaRoute = findRoute(
      "/pms/organisation/:organisationId/:provider/credential-meta",
      "get",
    );
    const genericProviderRoute = findRoute(
      "/pms/organisation/:organisationId/:provider",
      "get",
    );

    expect(credentialMetaRoute).toBeDefined();
    expect(genericProviderRoute).toBeDefined();

    // Must be registered BEFORE the generic /:provider route so ":provider"
    // does not swallow "credential-meta".
    expect(
      indexOfPath(
        "/pms/organisation/:organisationId/:provider/credential-meta",
      ),
    ).toBeLessThan(indexOfPath("/pms/organisation/:organisationId/:provider"));

    // Auth + org scoping + view permission, with the controller as the last layer.
    const handles = credentialMetaRoute?.stack.map((layer) => layer.handle);
    expect(handles).toContain(requireWebAuth);
    const orgScoping = withOrgPermissions.mock.results.map((r) => r.value);
    const perms = requirePermission.mock.results.map((r) => r.value);
    expect(orgScoping.some((mw) => handles?.includes(mw))).toBe(true);
    expect(perms.some((mw) => handles?.includes(mw))).toBe(true);
    expect(handles?.[handles.length - 1]).toBe(
      IntegrationController.credentialMeta,
    );
    expect(requirePermission).toHaveBeenCalledWith("integrations:view:any");
  });

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
