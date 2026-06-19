import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const PrescriptionController = {
  reserve: jest.fn(),
  dispense: jest.fn(),
  returnPrescription: jest.fn(),
  voidDispense: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/prescription.controller", () => ({
  PrescriptionController,
}));

const router = jest.requireActual("../../src/routers/prescription.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );
  return layer?.route;
};

describe("prescription.router", () => {
  it("exposes prescription action routes", () => {
    expect(
      findRoute(
        "/organisations/:organisationId/:prescriptionId/$reserve",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisations/:organisationId/:prescriptionId/$dispense",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisations/:organisationId/:prescriptionId/$return",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisations/:organisationId/:prescriptionId/$void-dispense",
        "post",
      ),
    ).toBeDefined();
  });

  it("protects routes with auth and permission middleware", () => {
    const route = findRoute(
      "/organisations/:organisationId/:prescriptionId/$dispense",
      "post",
    );

    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith([
      "prescription:edit:any",
      "inventory:edit:any",
    ]);
  });
});
