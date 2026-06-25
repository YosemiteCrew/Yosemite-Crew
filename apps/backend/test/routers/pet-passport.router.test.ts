import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const PetPassportController = {
  recordVaccination: jest.fn(),
  listVaccinations: jest.fn(),
  recordParasiteTreatment: jest.fn(),
  listParasiteTreatments: jest.fn(),
  recordRabiesTitration: jest.fn(),
  listRabiesTitrations: jest.fn(),
  getPassport: jest.fn(),
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

const VACC_PATH =
  "/pms/organisation/:organisationId/companion/:patientId/vaccinations";

describe("pet-passport.router", () => {
  it("registers record (post) and list (get) vaccination routes", () => {
    expect(findRoute(VACC_PATH, "post")).toBeDefined();
    expect(findRoute(VACC_PATH, "get")).toBeDefined();
  });

  it("guards recording with vaccinations:edit:any and listing with companions:view:any", () => {
    expect(requirePermission).toHaveBeenCalledWith("vaccinations:edit:any");
    expect(requirePermission).toHaveBeenCalledWith("companions:view:any");
  });

  it("applies cognito auth and org permissions on each route", () => {
    expect(findRoute(VACC_PATH, "post")?.stack).toHaveLength(4);
    expect(findRoute(VACC_PATH, "get")?.stack).toHaveLength(4);
  });

  it("registers the assembled passport route (get), org-guarded", () => {
    const passportPath =
      "/pms/organisation/:organisationId/companion/:patientId/passport";
    expect(findRoute(passportPath, "get")).toBeDefined();
    expect(findRoute(passportPath, "get")?.stack).toHaveLength(4);
  });

  it("registers treatment and titration record/list routes", () => {
    const treatments =
      "/pms/organisation/:organisationId/companion/:patientId/treatments";
    const titrations =
      "/pms/organisation/:organisationId/companion/:patientId/titrations";
    expect(findRoute(treatments, "post")).toBeDefined();
    expect(findRoute(treatments, "get")).toBeDefined();
    expect(findRoute(titrations, "post")).toBeDefined();
    expect(findRoute(titrations, "get")).toBeDefined();
  });

  it("guards treatment and titration writes with passport:edit:any", () => {
    expect(requirePermission).toHaveBeenCalledWith("passport:edit:any");
  });
});
