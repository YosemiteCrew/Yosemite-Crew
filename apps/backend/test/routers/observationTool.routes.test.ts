import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());

const ObservationToolDefinitionController = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
};

const ObservationToolSubmissionController = {
  createFromMobile: jest.fn(),
  linkAppointment: jest.fn(),
  getPreviewByTaskId: jest.fn(),
  listForPms: jest.fn(),
  getById: jest.fn(),
  listForAppointment: jest.fn(),
  getByTaskId: jest.fn(),
  listTaskPreviewsForAppointment: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("../../src/controllers/web/observationTool.controller", () => ({
  ObservationToolDefinitionController,
  ObservationToolSubmissionController,
}));

const observationToolRouter = jest.requireActual(
  "../../src/routers/observationTool.routes",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (observationToolRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("observationTool.routes", () => {
  it("protects mobile list and submission routes plus PMS create with auth", () => {
    const mobileListRoute = findRoute("/mobile/tools", "get");
    const mobileSubmitRoute = findRoute(
      "/mobile/tools/:toolId/submissions",
      "post",
    );
    const pmsCreateRoute = findRoute("/pms/tools", "post");

    expect(mobileListRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognitoMobile,
    );
    expect(mobileSubmitRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognitoMobile,
    );
    expect(pmsCreateRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
  });
});
