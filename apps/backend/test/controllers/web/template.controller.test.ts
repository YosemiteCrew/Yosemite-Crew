import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { TemplateController } from "src/controllers/web/template.controller";
import { TemplateService } from "src/services/template.service";

jest.mock("src/config/prisma", () => ({ prisma: {} }));

// Only the service methods are faked. The real Zod schemas and the real
// TemplateServiceError stay in place so the controller's payload validation and
// its error-to-status mapping are exercised for real.
jest.mock("src/services/template.service", () => {
  const actual = jest.requireActual(
    "src/services/template.service",
  ) as typeof import("src/services/template.service");

  return {
    ...actual,
    TemplateService: {
      resolve: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      archive: jest.fn(),
      updateCatalogLinks: jest.fn(),
      listForOrganisation: jest.fn(),
      listLibrary: jest.fn(),
      listForUser: jest.fn(),
      getById: jest.fn(),
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

type TestRequest = Partial<Request> & { userId?: unknown };

describe("TemplateController", () => {
  let req: TestRequest;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let statusJsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusJsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: statusJsonMock });
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    req = { params: {}, query: {}, body: {}, headers: {} };
  });

  const templateRow = (overrides: Record<string, unknown> = {}) => ({
    id: "template-1",
    organisationId: "org-1",
    kind: "FORM",
    name: "Intake",
    status: "DRAFT",
    ...overrides,
  });

  describe("resolve", () => {
    it("resolves using the ownerUserId supplied on the query string", async () => {
      req.query = {
        organisationId: "org-1",
        kind: "SOAP_NOTE",
        ownerUserId: "explicit-user",
      };
      req.userId = "session-user";
      mockedService.resolve.mockResolvedValue({ templateId: "template-1" });

      await TemplateController.resolve(req as Request, res);

      expect(mockedService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          kind: "SOAP_NOTE",
          ownerUserId: "explicit-user",
        }),
      );
      expect(jsonMock).toHaveBeenCalledWith({ templateId: "template-1" });
    });

    it("falls back to the authenticated user when the query omits ownerUserId", async () => {
      req.query = { organisationId: "org-1", kind: "FORM" };
      req.userId = "session-user";
      mockedService.resolve.mockResolvedValue({ templateId: "template-2" });

      await TemplateController.resolve(req as Request, res);

      expect(mockedService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: "session-user" }),
      );
    });

    it("omits ownerUserId entirely for unauthenticated requests", async () => {
      req.query = { organisationId: "org-1", kind: "FORM" };
      req.userId = 42;
      mockedService.resolve.mockResolvedValue({ templateId: "template-3" });

      await TemplateController.resolve(req as Request, res);

      expect(mockedService.resolve).toHaveBeenCalledWith(
        expect.not.objectContaining({ ownerUserId: expect.anything() }),
      );
    });

    it("returns 400 with issue paths when the query fails validation", async () => {
      req.query = { organisationId: "org-1" };

      await TemplateController.resolve(req as Request, res);

      expect(mockedService.resolve).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(statusJsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid template payload.",
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "kind" }),
          ]),
        }),
      );
    });

    it("maps a TemplateServiceError to its own status code", async () => {
      req.query = { organisationId: "org-1", kind: "FORM" };
      req.userId = "session-user";
      mockedService.resolve.mockRejectedValue(
        new TemplateServiceError("No published template", 404),
      );

      await TemplateController.resolve(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "No published template",
      });
    });

    it("maps an unexpected error to 500", async () => {
      req.query = { organisationId: "org-1", kind: "FORM" };
      req.userId = "session-user";
      mockedService.resolve.mockRejectedValue(new Error("db down"));

      await TemplateController.resolve(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    });
  });

  describe("create", () => {
    const validBody = {
      organisationId: "org-1",
      kind: "FORM",
      name: "Intake",
      schemaSnapshot: { sections: [] },
    };

    it("stamps the authenticated user as creator and returns 201", async () => {
      req.body = validBody;
      req.userId = "user-1";
      mockedService.create.mockResolvedValue(templateRow());

      await TemplateController.create(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          name: "Intake",
          createdBy: "user-1",
          updatedBy: "user-1",
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(statusJsonMock).toHaveBeenCalledWith(templateRow());
    });

    it("rejects an unauthenticated create because createdBy is empty", async () => {
      req.body = validBody;

      await TemplateController.create(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(mockedService.create).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(statusJsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "createdBy" }),
          ]),
        }),
      );
    });

    it("treats a missing body as an empty payload", async () => {
      req.body = undefined;
      req.userId = "user-1";

      await TemplateController.create(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(mockedService.create).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(statusJsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid template payload." }),
      );
    });

    it("maps a service conflict to its status code", async () => {
      req.body = validBody;
      req.userId = "user-1";
      mockedService.create.mockRejectedValue(
        new TemplateServiceError("Template name already used", 409),
      );

      await TemplateController.create(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "Template name already used",
      });
    });
  });

  describe("update", () => {
    it("passes the template id, payload and organisation to the service", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { name: "Renamed" };
      req.userId = "user-2";
      mockedService.update.mockResolvedValue(templateRow({ name: "Renamed" }));

      await TemplateController.update(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "template-1",
        { name: "Renamed", updatedBy: "user-2" },
        "org-1",
      );
      expect(jsonMock).toHaveBeenCalledWith(templateRow({ name: "Renamed" }));
    });

    it("treats a missing body as an empty patch", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = undefined;
      req.userId = "user-2";
      mockedService.update.mockResolvedValue(templateRow());

      await TemplateController.update(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "template-1",
        { updatedBy: "user-2" },
        "org-1",
      );
    });

    it("returns 400 when the patch is invalid", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { status: "NOT_A_STATUS" };
      req.userId = "user-2";

      await TemplateController.update(
        req as Request<ParamsDictionary, unknown, unknown>,
        res,
      );

      expect(mockedService.update).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("publish and archive", () => {
    it("publishes with the acting user and organisation", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-3";
      mockedService.publish.mockResolvedValue(
        templateRow({ status: "PUBLISHED" }),
      );

      await TemplateController.publish(req as Request, res);

      expect(mockedService.publish).toHaveBeenCalledWith(
        "template-1",
        "user-3",
        "org-1",
      );
      expect(jsonMock).toHaveBeenCalledWith(
        templateRow({ status: "PUBLISHED" }),
      );
    });

    it("maps a publish failure to its service status", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-3";
      mockedService.publish.mockRejectedValue(
        new TemplateServiceError("Template not found", 404),
      );

      await TemplateController.publish(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "Template not found",
      });
    });

    it("archives with the acting user and organisation", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-4";
      mockedService.archive.mockResolvedValue(
        templateRow({ status: "ARCHIVED" }),
      );

      await TemplateController.archive(req as Request, res);

      expect(mockedService.archive).toHaveBeenCalledWith(
        "template-1",
        "user-4",
        "org-1",
      );
      expect(jsonMock).toHaveBeenCalledWith(
        templateRow({ status: "ARCHIVED" }),
      );
    });

    it("maps an archive failure to 500 for unexpected errors", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.userId = "user-4";
      mockedService.archive.mockRejectedValue(new Error("boom"));

      await TemplateController.archive(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateCatalogLinks", () => {
    it("forwards the parsed catalog item ids", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { catalogItemIds: ["item-1", "item-2"] };
      mockedService.updateCatalogLinks.mockResolvedValue(
        templateRow({ catalogItemIds: ["item-1", "item-2"] }),
      );

      await TemplateController.updateCatalogLinks(req as Request, res);

      expect(mockedService.updateCatalogLinks).toHaveBeenCalledWith(
        "template-1",
        { catalogItemIds: ["item-1", "item-2"] },
        "org-1",
      );
      expect(jsonMock).toHaveBeenCalled();
    });

    it("returns 400 when a catalog item id is blank", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { catalogItemIds: [""] };

      await TemplateController.updateCatalogLinks(req as Request, res);

      expect(mockedService.updateCatalogLinks).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(statusJsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "catalogItemIds.0" }),
          ]),
        }),
      );
    });
  });

  describe("list", () => {
    it("prefers the organisation route param", async () => {
      req.params = { organisationId: "org-param" };
      req.query = { organisationId: "org-query", kind: "FORM" };
      mockedService.listForOrganisation.mockResolvedValue([templateRow()]);

      await TemplateController.list(req as Request, res);

      expect(mockedService.listForOrganisation).toHaveBeenCalledWith(
        "org-param",
        { kind: "FORM" },
      );
      expect(jsonMock).toHaveBeenCalledWith([templateRow()]);
    });

    it("falls back to the organisation query parameter", async () => {
      req.query = { organisationId: "org-query", status: "PUBLISHED" };
      mockedService.listForOrganisation.mockResolvedValue([]);

      await TemplateController.list(req as Request, res);

      expect(mockedService.listForOrganisation).toHaveBeenCalledWith(
        "org-query",
        { status: "PUBLISHED" },
      );
    });

    it("falls back to an empty organisation when neither is present", async () => {
      req.query = { scope: "ORGANISATION", search: "  intake  " };
      mockedService.listForOrganisation.mockResolvedValue([]);

      await TemplateController.list(req as Request, res);

      expect(mockedService.listForOrganisation).toHaveBeenCalledWith("", {
        scope: "ORGANISATION",
        search: "intake",
      });
    });

    it("returns 400 for an unknown status filter", async () => {
      req.query = { status: "NOPE" };

      await TemplateController.list(req as Request, res);

      expect(mockedService.listForOrganisation).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("listLibrary", () => {
    it("returns library templates for the parsed filters", async () => {
      req.query = { kind: "CONSENT" };
      mockedService.listLibrary.mockResolvedValue([templateRow()]);

      await TemplateController.listLibrary(req as Request, res);

      expect(mockedService.listLibrary).toHaveBeenCalledWith({
        kind: "CONSENT",
      });
      expect(jsonMock).toHaveBeenCalledWith([templateRow()]);
    });

    it("returns 400 for an unknown kind filter", async () => {
      req.query = { kind: "NOT_A_KIND" };

      await TemplateController.listLibrary(req as Request, res);

      expect(mockedService.listLibrary).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("listOrganisationTemplates", () => {
    it("scopes the listing to the organisation route param", async () => {
      req.params = { organisationId: "org-9" };
      req.query = {};
      mockedService.listForOrganisation.mockResolvedValue([templateRow()]);

      await TemplateController.listOrganisationTemplates(req as Request, res);

      expect(mockedService.listForOrganisation).toHaveBeenCalledWith(
        "org-9",
        {},
      );
      expect(jsonMock).toHaveBeenCalledWith([templateRow()]);
    });

    it("maps a service error to its status code", async () => {
      req.params = { organisationId: "org-9" };
      mockedService.listForOrganisation.mockRejectedValue(
        new TemplateServiceError("Invalid organisation", 400),
      );

      await TemplateController.listOrganisationTemplates(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "Invalid organisation",
      });
    });
  });

  describe("listUserTemplates", () => {
    it("scopes the listing to the organisation and the acting user", async () => {
      req.params = { organisationId: "org-7" };
      req.userId = "user-7";
      mockedService.listForUser.mockResolvedValue([templateRow()]);

      await TemplateController.listUserTemplates(req as Request, res);

      expect(mockedService.listForUser).toHaveBeenCalledWith(
        "org-7",
        "user-7",
        {},
      );
    });

    it("passes an empty user id when the request is unauthenticated", async () => {
      req.params = { organisationId: "org-7" };
      mockedService.listForUser.mockResolvedValue([]);

      await TemplateController.listUserTemplates(req as Request, res);

      expect(mockedService.listForUser).toHaveBeenCalledWith("org-7", "", {});
    });

    it("returns 500 when the service throws unexpectedly", async () => {
      req.params = { organisationId: "org-7" };
      mockedService.listForUser.mockRejectedValue(new Error("boom"));

      await TemplateController.listUserTemplates(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getById", () => {
    it("returns the template scoped to the organisation", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      mockedService.getById.mockResolvedValue(templateRow());

      await TemplateController.getById(req as Request, res);

      expect(mockedService.getById).toHaveBeenCalledWith("template-1", "org-1");
      expect(jsonMock).toHaveBeenCalledWith(templateRow());
    });

    it("maps a not-found service error to 404", async () => {
      req.params = { templateId: "missing", organisationId: "org-1" };
      mockedService.getById.mockRejectedValue(
        new TemplateServiceError("Template not found", 404),
      );

      await TemplateController.getById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "Template not found",
      });
    });
  });

  describe("createInstance", () => {
    it("derives the template, organisation and author from the request", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { appointmentId: "appt-1", data: { weight: 12 } };
      req.userId = "user-8";
      mockedService.createInstance.mockResolvedValue({ id: "instance-1" });

      await TemplateController.createInstance(req as Request, res);

      expect(mockedService.createInstance).toHaveBeenCalledWith({
        appointmentId: "appt-1",
        data: { weight: 12 },
        templateId: "template-1",
        organisationId: "org-1",
        authorId: "user-8",
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(statusJsonMock).toHaveBeenCalledWith({ id: "instance-1" });
    });

    it("sends an undefined author for unauthenticated requests", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = {};
      mockedService.createInstance.mockResolvedValue({ id: "instance-2" });

      await TemplateController.createInstance(req as Request, res);

      expect(mockedService.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: undefined, data: {} }),
      );
    });

    it("returns 400 when the instance payload is invalid", async () => {
      req.params = { templateId: "template-1", organisationId: "org-1" };
      req.body = { appointmentId: "" };

      await TemplateController.createInstance(req as Request, res);

      expect(mockedService.createInstance).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("updateInstance", () => {
    it("updates the instance within the organisation", async () => {
      req.params = { instanceId: "instance-1", organisationId: "org-1" };
      req.body = { status: "COMPLETED" };
      mockedService.updateInstance.mockResolvedValue({
        id: "instance-1",
        status: "COMPLETED",
      });

      await TemplateController.updateInstance(req as Request, res);

      expect(mockedService.updateInstance).toHaveBeenCalledWith(
        "instance-1",
        { status: "COMPLETED" },
        "org-1",
      );
      expect(jsonMock).toHaveBeenCalledWith({
        id: "instance-1",
        status: "COMPLETED",
      });
    });

    it("returns 400 for an unknown instance status", async () => {
      req.params = { instanceId: "instance-1", organisationId: "org-1" };
      req.body = { status: "NOT_A_STATUS" };

      await TemplateController.updateInstance(req as Request, res);

      expect(mockedService.updateInstance).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("submitInstance", () => {
    it("submits with the acting user", async () => {
      req.params = { instanceId: "instance-1", organisationId: "org-1" };
      req.userId = "user-9";
      mockedService.submitInstance.mockResolvedValue({
        id: "instance-1",
        status: "COMPLETED",
      });

      await TemplateController.submitInstance(req as Request, res);

      expect(mockedService.submitInstance).toHaveBeenCalledWith(
        "instance-1",
        "org-1",
        "user-9",
      );
      expect(jsonMock).toHaveBeenCalledWith({
        id: "instance-1",
        status: "COMPLETED",
      });
    });

    it("maps a submit conflict to its service status", async () => {
      req.params = { instanceId: "instance-1", organisationId: "org-1" };
      req.userId = "user-9";
      mockedService.submitInstance.mockRejectedValue(
        new TemplateServiceError("Instance already submitted", 409),
      );

      await TemplateController.submitInstance(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(statusJsonMock).toHaveBeenCalledWith({
        message: "Instance already submitted",
      });
    });
  });
});
