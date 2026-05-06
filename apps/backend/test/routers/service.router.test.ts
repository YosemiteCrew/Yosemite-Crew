import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());

const ServiceController = {
  createService: jest.fn(),
  createMany: jest.fn(),
  listOrganisationByServiceName: jest.fn(),
  listByOrganisation: jest.fn(),
  getBookableSlotsForService: jest.fn(),
  getCalendarPrefill: jest.fn(),
  getServiceById: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/controllers/web/service.controller", () => ({
  ServiceController,
}));

const serviceRouter = jest.requireActual("../../src/routers/service.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "post" | "patch" | "delete") => {
  const layer = (
    (serviceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("service.router", () => {
  it("requires Cognito auth for create service", () => {
    const route = findRoute("/", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      ServiceController.createService,
    ]);
  });

  it("requires Cognito auth for update service", () => {
    const route = findRoute("/:id", "patch");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      ServiceController.updateService,
    ]);
  });

  it("requires Cognito auth for delete service", () => {
    const route = findRoute("/:id", "delete");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      ServiceController.deleteService,
    ]);
  });
});
