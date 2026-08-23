import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const withPractitionerRoleMiddleware = jest.fn((_req, _res, next) => next());
const withUserOrganizationMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const UserOrganizationController = {
  upsertMapping: jest.fn(),
  listMappingsForUser: jest.fn(),
  listByOrganisationId: jest.fn(),
  getMappingById: jest.fn(),
  listMappings: jest.fn(),
  deleteMappingById: jest.fn(),
  updateMappingById: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  withPractitionerRoleOrgPermissions: () => withPractitionerRoleMiddleware,
  withUserOrganizationOrgPermissions: () => withUserOrganizationMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/controllers/web/user-organization.controller", () => ({
  UserOrganizationController,
}));

const userOrganizationRouter = jest.requireActual(
  "../../src/routers/user-organization.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "put" | "delete") =>
  ((userOrganizationRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("user-organization.router", () => {
  it("requires auth for all exposed routes", () => {
    expect(
      findRoute("/user/mapping", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([requireWebAuth, UserOrganizationController.listMappingsForUser]);
    expect(findRoute("/", "get")?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      UserOrganizationController.listMappings,
    ]);
  });

  // A role mapping IS organisation access, so creating or editing one has to
  // clear the same `teams:edit:any` bar as every other team-management action.
  // Membership alone previously sufficed, which let any member of an org mint
  // themselves an OWNER mapping in it.
  it("gates mapping writes on team-edit permission in the target organisation", () => {
    expect(findRoute("/", "post")?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      withPractitionerRoleMiddleware,
      requirePermissionMiddleware,
      UserOrganizationController.upsertMapping,
    ]);
    expect(
      findRoute("/:id", "put")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      withUserOrganizationMiddleware,
      requirePermissionMiddleware,
      UserOrganizationController.updateMappingById,
    ]);
    expect(
      findRoute("/:id", "delete")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      withUserOrganizationMiddleware,
      requirePermissionMiddleware,
      UserOrganizationController.deleteMappingById,
    ]);
  });

  it("scopes mapping reads to the organisation the mapping belongs to", () => {
    expect(
      findRoute("/org/mapping/:organisationId", "get")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      UserOrganizationController.listByOrganisationId,
    ]);
    expect(
      findRoute("/:id", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      withUserOrganizationMiddleware,
      requirePermissionMiddleware,
      UserOrganizationController.getMappingById,
    ]);
  });
});
