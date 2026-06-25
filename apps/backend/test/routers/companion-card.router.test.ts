import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const CompanionCardController = {
  getCard: jest.fn(),
  issueShareToken: jest.fn(),
  listTokens: jest.fn(),
  revokeToken: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("../../src/controllers/web/companion-card.controller", () => ({
  CompanionCardController,
}));

const router = jest.requireActual("../../src/routers/companion-card.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) =>
  ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("companion-card.router", () => {
  it("guards the card render with companions:view:any", () => {
    expect(
      findRoute(
        "/pms/organisation/:organisationId/companion/:patientId/card",
        "get",
      ),
    ).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("companions:view:any");
  });

  it("guards share issue, list and revoke with companions:share:any", () => {
    expect(
      findRoute(
        "/pms/organisation/:organisationId/companion/:patientId/share",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/pms/organisation/:organisationId/companion/:patientId/shares",
        "get",
      ),
    ).toBeDefined();
    expect(
      findRoute("/pms/organisation/:organisationId/share/:tokenId", "delete"),
    ).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("companions:share:any");
  });

  it("requires Cognito auth on the card route", () => {
    const route = findRoute(
      "/pms/organisation/:organisationId/companion/:patientId/card",
      "get",
    );
    const handles = route?.stack.map((layer) => layer.handle) ?? [];
    expect(handles).toContain(authorizeCognito);
  });
});
