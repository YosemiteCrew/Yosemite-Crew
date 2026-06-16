import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const TemplateFhirController = {
  listQuestionnaires: jest.fn(),
  listOrganisationQuestionnaires: jest.fn(),
  listUserQuestionnaires: jest.fn(),
  createQuestionnaire: jest.fn(),
  getQuestionnaire: jest.fn(),
  updateQuestionnaire: jest.fn(),
  publishQuestionnaire: jest.fn(),
  archiveQuestionnaire: jest.fn(),
  createQuestionnaireInstance: jest.fn(),
  updateQuestionnaireInstance: jest.fn(),
  submitQuestionnaireInstance: jest.fn(),
  listPlanDefinitions: jest.fn(),
  listOrganisationPlanDefinitions: jest.fn(),
  listUserPlanDefinitions: jest.fn(),
  createPlanDefinition: jest.fn(),
  getPlanDefinition: jest.fn(),
  updatePlanDefinition: jest.fn(),
  publishPlanDefinition: jest.fn(),
  archivePlanDefinition: jest.fn(),
  createPlanDefinitionInstance: jest.fn(),
  updatePlanDefinitionInstance: jest.fn(),
  submitPlanDefinitionInstance: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/web/template.fhir.controller", () => ({
  TemplateFhirController,
}));

const router = jest.requireActual("../../src/routers/template.fhir.router")
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

describe("template.fhir.router", () => {
  it("exposes questionnaire and plan-definition routes", () => {
    expect(findRoute("/questionnaire/library", "get")).toBeDefined();
    expect(findRoute("/plan-definition/library", "get")).toBeDefined();
    expect(
      findRoute(
        "/questionnaire/organisation/:organisationId/:templateId",
        "get",
      ),
    ).toBeDefined();
    expect(
      findRoute(
        "/plan-definition/organisation/:organisationId/:templateId",
        "get",
      ),
    ).toBeDefined();
  });

  it("protects FHIR template routes with the expected middleware", () => {
    const route = findRoute(
      "/questionnaire/organisation/:organisationId",
      "get",
    );
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(route?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissions.mock.results[0].value,
    );
    expect(requirePermission).toHaveBeenCalledWith(["forms:view:any"]);
    expect(requirePermission).toHaveBeenCalledWith(["tasks:view:any"]);
  });
});
