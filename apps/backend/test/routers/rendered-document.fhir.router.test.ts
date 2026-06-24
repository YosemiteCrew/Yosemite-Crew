import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const RenderedDocumentFhirController = {
  getRenderedDocument: jest.fn(),
  getRenderedDocumentPdf: jest.fn(),
  rerenderRenderedDocumentPdf: jest.fn(),
  signRenderedDocument: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock(
  "../../src/controllers/web/rendered-document.fhir.controller",
  () => ({
    RenderedDocumentFhirController,
  }),
);

const router = jest.requireActual(
  "../../src/routers/rendered-document.fhir.router",
).default as Router;

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

describe("rendered-document.fhir.router", () => {
  it("exposes read and sign routes", () => {
    expect(
      findRoute("/organisation/:organisationId/:renderedDocumentId", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisation/:organisationId/:renderedDocumentId/pdf", "get"),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisation/:organisationId/:renderedDocumentId/rerender-pdf",
        "post",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/organisation/:organisationId/:renderedDocumentId/sign",
        "post",
      ),
    ).toBeDefined();
  });

  it("protects routes with auth and RBAC", () => {
    const route = findRoute(
      "/organisation/:organisationId/:renderedDocumentId/pdf",
      "get",
    );

    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(withOrgPermissions).toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith([
      "forms:view:any",
      "prescription:view:any",
    ]);
    expect(route?.stack.length).toBeGreaterThanOrEqual(4);
  });

  it("protects the rerender route with auth and RBAC", () => {
    const route = findRoute(
      "/organisation/:organisationId/:renderedDocumentId/rerender-pdf",
      "post",
    );

    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(requirePermission).toHaveBeenCalledWith([
      "forms:edit:any",
      "prescription:edit:any",
    ]);
    expect(route?.stack.length).toBeGreaterThanOrEqual(4);
  });
});
