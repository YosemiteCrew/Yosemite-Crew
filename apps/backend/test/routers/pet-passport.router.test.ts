import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const PetPassportController = {
  issuePassport: jest.fn(),
  getPassport: jest.fn(),
  getApplePass: jest.fn(),
  getGooglePass: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("../../src/controllers/web/pet-passport.controller", () => ({
  PetPassportController,
}));

const router = jest.requireActual("../../src/routers/pet-passport.router")
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

const BASE = "/pms/organisation/:organisationId/companion/:patientId";

describe("pet-passport.router", () => {
  it("registers the passport issue route (post), org-guarded", () => {
    expect(findRoute(`${BASE}/issue`, "post")).toBeDefined();
    expect(findRoute(`${BASE}/issue`, "post")?.stack).toHaveLength(4);
  });

  it("registers the assembled passport route (get), org-guarded", () => {
    expect(findRoute(`${BASE}/passport`, "get")).toBeDefined();
    expect(findRoute(`${BASE}/passport`, "get")?.stack).toHaveLength(4);
  });

  it("registers the Apple and Google Wallet routes (get), org-guarded", () => {
    expect(findRoute(`${BASE}/wallet/apple`, "get")?.stack).toHaveLength(4);
    expect(findRoute(`${BASE}/wallet/google`, "get")?.stack).toHaveLength(4);
  });

  it("guards issuance with passport:edit:any and reads with companions:view:any", () => {
    expect(requirePermission).toHaveBeenCalledWith("passport:edit:any");
    expect(requirePermission).toHaveBeenCalledWith("companions:view:any");
  });

  it("no longer exposes the legacy clinical-record write routes", () => {
    expect(findRoute(`${BASE}/vaccinations`, "post")).toBeUndefined();
    expect(findRoute(`${BASE}/treatments`, "post")).toBeUndefined();
    expect(findRoute(`${BASE}/titrations`, "post")).toBeUndefined();
  });
});
