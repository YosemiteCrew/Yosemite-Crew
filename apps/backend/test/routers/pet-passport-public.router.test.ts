import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));
const rateLimitMw = jest.fn((_req, _res, next) => next());
const getPublicPassport = jest.fn();

jest.mock("../../src/middlewares/auth", () => ({ authorizeCognito }));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("express-rate-limit", () => jest.fn(() => rateLimitMw));
jest.mock("../../src/controllers/web/pet-passport.controller", () => ({
  PetPassportController: { getPublicPassport },
}));

const router = jest.requireActual(
  "../../src/routers/pet-passport-public.router",
).default as Router;

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

const handlesFor = (path: string, method: string) =>
  findRoute(path, method)?.stack.map((layer) => layer.handle) ?? [];

describe("pet-passport-public.router", () => {
  it("exposes a public verification route", () => {
    expect(findRoute("/:patientId", "get")).toBeDefined();
  });

  it("is unauthenticated by design (no Cognito or RBAC middleware)", () => {
    expect(handlesFor("/:patientId", "get")).not.toContain(authorizeCognito);
    expect(authorizeCognito).not.toHaveBeenCalled();
    expect(withOrgPermissions).not.toHaveBeenCalled();
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("applies a dedicated rate limiter before the controller", () => {
    const handles = handlesFor("/:patientId", "get");
    expect(handles).toContain(rateLimitMw);
    expect(handles).toContain(getPublicPassport);
  });
});
