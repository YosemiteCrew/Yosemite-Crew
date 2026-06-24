import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const requirePermissionMiddleware = jest.fn((_req, _res, next) => next());

const CompanionController = {
  createCompanionMobile: jest.fn(),
  getCompanionById: jest.fn(),
  updateCompanion: jest.fn(),
  deleteCompanion: jest.fn(),
  getProfileUploadUrl: jest.fn(),
  searchCompanionByName: jest.fn(),
  createCompanionPMS: jest.fn(),
  listParentCompanionsNotInOrganisation: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  requirePermission: () => requirePermissionMiddleware,
}));

jest.mock("../../src/controllers/app/companion.controller", () => ({
  CompanionController,
}));

const companionRouter = jest.requireActual("../../src/routers/companion.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "put" | "delete") =>
  ((companionRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("companion.router", () => {
  it("protects the PMS org route with auth", () => {
    const route = findRoute("/org/:id", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      CompanionController.getCompanionById,
    ]);
  });

  it("keeps the mobile routes on mobile auth", () => {
    expect(
      findRoute("/:id", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([authorizeCognitoMobile, CompanionController.getCompanionById]);
  });
});
