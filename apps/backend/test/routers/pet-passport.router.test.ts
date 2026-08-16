import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const PetPassportController = {
  recordImmunization: jest.fn(),
  recordParasiteTreatment: jest.fn(),
  recordRabiesTitration: jest.fn(),
  recordClinicalExam: jest.fn(),
  signRecord: jest.fn(),
  attestRecord: jest.fn(),
  revokeRecord: jest.fn(),
  issuePassport: jest.fn(),
  getPassport: jest.fn(),
  getApplePass: jest.fn(),
  getGooglePass: jest.fn(),
  issuePublicToken: jest.fn(),
  revokePublicToken: jest.fn(),
};

const PassportConsentController = {
  requestConsent: jest.fn(),
  grantConsent: jest.fn(),
  revokeConsent: jest.fn(),
  listConsents: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("../../src/controllers/web/pet-passport.controller", () => ({
  PetPassportController,
}));
jest.mock("../../src/controllers/web/passport-consent.controller", () => ({
  PassportConsentController,
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

  it("registers the clinical-record capture routes (post), org-guarded", () => {
    expect(findRoute(`${BASE}/immunizations`, "post")?.stack).toHaveLength(4);
    expect(findRoute(`${BASE}/treatments`, "post")?.stack).toHaveLength(4);
    expect(findRoute(`${BASE}/titrations`, "post")?.stack).toHaveLength(4);
    expect(findRoute(`${BASE}/clinical-exams`, "post")?.stack).toHaveLength(4);
    expect(requirePermission).toHaveBeenCalledWith("vaccinations:edit:any");
  });

  it("registers the attest + revoke routes (post), org-guarded", () => {
    expect(
      findRoute(`${BASE}/records/:recordId/sign`, "post")?.stack,
    ).toHaveLength(4);
    expect(
      findRoute(`${BASE}/records/:recordId/attest`, "post")?.stack,
    ).toHaveLength(4);
    expect(
      findRoute(`${BASE}/records/:recordId/revoke`, "post")?.stack,
    ).toHaveLength(4);
  });

  it("registers the cross-practice consent routes, org-guarded", () => {
    const ORG = "/pms/organisation/:organisationId";
    expect(findRoute(`${BASE}/consents`, "post")?.stack).toHaveLength(4);
    expect(findRoute(`${ORG}/consents`, "get")?.stack).toHaveLength(4);
    expect(
      findRoute(`${ORG}/consents/:consentId/revoke`, "post")?.stack,
    ).toHaveLength(4);
  });

  it("grants consent through a pet-parent route, not a staff one", () => {
    const ORG = "/pms/organisation/:organisationId";
    const MOBILE = "/mobile/organisation/:organisationId";
    // A practice must never be able to authorise its own cross-practice access.
    expect(
      findRoute(`${ORG}/consents/:consentId/grant`, "post"),
    ).toBeUndefined();
    const grant = findRoute(`${MOBILE}/consents/:consentId/grant`, "post");
    expect(grant?.stack).toHaveLength(2);
    expect(grant?.stack.map((l) => l.handle)).toContain(requireMobileAuth);
    expect(grant?.stack.map((l) => l.handle)).not.toContain(requireWebAuth);
  });

  it("gates attestation behind the veterinarian-only permission", () => {
    // passport:edit:any is held by every staff role including RECEPTIONIST, so
    // signing must use the narrower passport:attest:any.
    expect(requirePermission).toHaveBeenCalledWith("passport:attest:any");
  });

  it("no longer exposes the legacy list (get) routes", () => {
    expect(findRoute(`${BASE}/vaccinations`, "get")).toBeUndefined();
    expect(findRoute(`${BASE}/titrations`, "get")).toBeUndefined();
  });
});
