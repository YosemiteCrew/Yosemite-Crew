import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const PrescriptionController = {
  listDispenseRequests: jest.fn(),
  getDispenseRequest: jest.fn(),
  generateLabelPdf: jest.fn(),
  generateLabels: jest.fn(),
  finalize: jest.fn(),
  reserve: jest.fn(),
  notDispensed: jest.fn(),
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
        "/organisations/:organisationId/prescription-dispense-requests",
        "get",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisations/:organisationId/prescription-dispense-requests/:dispenseRequestId",
        "get",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$reserve`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$finalize`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$approve`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$not-dispensed`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$dispense`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$return`,
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        String.raw`/organisations/:organisationId/:prescriptionId/\$void-dispense`,
        "post",
      ),
    ).toBeDefined();
  });

  it("exposes the prescription label PDF route", () => {
    expect(
      findRoute(
        "/organisations/:organisationId/:prescriptionId/label.pdf",
        "get",
      ),
    ).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith(["prescription:view:any"]);
  });

  it("exposes the prescription label POST route for workspace-style PDF generation", () => {
    expect(
      findRoute(
        "/organisations/:organisationId/:prescriptionId/labels",
        "post",
      ),
    ).toBeDefined();
  });

  it("does not shadow the action routes with the label route", () => {
    const labelRoute = findRoute(
      "/organisations/:organisationId/:prescriptionId/label.pdf",
      "get",
    );
    const finalizeRoute = findRoute(
      String.raw`/organisations/:organisationId/:prescriptionId/\$finalize`,
      "post",
    );

    expect(labelRoute?.path).not.toBe(finalizeRoute?.path);
    expect(labelRoute?.methods?.get).toBe(true);
    expect(labelRoute?.methods?.post).toBeUndefined();
  });

  it("protects routes with auth and permission middleware", () => {
    const route = findRoute(
      String.raw`/organisations/:organisationId/:prescriptionId/\$finalize`,
      "post",
    );

    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith(["prescription:edit:any"]);
  });
});
