import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const BookingPageController = {
  getConfig: jest.fn(),
  saveConfig: jest.fn(),
  listRequests: jest.fn(),
  updateRequestStatus: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ requireWebAuth }));
jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));
jest.mock("../../src/controllers/web/booking-page.controller", () => ({
  BookingPageController,
}));

const router = jest.requireActual("../../src/routers/booking-page.router")
  .default as Router;

type Layer = {
  name?: string;
  handle?: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const layers = (): Layer[] =>
  (router as unknown as { stack: Layer[] }).stack ?? [];

const findRoute = (path: string, method: string) =>
  layers().find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("booking-page.router", () => {
  it("exposes exactly the configuration and request-queue routes", () => {
    const routes = layers()
      .filter((entry) => entry.route)
      .map((entry) => [
        entry.route?.path,
        Object.keys(entry.route?.methods ?? {}),
      ]);

    expect(routes).toEqual([
      ["/:organisationId", ["get"]],
      ["/:organisationId", ["put"]],
      ["/:organisationId/requests", ["get"]],
      ["/:organisationId/requests/:requestId", ["patch"]],
    ]);
  });

  it("gates the request queue on appointment permissions, not on the publishing one", () => {
    // Triaging a request into the diary is scheduling work. Requiring
    // `teams:edit:any` here would mean a receptionist needs the permission that
    // publishes the practice just to decline a request.
    expect(requirePermission).toHaveBeenCalledWith("appointments:view:any");
    expect(requirePermission).toHaveBeenCalledWith("appointments:edit:any");
  });

  it("derives the tenant through withOrgPermissions on every route", () => {
    expect(withOrgPermissions).toHaveBeenCalledTimes(4);
  });

  it("requires a web session before any route in the router", () => {
    // `router.use(requireWebAuth)` registers as a middleware layer with no
    // route, ahead of every route layer.
    const firstRouteIndex = layers().findIndex((entry) => Boolean(entry.route));
    const guards = layers()
      .slice(0, firstRouteIndex)
      .map((entry) => entry.handle);

    expect(guards).toContain(requireWebAuth);
  });

  it("gates reading the configuration on teams:view:any", () => {
    expect(findRoute("/:organisationId", "get")).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("teams:view:any");
  });

  it("gates publishing configuration on teams:edit:any, not a catalogue permission", () => {
    expect(findRoute("/:organisationId", "put")).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("teams:edit:any");
    expect(requirePermission).not.toHaveBeenCalledWith("specialities:edit:any");
  });
});
