import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const reportOrgMiddleware = jest.fn((_req, _res, next) => next());
const viewPermission = jest.fn((_req, _res, next) => next());
const editPermission = jest.fn((_req, _res, next) => next());
const requirePermission = jest.fn((permission: string) =>
  permission === "companions:view:any" ? viewPermission : editPermission,
);
const companionGuard = jest.fn((_req, _res, next) => next());
const requireCompanionPermissionForResource = jest.fn(() => companionGuard);
const resolveAdverseEventCompanion = jest.fn();

const AdverseEventController = {
  createFromMobile: jest.fn(),
  getRegulatoryAuthorityInof: jest.fn(),
  listForOrg: jest.fn(),
  getById: jest.fn(),
  updateStatus: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
  withAdverseEventOrgPermissions: () => reportOrgMiddleware,
  requirePermission,
}));

jest.mock("../../src/middlewares/companion-access", () => ({
  requireCompanionPermissionForResource,
  resolveAdverseEventCompanion,
}));

jest.mock("../../src/controllers/web/adverse-event.controller", () => ({
  AdverseEventController,
}));

const adverseEventRouter = jest.requireActual(
  "../../src/routers/adverse-event.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "patch") =>
  ((adverseEventRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("adverse-event.router", () => {
  it("requires auth, org permissions and the view permission for org listing", () => {
    const route = findRoute("/organisation/:organisationId", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      viewPermission,
      AdverseEventController.listForOrg,
    ]);
  });

  it("scopes reading and updating a report to its organisation", () => {
    expect(
      findRoute("/:id", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      reportOrgMiddleware,
      viewPermission,
      AdverseEventController.getById,
    ]);
    expect(
      findRoute("/:id/status", "patch")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      reportOrgMiddleware,
      editPermission,
      AdverseEventController.updateStatus,
    ]);
  });

  it("checks the reporter may report on the companion the report names", () => {
    expect(findRoute("/", "post")?.stack.map((layer) => layer.handle)).toEqual([
      requireMobileAuth,
      companionGuard,
      AdverseEventController.createFromMobile,
    ]);
    expect(requireCompanionPermissionForResource).toHaveBeenCalledWith(
      "emergencyBasedPermissions",
      resolveAdverseEventCompanion,
    );
  });
});
