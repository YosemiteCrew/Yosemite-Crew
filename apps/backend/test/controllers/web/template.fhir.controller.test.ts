import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { TemplateFhirController } from "src/controllers/web/template.fhir.controller";
import { TemplateService } from "src/services/template.service";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({ prisma: {} }));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Only the service layer is faked: the real FHIR template mapper runs so these
// tests assert on the emitted Questionnaire / PlanDefinition / Bundle shapes,
// and the real TemplateServiceError drives the error-to-status mapping.
jest.mock("src/services/template.service", () => {
  const actual = jest.requireActual(
    "src/services/template.service",
  ) as typeof import("src/services/template.service");

  return {
    ...actual,
    TemplateService: {
      listLibrary: jest.fn(),
      listForOrganisation: jest.fn(),
      listForUser: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      archive: jest.fn(),
      createInstance: jest.fn(),
      updateInstance: jest.fn(),
      submitInstance: jest.fn(),
    },
  };
});

const { TemplateServiceError } = jest.requireActual(
  "src/services/template.service",
) as typeof import("src/services/template.service");

type ServiceMock = jest.Mock<(...args: unknown[]) => unknown> & {
  mockResolvedValue: (value: unknown) => ServiceMock;
  mockRejectedValue: (value: unknown) => ServiceMock;
};

const mockedService = TemplateService as unknown as Record<string, ServiceMock>;
const mockedLogger = logger as unknown as { error: jest.Mock };

const SD = "https://yosemitecrew.com/fhir/StructureDefinition";
const TEMPLATE_KIND_URL = `${SD}/template-kind`;
const INSTANCE_APPOINTMENT_URL = `${SD}/template-instance-appointment`;
const INSTANCE_CASE_URL = `${SD}/template-instance-case`;
const INSTANCE_ENCOUNTER_URL = `${SD}/template-instance-encounter`;
const RESPONSE_SUBMITTED_BY_URL = `${SD}/form-response-submitted-by`;

const templateRow = (overrides: Record<string, unknown> = {}) => ({
  id: "template-1",
  organisationId: "org-1",
  ownerUserId: null,
  ownership: "ORG_TEMPLATE",
  kind: "FORM",
  name: "Intake Form",
  description: "Intake questions",
  status: "DRAFT",
  scope: "ORGANISATION",
  rules: null,
  latestVersion: 2,
  publishedVersion: null,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  versions: [
    {
      id: "version-2",
      version: 2,
      schemaSnapshot: {
        sections: [
          {
            id: "section-1",
            title: "Basics",
            fields: [{ key: "weight", label: "Weight", type: "number" }],
          },
        ],
      },
    },
  ],
  ...overrides,
});

const instanceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "instance-1",
  templateId: "template-1",
  templateVersion: 2,
  organisationId: "org-1",
  appointmentId: null,
  caseId: null,
  encounterId: null,
  status: "IN_PROGRESS",
  data: { weight: 12 },
  authorId: "user-1",
  signedBy: null,
  signedAt: null,
  generatedPdfUrl: null,
  generatedPdf: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

const questionnaireBody = (overrides: Record<string, unknown> = {}) => ({
  resourceType: "Questionnaire",
  status: "draft",
  title: "Intake Form",
  description: "Intake questions",
  item: [{ linkId: "weight", text: "Weight", type: "decimal" }],
  ...overrides,
});

const planDefinitionBody = (overrides: Record<string, unknown> = {}) => ({
  resourceType: "PlanDefinition",
  status: "draft",
  title: "Discharge workflow",
  description: "Post-op tasks",
  action: [{ id: "section-1", title: "Day 1" }],
  ...overrides,
});

const responseBody = (overrides: Record<string, unknown> = {}) => ({
  resourceType: "QuestionnaireResponse",
  status: "in-progress",
  questionnaire: "Questionnaire/template-1",
  item: [{ linkId: "weight", answer: [{ valueDecimal: 12 }] }],
  ...overrides,
});

