import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());

const AdverseEventController = {
  createFromMobile: jest.fn(),
  getRegulatoryAuthorityInof: jest.fn(),
  listForOrg: jest.fn(),
  getById: jest.fn(),
  updateStatus: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: () => withOrgPermissionsMiddleware,
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
  it("requires auth + org permissions for org listing", () => {
    const route = findRoute("/organisation/:organisationId", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      withOrgPermissionsMiddleware,
      AdverseEventController.listForOrg,
    ]);
  });

  it("requires auth for reading and updating reports", () => {
    expect(
      findRoute("/:id", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([authorizeCognito, AdverseEventController.getById]);
    expect(
      findRoute("/:id/status", "patch")?.stack.map((layer) => layer.handle),
    ).toEqual([authorizeCognito, AdverseEventController.updateStatus]);
  });

  it("keeps the mobile report submission on mobile auth", () => {
    expect(findRoute("/", "post")?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognitoMobile,
      AdverseEventController.createFromMobile,
    ]);
  });
});
