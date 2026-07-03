import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const TemplateController = {
  resolve: jest.fn(),
  list: jest.fn(),
  listLibrary: jest.fn(),
  listOrganisationTemplates: jest.fn(),
  listUserTemplates: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  archive: jest.fn(),
  createInstance: jest.fn(),
  updateInstance: jest.fn(),
  submitInstance: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/template.controller", () => ({
  TemplateController,
}));

const templateRouter = jest.requireActual("../../src/routers/template.router")
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
    (templateRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("template.router", () => {
  it("exposes the template resolver route", () => {
    expect(findRoute("/pms/resolve", "get")).toBeDefined();
  });

  it("exposes the explicit ownership listing routes", () => {
    expect(findRoute("/pms/templates/library", "get")).toBeDefined();
    expect(
      findRoute("/pms/templates/organisation/:organisationId", "get"),
    ).toBeDefined();
    expect(
      findRoute("/pms/templates/organisation/:organisationId/users/me", "get"),
    ).toBeDefined();
  });

  it("protects library and organisation routes with the expected middleware", () => {
    const resolveRoute = findRoute("/pms/resolve", "get");
    const libraryRoute = findRoute("/pms/templates/library", "get");
    const organisationRoute = findRoute(
      "/pms/templates/organisation/:organisationId",
      "get",
    );
    const userRoute = findRoute(
      "/pms/templates/organisation/:organisationId/users/me",
      "get",
    );

    expect(resolveRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(resolveRoute?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissions.mock.results[0].value,
    );
    expect(resolveRoute?.stack.map((layer) => layer.handle)).toContain(
      requirePermission.mock.results[0].value,
    );
    expect(libraryRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(libraryRoute?.stack.map((layer) => layer.handle)).not.toContain(
      requirePermission.mock.results[0].value,
    );
    expect(organisationRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(userRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(organisationRoute?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissions.mock.results[1].value ??
        withOrgPermissions.mock.results[0].value,
    );
    expect(userRoute?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissions.mock.results[2].value ??
        withOrgPermissions.mock.results[1].value ??
        withOrgPermissions.mock.results[0].value,
    );
    expect(requirePermission).toHaveBeenCalledWith(["forms:view:any"]);
  });
});
