import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());

const UserOrganizationController = {
  upsertMapping: jest.fn(),
  listMappingsForUser: jest.fn(),
  listByOrganisationId: jest.fn(),
  getMappingById: jest.fn(),
  listMappings: jest.fn(),
  deleteMappingById: jest.fn(),
  updateMappingById: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/controllers/web/user-organization.controller", () => ({
  UserOrganizationController,
}));

const userOrganizationRouter = jest.requireActual(
  "../../src/routers/user-organization.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: "get" | "post" | "put" | "delete") =>
  ((userOrganizationRouter as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

describe("user-organization.router", () => {
  it("requires auth for all exposed routes", () => {
    expect(findRoute("/", "post")?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      UserOrganizationController.upsertMapping,
    ]);
    expect(
      findRoute("/user/mapping", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([
      authorizeCognito,
      UserOrganizationController.listMappingsForUser,
    ]);
    expect(
      findRoute("/org/mapping/:organisationId", "get")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toEqual([
      authorizeCognito,
      UserOrganizationController.listByOrganisationId,
    ]);
    expect(
      findRoute("/:id", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([authorizeCognito, UserOrganizationController.getMappingById]);
    expect(findRoute("/", "get")?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      UserOrganizationController.listMappings,
    ]);
    expect(
      findRoute("/:id", "delete")?.stack.map((layer) => layer.handle),
    ).toEqual([authorizeCognito, UserOrganizationController.deleteMappingById]);
    expect(
      findRoute("/:id", "put")?.stack.map((layer) => layer.handle),
    ).toEqual([authorizeCognito, UserOrganizationController.updateMappingById]);
  });
});
