import express from "express";
import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const attachSessionIfPresent = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const OrganizationController = {
  checkIsPMSOrganistaion: jest.fn(),
  getNearbyPaginated: jest.fn(),
  getLogoUploadUrl: jest.fn(),
  onboardBusiness: jest.fn(),
  getAllBusinesses: jest.fn(),
  getBusinessById: jest.fn(),
  updateBusinessById: jest.fn(),
  deleteBusinessById: jest.fn(),
};

const SpecialityController = {
  getAllByOrganizationId: jest.fn(),
};

const OrganisationInviteController = {
  createInvite: jest.fn(),
  listOrganisationInvites: jest.fn(),
};

const CatalogController = {
  getCatalogNearbyOrganisations: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
  attachSessionIfPresent,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/controllers/web/organization.controller", () => ({
  OrganizationController,
}));

jest.mock("../../src/controllers/web/speciality.controller", () => ({
  SpecialityController,
}));

jest.mock("../../src/controllers/web/organisation-invite.controller", () => ({
  OrganisationInviteController,
}));

jest.mock("../../src/controllers/web/catalog.controller", () => ({
  CatalogController,
}));

const organizationRouter = jest.requireActual(
  "../../src/routers/organization.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "put" | "delete") =>
  ((organizationRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("organization.router", () => {
  it("routes public nearby lookups to the catalog controller", () => {
    const route = findRoute("/mobile/getNearby", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireMobileAuth,
      CatalogController.getCatalogNearbyOrganisations,
    ]);
  });

  it("keeps the non-mobile nearby route public but session-aware", () => {
    const route = findRoute("/getNearby", "get");

    // `attachSessionIfPresent` never rejects, so the route stays reachable
    // signed-out; it exists so the saved-address fallback reads a VERIFIED
    // session instead of the `x-user-id` header.
    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      attachSessionIfPresent,
      OrganizationController.getNearbyPaginated,
    ]);
  });

  it("protects organization detail reads", () => {
    const route = findRoute("/:organizationId", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      OrganizationController.getBusinessById,
    ]);
  });

  it("protects org logo presigned upload URLs", () => {
    const route = findRoute("/logo/presigned-url/:orgId", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      OrganizationController.getLogoUploadUrl,
    ]);
  });

  it("never exposes a logo presigned upload route without authentication", () => {
    const routes = [
      findRoute("/logo/presigned-url", "post"),
      findRoute("/logo/presigned-url/:orgId", "post"),
    ];

    routes.forEach((route) => {
      const handlers = route?.stack.map((layer) => layer.handle) ?? [];
      expect(handlers[0]).toBe(requireWebAuth);
    });
  });
});