describe("TemplateFhirController", () => {
  let req: Partial<Request> & { userId?: string };
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    req = { params: {}, query: {}, body: {}, headers: {} };
  });

  const emitted = () =>
    jsonMock.mock.calls[0][0] as Record<string, unknown> & {
      entry: Array<{ resource: Record<string, unknown> }>;
    };

  describe("questionnaire listings", () => {
    it("bundles only questionnaire-shaped templates from the library", async () => {
      req.query = { kind: "FORM", status: "DRAFT", scope: "ORGANISATION" };
      mockedService.listLibrary.mockResolvedValue([
        templateRow(),
        templateRow({ id: "template-2", kind: "TASK_ASSIGNMENT" }),
      ]);

      await TemplateFhirController.listQuestionnaires(req as Request, res);

      expect(mockedService.listLibrary).toHaveBeenCalledWith({
        kind: "FORM",
        status: "DRAFT",
        scope: "ORGANISATION",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      const bundle = emitted();
      expect(bundle).toEqual(
        expect.objectContaining({
          resourceType: "Bundle",
          type: "searchset",
          total: 1,
        }),
      );
      expect(bundle.entry[0].resource.resourceType).toBe("Questionnaire");
      expect(bundle.entry[0].resource.id).toBe("template-1");
    });

    it("returns 400 when the list filters are invalid", async () => {
      req.query = { kind: "NOT_A_KIND" };

      await TemplateFhirController.listQuestionnaires(req as Request, res);

      expect(mockedService.listLibrary).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid FHIR payload.",
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "kind" }),
          ]),
        }),
      );
    });

    it("scopes an organisation listing to the route organisation", async () => {
      req.params = { organisationId: "org-5" };
      mockedService.listForOrganisation.mockResolvedValue([templateRow()]);

      await TemplateFhirController.listOrganisationQuestionnaires(
        req as Request,
        res,
      );

      expect(mockedService.listForOrganisation).toHaveBeenCalledWith(
        "org-5",
        {},
      );
      expect(emitted().total).toBe(1);
    });

    it("maps a service failure on an organisation listing to its status", async () => {
      req.params = { organisationId: "org-5" };
      mockedService.listForOrganisation.mockRejectedValue(
        new TemplateServiceError("Invalid organisation", 400),
      );

      await TemplateFhirController.listOrganisationQuestionnaires(
        req as Request,
        res,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid organisation",
      });
    });

    it("scopes a user listing to the verified session user", async () => {
      req.params = { organisationId: "org-5" };
      req.userId = "user-7";
      mockedService.listForUser.mockResolvedValue([templateRow()]);

      await TemplateFhirController.listUserQuestionnaires(req as Request, res);

      expect(mockedService.listForUser).toHaveBeenCalledWith(
        "org-5",
        "user-7",
        {},
      );
    });

    it("passes an empty user id when the request has no identity at all", async () => {
      req.params = { organisationId: "org-5" };
      mockedService.listForUser.mockResolvedValue([]);

      await TemplateFhirController.listUserQuestionnaires(req as Request, res);

      expect(mockedService.listForUser).toHaveBeenCalledWith("org-5", "", {});
      expect(emitted().total).toBe(0);
    });

    it("maps a failure on a user listing to its service status", async () => {
      req.params = { organisationId: "org-5" };
      req.userId = "user-7";
      mockedService.listForUser.mockRejectedValue(
        new TemplateServiceError("Invalid user", 400),
      );

      await TemplateFhirController.listUserQuestionnaires(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid user" });
    });
  });

  describe("createQuestionnaire", () => {
    it("creates a questionnaire template and echoes the FHIR resource", async () => {
      req.body = questionnaireBody();
      req.headers = { "x-user-id": "header-user" };
      mockedService.create.mockResolvedValue(templateRow());

      await TemplateFhirController.createQuestionnaire(req as Request, res);

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "FORM",
          name: "Intake Form",
          createdBy: "header-user",
          updatedBy: "header-user",
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(emitted()).toEqual(
        expect.objectContaining({
          resourceType: "Questionnaire",
          id: "template-1",
        }),
      );
    });

    it("rejects a workflow kind sent to the questionnaire route", async () => {
      req.body = questionnaireBody({
        extension: [{ url: TEMPLATE_KIND_URL, valueString: "TASK_ASSIGNMENT" }],
      });

      await TemplateFhirController.createQuestionnaire(req as Request, res);

      expect(mockedService.create).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message:
          "FHIR Questionnaire routes only support questionnaire-style template kinds",
      });
    });

    it("returns 400 when the body is not a Questionnaire", async () => {
      req.body = { resourceType: "Patient" };

      await TemplateFhirController.createQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid FHIR payload." }),
      );
    });

    it("returns 500 and logs when the service throws unexpectedly", async () => {
      req.body = questionnaireBody();
      mockedService.create.mockRejectedValue(new Error("db down"));

      await TemplateFhirController.createQuestionnaire(req as Request, res);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Unexpected FHIR template error",
        expect.any(Error),
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    });
  });

  describe("getQuestionnaire", () => {
    it("returns the questionnaire for a questionnaire-shaped template", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.getById.mockResolvedValue(templateRow());

      await TemplateFhirController.getQuestionnaire(req as Request, res);

      expect(mockedService.getById).toHaveBeenCalledWith("template-1", "org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().resourceType).toBe("Questionnaire");
    });

    it("404s when the template is a workflow template", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.getById.mockResolvedValue(
        templateRow({ kind: "TASK_ASSIGNMENT" }),
      );

      await TemplateFhirController.getQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Questionnaire not found",
      });
    });

    it("maps a missing template to its service status", async () => {
      req.params = { templateId: "missing", organisationId: "org-1" };
      mockedService.getById.mockRejectedValue(
        new TemplateServiceError("Template not found", 404),
      );

      await TemplateFhirController.getQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Template not found" });
    });
  });

  describe("updateQuestionnaire", () => {
    it("updates the template from the posted questionnaire", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-3";
      req.body = questionnaireBody({ title: "Updated Intake" });
      mockedService.update.mockResolvedValue(
        templateRow({ name: "Updated Intake" }),
      );

      await TemplateFhirController.updateQuestionnaire(req as Request, res);

      expect(mockedService.update).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({
          name: "Updated Intake",
          organisationId: "org-1",
          createdBy: "user-3",
          updatedBy: "user-3",
        }),
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().title).toBe("Updated Intake");
    });

    it("rejects an update that would change the template to a workflow kind", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = questionnaireBody({
        extension: [
          { url: TEMPLATE_KIND_URL, valueString: "INPATIENT_SCHEDULE" },
        ],
      });

      await TemplateFhirController.updateQuestionnaire(req as Request, res);

      expect(mockedService.update).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message:
          "FHIR Questionnaire routes only support questionnaire-style template kinds",
      });
    });
  });

  describe("publishQuestionnaire and archiveQuestionnaire", () => {
    it("publishes and returns the active questionnaire", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-4";
      mockedService.publish.mockResolvedValue(
        templateRow({ status: "PUBLISHED" }),
      );

      await TemplateFhirController.publishQuestionnaire(req as Request, res);

      expect(mockedService.publish).toHaveBeenCalledWith(
        "template-1",
        "user-4",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("active");
    });

    it("404s when publishing a template that is not questionnaire-shaped", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.publish.mockResolvedValue(
        templateRow({ kind: "TASK_ASSIGNMENT", status: "PUBLISHED" }),
      );

      await TemplateFhirController.publishQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Questionnaire not found",
      });
    });

    it("archives and returns the retired questionnaire", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-5";
      mockedService.archive.mockResolvedValue(
        templateRow({ status: "ARCHIVED" }),
      );

      await TemplateFhirController.archiveQuestionnaire(req as Request, res);

      expect(mockedService.archive).toHaveBeenCalledWith(
        "template-1",
        "user-5",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("retired");
    });

    it("404s when archiving a template that is not questionnaire-shaped", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.archive.mockResolvedValue(
        templateRow({ kind: "TASK_ASSIGNMENT", status: "ARCHIVED" }),
      );

      await TemplateFhirController.archiveQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("returns 500 when publishing blows up unexpectedly", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-4";
      mockedService.publish.mockRejectedValue(new Error("boom"));

      await TemplateFhirController.publishQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    });

    it("maps an archive conflict to its service status", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-5";
      mockedService.archive.mockRejectedValue(
        new TemplateServiceError("Template already archived", 409),
      );

      await TemplateFhirController.archiveQuestionnaire(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Template already archived",
      });
    });
  });

  describe("questionnaire instances", () => {
    it("creates an instance carrying the context extensions and response author", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "fallback-user";
      req.body = responseBody({
        extension: [
          { url: INSTANCE_APPOINTMENT_URL, valueString: "appt-1" },
          { url: INSTANCE_CASE_URL, valueString: "case-1" },
          { url: INSTANCE_ENCOUNTER_URL, valueString: "enc-1" },
          { url: RESPONSE_SUBMITTED_BY_URL, valueString: "author-1" },
        ],
      });
      mockedService.getById.mockResolvedValue(templateRow());
      mockedService.createInstance.mockResolvedValue(
        instanceRow({ appointmentId: "appt-1", authorId: "author-1" }),
      );

      await TemplateFhirController.createQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.createInstance).toHaveBeenCalledWith({
        templateId: "template-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: "case-1",
        encounterId: "enc-1",
        authorId: "author-1",
        data: { weight: 12 },
      });
      expect(mockedService.submitInstance).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(emitted()).toEqual(
        expect.objectContaining({
          resourceType: "QuestionnaireResponse",
          status: "in-progress",
        }),
      );
    });

    it("falls back to the session user and omits absent context ids", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "fallback-user";
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(templateRow());
      mockedService.createInstance.mockResolvedValue(instanceRow());

      await TemplateFhirController.createQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.createInstance).toHaveBeenCalledWith({
        templateId: "template-1",
        organisationId: "org-1",
        appointmentId: undefined,
        caseId: undefined,
        encounterId: undefined,
        authorId: "fallback-user",
        data: { weight: 12 },
      });
    });

    it("updates an existing instance and keeps the response status", async () => {
      req.params = {
        templateId: "template-1",
        organisationId: "org-1",
        instanceId: "instance-1",
      };
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(templateRow());
      mockedService.updateInstance.mockResolvedValue(instanceRow());

      await TemplateFhirController.updateQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.updateInstance).toHaveBeenCalledWith(
        "instance-1",
        { data: { weight: 12 }, status: "IN_PROGRESS" },
        "org-1",
      );
      expect(mockedService.createInstance).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("submits an instance without overwriting its status and reports it completed", async () => {
      req.params = {
        templateId: "template-1",
        organisationId: "org-1",
        instanceId: "instance-1",
      };
      req.userId = "user-6";
      req.body = responseBody({ status: "completed" });
      mockedService.getById.mockResolvedValue(templateRow());
      mockedService.updateInstance.mockResolvedValue(instanceRow());
      mockedService.submitInstance.mockResolvedValue(
        instanceRow({ status: "COMPLETED" }),
      );

      await TemplateFhirController.submitQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.updateInstance).toHaveBeenCalledWith(
        "instance-1",
        { data: { weight: 12 } },
        "org-1",
      );
      expect(mockedService.submitInstance).toHaveBeenCalledWith(
        "instance-1",
        "org-1",
        "user-6",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("completed");
    });

    it("submits with an empty submitter when the request carries no identity", async () => {
      req.params = {
        templateId: "template-1",
        organisationId: "org-1",
        instanceId: "instance-1",
      };
      req.body = responseBody({ status: "completed" });
      mockedService.getById.mockResolvedValue(templateRow());
      mockedService.updateInstance.mockResolvedValue(instanceRow());
      mockedService.submitInstance.mockResolvedValue(
        instanceRow({ status: "COMPLETED" }),
      );

      await TemplateFhirController.submitQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.submitInstance).toHaveBeenCalledWith(
        "instance-1",
        "org-1",
        "",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps a template lookup failure on instance creation to its status", async () => {
      req.params = { templateId: "missing", organisationId: "org-1" };
      req.body = responseBody();
      mockedService.getById.mockRejectedValue(
        new TemplateServiceError("Template not found", 404),
      );

      await TemplateFhirController.createQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Template not found" });
    });

    it("returns 400 when the instance body is not a QuestionnaireResponse", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { resourceType: "Observation" };

      await TemplateFhirController.updateQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.getById).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 400 when the submitted body is not a QuestionnaireResponse", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { resourceType: "Observation" };

      await TemplateFhirController.submitQuestionnaireInstance(
        req as Request,
        res,
      );

      expect(mockedService.submitInstance).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("plan definition listings", () => {
    const planRow = (overrides: Record<string, unknown> = {}) =>
      templateRow({
        id: "plan-1",
        kind: "TASK_ASSIGNMENT",
        name: "Discharge workflow",
        ...overrides,
      });

    it("bundles only workflow templates from the library", async () => {
      mockedService.listLibrary.mockResolvedValue([templateRow(), planRow()]);

      await TemplateFhirController.listPlanDefinitions(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      const bundle = emitted();
      expect(bundle.total).toBe(1);
      expect(bundle.entry[0].resource.resourceType).toBe("PlanDefinition");
      expect(bundle.entry[0].resource.id).toBe("plan-1");
    });

    it("returns 400 when the plan definition filters are invalid", async () => {
      req.query = { scope: "GALAXY" };

      await TemplateFhirController.listPlanDefinitions(req as Request, res);

      expect(mockedService.listLibrary).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("scopes an organisation plan definition listing to the route organisation", async () => {
      req.params = { organisationId: "org-3" };
      mockedService.listForOrganisation.mockResolvedValue([planRow()]);

      await TemplateFhirController.listOrganisationPlanDefinitions(
        req as Request,
        res,
      );

      expect(mockedService.listForOrganisation).toHaveBeenCalledWith(
        "org-3",
        {},
      );
      expect(emitted().total).toBe(1);
    });

    it("returns 500 when an organisation plan definition listing blows up", async () => {
      req.params = { organisationId: "org-3" };
      mockedService.listForOrganisation.mockRejectedValue(new Error("boom"));

      await TemplateFhirController.listOrganisationPlanDefinitions(
        req as Request,
        res,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("scopes a user plan definition listing to the acting user", async () => {
      req.params = { organisationId: "org-3" };
      req.headers = { "x-user-id": "header-user" };
      mockedService.listForUser.mockResolvedValue([planRow()]);

      await TemplateFhirController.listUserPlanDefinitions(req as Request, res);

      expect(mockedService.listForUser).toHaveBeenCalledWith(
        "org-3",
        "header-user",
        {},
      );
    });

    it("passes an empty user id when the plan definition request has no identity", async () => {
      req.params = { organisationId: "org-3" };
      mockedService.listForUser.mockResolvedValue([]);

      await TemplateFhirController.listUserPlanDefinitions(req as Request, res);

      expect(mockedService.listForUser).toHaveBeenCalledWith("org-3", "", {});
      expect(emitted().total).toBe(0);
    });

    it("returns 400 when the user plan definition filters are invalid", async () => {
      req.params = { organisationId: "org-3" };
      req.query = { status: "NOPE" };

      await TemplateFhirController.listUserPlanDefinitions(req as Request, res);

      expect(mockedService.listForUser).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("createPlanDefinition", () => {
    it("creates a workflow template and echoes the PlanDefinition", async () => {
      req.body = planDefinitionBody();
      req.userId = "user-10";
      mockedService.create.mockResolvedValue(
        templateRow({
          id: "plan-1",
          kind: "TASK_ASSIGNMENT",
          name: "Discharge workflow",
        }),
      );

      await TemplateFhirController.createPlanDefinition(req as Request, res);

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "TASK_ASSIGNMENT",
          name: "Discharge workflow",
          createdBy: "user-10",
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(emitted()).toEqual(
        expect.objectContaining({
          resourceType: "PlanDefinition",
          id: "plan-1",
        }),
      );
    });

    it("rejects a questionnaire kind sent to the plan definition route", async () => {
      req.body = planDefinitionBody({
        extension: [{ url: TEMPLATE_KIND_URL, valueString: "FORM" }],
      });

      await TemplateFhirController.createPlanDefinition(req as Request, res);

      expect(mockedService.create).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message:
          "FHIR PlanDefinition routes only support workflow template kinds",
      });
    });

    it("returns 400 when the body is not a PlanDefinition", async () => {
      req.body = { resourceType: "Questionnaire" };

      await TemplateFhirController.createPlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("getPlanDefinition", () => {
    it("returns the plan definition for a workflow template", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "INPATIENT_SCHEDULE" }),
      );

      await TemplateFhirController.getPlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().resourceType).toBe("PlanDefinition");
    });

    it("404s when the template is questionnaire-shaped", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.getById.mockResolvedValue(templateRow());

      await TemplateFhirController.getPlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "PlanDefinition not found",
      });
    });

    it("maps a missing workflow template to its service status", async () => {
      req.params = { templateId: "missing", organisationId: "org-1" };
      mockedService.getById.mockRejectedValue(
        new TemplateServiceError("Template not found", 404),
      );

      await TemplateFhirController.getPlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Template not found" });
    });
  });

  describe("updatePlanDefinition", () => {
    it("updates the workflow template from the posted resource", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.userId = "user-11";
      req.body = planDefinitionBody({ title: "Updated workflow" });
      mockedService.update.mockResolvedValue(
        templateRow({
          id: "plan-1",
          kind: "TASK_ASSIGNMENT",
          name: "Updated workflow",
        }),
      );

      await TemplateFhirController.updatePlanDefinition(req as Request, res);

      expect(mockedService.update).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          name: "Updated workflow",
          organisationId: "org-1",
          updatedBy: "user-11",
        }),
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().title).toBe("Updated workflow");
    });

    it("rejects an update that would change the template to a questionnaire kind", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.body = planDefinitionBody({
        extension: [{ url: TEMPLATE_KIND_URL, valueString: "CONSENT" }],
      });

      await TemplateFhirController.updatePlanDefinition(req as Request, res);

      expect(mockedService.update).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message:
          "FHIR PlanDefinition routes only support workflow template kinds",
      });
    });
  });

  describe("publishPlanDefinition and archivePlanDefinition", () => {
    it("publishes and returns the active plan definition", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.userId = "user-12";
      mockedService.publish.mockResolvedValue(
        templateRow({
          id: "plan-1",
          kind: "TASK_ASSIGNMENT",
          status: "PUBLISHED",
        }),
      );

      await TemplateFhirController.publishPlanDefinition(req as Request, res);

      expect(mockedService.publish).toHaveBeenCalledWith(
        "plan-1",
        "user-12",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("active");
    });

    it("404s when publishing a template that is not workflow-shaped", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.publish.mockResolvedValue(
        templateRow({ status: "PUBLISHED" }),
      );

      await TemplateFhirController.publishPlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "PlanDefinition not found",
      });
    });

    it("archives and returns the retired plan definition", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.userId = "user-13";
      mockedService.archive.mockResolvedValue(
        templateRow({
          id: "plan-1",
          kind: "TASK_ASSIGNMENT",
          status: "ARCHIVED",
        }),
      );

      await TemplateFhirController.archivePlanDefinition(req as Request, res);

      expect(mockedService.archive).toHaveBeenCalledWith(
        "plan-1",
        "user-13",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("retired");
    });

    it("404s when archiving a template that is not workflow-shaped", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.archive.mockResolvedValue(
        templateRow({ status: "ARCHIVED" }),
      );

      await TemplateFhirController.archivePlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("maps a publish failure on a workflow template to its service status", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.userId = "user-12";
      mockedService.publish.mockRejectedValue(
        new TemplateServiceError("Template has no draft version", 409),
      );

      await TemplateFhirController.publishPlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Template has no draft version",
      });
    });

    it("returns 500 when archiving a workflow template blows up unexpectedly", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.userId = "user-13";
      mockedService.archive.mockRejectedValue(new Error("boom"));

      await TemplateFhirController.archivePlanDefinition(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    });
  });

  describe("plan definition instances", () => {
    it("creates a workflow instance from a questionnaire response", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.userId = "user-14";
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "TASK_ASSIGNMENT" }),
      );
      mockedService.createInstance.mockResolvedValue(
        instanceRow({ templateId: "plan-1" }),
      );

      await TemplateFhirController.createPlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(mockedService.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "plan-1",
          organisationId: "org-1",
          authorId: "user-14",
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(emitted().resourceType).toBe("QuestionnaireResponse");
    });

    it("creates a workflow instance with an empty author when the request carries no identity", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "TASK_ASSIGNMENT" }),
      );
      mockedService.createInstance.mockResolvedValue(
        instanceRow({ templateId: "plan-1", authorId: null }),
      );

      await TemplateFhirController.createPlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(mockedService.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: "" }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 400 when the workflow instance body is invalid", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.body = { resourceType: "Patient" };

      await TemplateFhirController.createPlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(mockedService.getById).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("updates an existing workflow instance", async () => {
      req.params = {
        templateId: "plan-1",
        organisationId: "org-1",
        instanceId: "instance-9",
      };
      req.body = responseBody({ status: "stopped" });
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "TASK_ASSIGNMENT" }),
      );
      mockedService.updateInstance.mockResolvedValue(
        instanceRow({ id: "instance-9", templateId: "plan-1", status: "VOID" }),
      );

      await TemplateFhirController.updatePlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(mockedService.updateInstance).toHaveBeenCalledWith(
        "instance-9",
        { data: { weight: 12 }, status: "VOID" },
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("stopped");
    });

    it("returns 400 when the workflow instance update body is invalid", async () => {
      req.params = { templateId: "plan-1", organisationId: "org-1" };
      req.body = { resourceType: "Patient" };

      await TemplateFhirController.updatePlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("submits a workflow instance and reports it completed", async () => {
      req.params = {
        templateId: "plan-1",
        organisationId: "org-1",
        instanceId: "instance-9",
      };
      req.userId = "user-14";
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "TASK_ASSIGNMENT" }),
      );
      mockedService.updateInstance.mockResolvedValue(
        instanceRow({ id: "instance-9", templateId: "plan-1" }),
      );
      mockedService.submitInstance.mockResolvedValue(
        instanceRow({ id: "instance-9", status: "COMPLETED" }),
      );

      await TemplateFhirController.submitPlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(mockedService.updateInstance).toHaveBeenCalledWith(
        "instance-9",
        { data: { weight: 12 } },
        "org-1",
      );
      expect(mockedService.submitInstance).toHaveBeenCalledWith(
        "instance-9",
        "org-1",
        "user-14",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted().status).toBe("completed");
    });

    it("submits a workflow instance with an empty submitter when unauthenticated", async () => {
      req.params = {
        templateId: "plan-1",
        organisationId: "org-1",
        instanceId: "instance-9",
      };
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "TASK_ASSIGNMENT" }),
      );
      mockedService.updateInstance.mockResolvedValue(
        instanceRow({ id: "instance-9", templateId: "plan-1" }),
      );
      mockedService.submitInstance.mockResolvedValue(
        instanceRow({ id: "instance-9", status: "COMPLETED" }),
      );

      await TemplateFhirController.submitPlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(mockedService.submitInstance).toHaveBeenCalledWith(
        "instance-9",
        "org-1",
        "",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps a submit failure on a workflow instance to its status", async () => {
      req.params = {
        templateId: "plan-1",
        organisationId: "org-1",
        instanceId: "instance-9",
      };
      req.userId = "user-14";
      req.body = responseBody();
      mockedService.getById.mockResolvedValue(
        templateRow({ id: "plan-1", kind: "TASK_ASSIGNMENT" }),
      );
      mockedService.updateInstance.mockResolvedValue(
        instanceRow({ id: "instance-9", templateId: "plan-1" }),
      );
      mockedService.submitInstance.mockRejectedValue(
        new TemplateServiceError("Instance already submitted", 409),
      );

      await TemplateFhirController.submitPlanDefinitionInstance(
        req as Request,
        res,
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Instance already submitted",
      });
    });
  });
});
