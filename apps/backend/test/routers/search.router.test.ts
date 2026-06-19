import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const SearchController = {
  searchMedications: jest.fn(),
  searchInventoryItems: jest.fn(),
  searchTemplates: jest.fn(),
  searchTasks: jest.fn(),
  searchDocuments: jest.fn(),
  searchServices: jest.fn(),
  searchPackages: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/search.controller", () => ({
  SearchController,
}));

const router = jest.requireActual("../../src/routers/search.router")
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

describe("search.router", () => {
  it("exposes the scoped search routes", () => {
    expect(
      findRoute("/organisations/:organisationId/medications", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/inventory-items", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/templates", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/tasks", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/documents", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/services", "get"),
    ).toBeDefined();
    expect(
      findRoute("/organisations/:organisationId/packages", "get"),
    ).toBeDefined();
  });

  it("protects search routes with auth and permission middleware", () => {
    const route = findRoute(
      "/organisations/:organisationId/medications",
      "get",
    );

    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith([
      "inventory:view:any",
      "prescription:view:any",
    ]);
  });

  it("applies scoped permissions to the new search routes", () => {
    expect(requirePermission).toHaveBeenCalledWith("specialities:view:any");
    expect(requirePermission).toHaveBeenCalledWith("tasks:view:any");
    expect(requirePermission).toHaveBeenCalledWith("document:view:any");
  });
});
