import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
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
  requireWebAuth,
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

  // Each withOrgPermissions()/requirePermission() call returns a distinct
  // middleware, so routes are matched against the set of returned values rather
  // than a registration index, which shifts whenever a route is added.
  const usesOrgPermissions = (handles: unknown[]) =>
    withOrgPermissions.mock.results.some((result) =>
      handles.includes(result.value),
    );

  const usesRequirePermission = (handles: unknown[]) =>
    requirePermission.mock.results.some((result) =>
      handles.includes(result.value),
    );

  const handlesFor = (path: string, method = "get") =>
    findRoute(path, method)?.stack.map((layer) => layer.handle) ?? [];

  it("protects library and organisation routes with the expected middleware", () => {
    const routes = [
      "/pms/resolve",
      "/pms/templates/library",
      "/pms/templates/organisation/:organisationId",
      "/pms/templates/organisation/:organisationId/users/me",
    ];

    for (const path of routes) {
      const handles = handlesFor(path);
      expect(handles).toContain(requireWebAuth);
      expect(usesOrgPermissions(handles)).toBe(true);
      expect(usesRequirePermission(handles)).toBe(true);
    }

    expect(requirePermission).toHaveBeenCalledWith(["forms:view:any"]);
  });

  it("gates the YC library listing on org membership and forms:view:any", () => {
    // The library is global state; without these the route was reachable by any
    // authenticated user with no organisation or permission check at all.
    const handles = handlesFor("/pms/templates/library");

    expect(handles).toContain(requireWebAuth);
    expect(usesOrgPermissions(handles)).toBe(true);
    expect(usesRequirePermission(handles)).toBe(true);
  });
});
