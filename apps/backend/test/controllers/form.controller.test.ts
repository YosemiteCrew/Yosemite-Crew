import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
// IMPORTS: Up 2 levels if file is directly in test/controllers/
import { FormController } from "../../src/controllers/web/form.controller";
import { FormService } from "../../src/services/form.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import logger from "../../src/utils/logger";

// ----------------------------------------------------------------------
// 1. Mock Setup
// ----------------------------------------------------------------------
jest.mock("../../src/services/form.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../src/services/form.service",
  ) as unknown as any;
  return {
    ...actual,
    FormService: {
      create: jest.fn(),
      getFormForAdmin: jest.fn(),
      listFormsForOrganisation: jest.fn(),
      getFormForUser: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      archive: jest.fn(),
      submitFHIR: jest.fn(),
      getSubmission: jest.fn(),
      listSubmissions: jest.fn(),
      getSOAPNotesByAppointment: jest.fn(),
      getConsentFormForParent: jest.fn(),
      getFormsForAppointment: jest.fn(),
      generatePDFForSubmission: jest.fn(),
    },
  };
});

jest.mock("../../src/services/authUserMobile.service");
jest.mock("../../src/utils/logger");

// Retrieve the REAL Error class
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { FormServiceError } = jest.requireActual(
  "../../src/services/form.service",
) as unknown as any;

// ----------------------------------------------------------------------
// 2. Typed Mocks
// ----------------------------------------------------------------------
const mockedFormService = jest.mocked(FormService);
const mockedAuthMobileService = jest.mocked(AuthUserMobileService);
const mockedLogger = jest.mocked(logger);

describe("FormController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
      setHeader: setHeaderMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 3. Error Helpers (FIXED: Cast to ANY)
  // ----------------------------------------------------------------------
  const mockServiceError = (
    method: keyof typeof FormService,
    status = 400,
    msg = "Service Error",
  ) => {
    const error = new FormServiceError(msg, status);
    // FIX: Cast to 'any' to completely bypass strict TS 'never' checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFormService[method] as any).mockRejectedValue(error);
  };

  const mockGenericError = (method: keyof typeof FormService) => {
    // FIX: Cast to 'any'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFormService[method] as any).mockRejectedValue(new Error("Boom"));
  };

  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe("createForm", () => {
    it("should 401 if user not authenticated", async () => {
      await FormController.createForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { title: "New Form" };
      mockedFormService.create.mockResolvedValue({ id: "f1" } as any);

      await FormController.createForm(req as any, res as Response);

      expect(mockedFormService.create).toHaveBeenCalledWith(
        "o1",
        req.body,
        "u1",
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ id: "f1" });
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      mockServiceError("create", 400);
      await FormController.createForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      mockGenericError("create");
      await FormController.createForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormForAdmin", () => {
    it("should success (200)", async () => {
      req.params = { orgId: "o1", formId: "f1" };
      mockedFormService.getFormForAdmin.mockResolvedValue({} as any);

      await FormController.getFormForAdmin(req as any, res as Response);
      expect(mockedFormService.getFormForAdmin).toHaveBeenCalledWith(
        "o1",
        "f1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("getFormForAdmin", 404);
      await FormController.getFormForAdmin(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      mockGenericError("getFormForAdmin");
      await FormController.getFormForAdmin(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormListForOrganisation", () => {
    it("should success (200)", async () => {
      req.params = { orgId: "o1" };
      mockedFormService.listFormsForOrganisation.mockResolvedValue([] as any);

      await FormController.getFormListForOrganisation(
        req as any,
        res as Response,
      );
      expect(mockedFormService.listFormsForOrganisation).toHaveBeenCalledWith(
        "o1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("listFormsForOrganisation", 400);
      await FormController.getFormListForOrganisation(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      mockGenericError("listFormsForOrganisation");
      await FormController.getFormListForOrganisation(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormForClient", () => {
    it("should success (200)", async () => {
      req.params = { formId: "f1" };
      mockedFormService.getFormForUser.mockResolvedValue({} as any);

      await FormController.getFormForClient(req as any, res as Response);
      expect(mockedFormService.getFormForUser).toHaveBeenCalledWith("f1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("getFormForUser", 404);
      await FormController.getFormForClient(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      mockGenericError("getFormForUser");
      await FormController.getFormForClient(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateForm", () => {
    it("should 401 if not auth", async () => {
      await FormController.updateForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { formId: "f1", orgId: "o1" };
      req.body = { title: "Updated" };
      mockedFormService.update.mockResolvedValue({} as any);

      await FormController.updateForm(req as any, res as Response);
      expect(mockedFormService.update).toHaveBeenCalledWith(
        "f1",
        req.body,
        "u1",
        "o1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      mockServiceError("update", 400);
      await FormController.updateForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      mockGenericError("update");
      await FormController.updateForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("publishForm", () => {
    it("should 401 if not auth", async () => {
      await FormController.publishForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { formId: "f1" };
      mockedFormService.publish.mockResolvedValue({} as any);

      await FormController.publishForm(req as any, res as Response);
      expect(mockedFormService.publish).toHaveBeenCalledWith("f1", "u1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      mockServiceError("publish", 400);
      await FormController.publishForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      mockGenericError("publish");
      await FormController.publishForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("unpublishForm", () => {
    it("should 401 if not auth", async () => {
      await FormController.unpublishForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { formId: "f1" };
      mockedFormService.unpublish.mockResolvedValue({} as any);

      await FormController.unpublishForm(req as any, res as Response);
      expect(mockedFormService.unpublish).toHaveBeenCalledWith("f1", "u1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      mockServiceError("unpublish", 400);
      await FormController.unpublishForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      mockGenericError("unpublish");
      await FormController.unpublishForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("archiveForm", () => {
    it("should 401 if not auth", async () => {
      await FormController.archiveForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { formId: "f1" };
      mockedFormService.archive.mockResolvedValue({} as any);

      await FormController.archiveForm(req as any, res as Response);
      expect(mockedFormService.archive).toHaveBeenCalledWith("f1", "u1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      mockServiceError("archive", 400);
      await FormController.archiveForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      mockGenericError("archive");
      await FormController.archiveForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("submitForm", () => {
    it("should 401 if not auth in DB", async () => {
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue(null);

      await FormController.submitForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (201)", async () => {
      req.headers = { "x-user-id": "u1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({} as any);
      req.body = { questionnaireId: "q1" };
      mockedFormService.submitFHIR.mockResolvedValue({ id: "s1" } as any);

      await FormController.submitForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({} as any);
      mockServiceError("submitFHIR", 400);

      await FormController.submitForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({} as any);
      mockGenericError("submitFHIR");

      await FormController.submitForm(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("submitFormFromPMS", () => {
    it("should success (201)", async () => {
      req.body = { questionnaireId: "q1" };
      mockedFormService.submitFHIR.mockResolvedValue({ id: "s1" } as any);

      await FormController.submitFormFromPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      mockServiceError("submitFHIR", 400);
      await FormController.submitFormFromPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      mockGenericError("submitFHIR");
      await FormController.submitFormFromPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormSubmissions", () => {
    it("should success (200)", async () => {
      req.params = { formId: "f1" };
      mockedFormService.getSubmission.mockResolvedValue({} as any);

      await FormController.getFormSubmissions(req as any, res as Response);
      expect(mockedFormService.getSubmission).toHaveBeenCalledWith("f1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("getSubmission", 404);
      await FormController.getFormSubmissions(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      mockGenericError("getSubmission");
      await FormController.getFormSubmissions(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listFormSubmissions", () => {
    it("should success (200)", async () => {
      req.params = { formId: "f1" };
      mockedFormService.listSubmissions.mockResolvedValue([] as any);

      await FormController.listFormSubmissions(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("listSubmissions", 400);
      await FormController.listFormSubmissions(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      mockGenericError("listSubmissions");
      await FormController.listFormSubmissions(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getSOAPNotesByAppointment", () => {
    it("should success (200) with latestOnly true", async () => {
      req.params = { appointmentId: "a1" };
      req.query = { latestOnly: "true" };
      mockedFormService.getSOAPNotesByAppointment.mockResolvedValue([] as any);

      await FormController.getSOAPNotesByAppointment(
        req as any,
        res as Response,
      );
      expect(mockedFormService.getSOAPNotesByAppointment).toHaveBeenCalledWith(
        "a1",
        { latestOnly: true },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should success (200) with latestOnly false", async () => {
      req.params = { appointmentId: "a1" };
      req.query = { latestOnly: "false" };
      mockedFormService.getSOAPNotesByAppointment.mockResolvedValue([] as any);

      await FormController.getSOAPNotesByAppointment(
        req as any,
        res as Response,
      );
      expect(mockedFormService.getSOAPNotesByAppointment).toHaveBeenCalledWith(
        "a1",
        { latestOnly: false },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("getSOAPNotesByAppointment", 400);
      await FormController.getSOAPNotesByAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      mockGenericError("getSOAPNotesByAppointment");
      await FormController.getSOAPNotesByAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getConsentFormForParent", () => {
    it("should success (200) with all params", async () => {
      req.params = { organizationId: "o1", serivceId: "s1" };
      req.query = { species: "dog" };
      mockedFormService.getConsentFormForParent.mockResolvedValue([] as any);

      await FormController.getConsentFormForParent(req as any, res as Response);
      expect(mockedFormService.getConsentFormForParent).toHaveBeenCalledWith(
        "o1",
        { serviceId: "s1", species: "dog" },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should success (200) with undefined species", async () => {
      req.params = { organizationId: "o1", serivceId: "s1" };
      req.query = {};
      mockedFormService.getConsentFormForParent.mockResolvedValue([] as any);

      await FormController.getConsentFormForParent(req as any, res as Response);
      expect(mockedFormService.getConsentFormForParent).toHaveBeenCalledWith(
        "o1",
        { serviceId: "s1", species: undefined },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      mockServiceError("getConsentFormForParent", 400);
      await FormController.getConsentFormForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      mockGenericError("getConsentFormForParent");
      await FormController.getConsentFormForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormsForAppointment", () => {
    it("should 400 if appointmentId missing", async () => {
      req.params = {};
      await FormController.getFormsForAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200) with full params", async () => {
      req.params = { appointmentId: "a1" };
      req.query = { serviceId: "s1", species: "cat" };
      mockedFormService.getFormsForAppointment.mockResolvedValue([] as any);

      await FormController.getFormsForAppointment(req as any, res as Response);
      expect(mockedFormService.getFormsForAppointment).toHaveBeenCalledWith({
        appointmentId: "a1",
        serviceId: "s1",
        species: "cat",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should success (200) with minimal params", async () => {
      req.params = { appointmentId: "a1" };
      req.query = {};
      mockedFormService.getFormsForAppointment.mockResolvedValue([] as any);

      await FormController.getFormsForAppointment(req as any, res as Response);
      expect(mockedFormService.getFormsForAppointment).toHaveBeenCalledWith({
        appointmentId: "a1",
        serviceId: undefined,
        species: undefined,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { appointmentId: "a1" };
      mockServiceError("getFormsForAppointment", 400);
      await FormController.getFormsForAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { appointmentId: "a1" };
      mockGenericError("getFormsForAppointment");
      await FormController.getFormsForAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormSubmissionPDF", () => {
    it("should success (200)", async () => {
      req.params = { submissionId: "s1" };
      const buffer = Buffer.from("pdf");
      mockedFormService.generatePDFForSubmission.mockResolvedValue(buffer);

      await FormController.getFormSubmissionPDF(req as any, res as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringContaining("s1.pdf"),
      );
      expect(res.send).toHaveBeenCalledWith(buffer);
    });

    it("should handle service error", async () => {
      req.params = { submissionId: "s1" };
      mockServiceError("generatePDFForSubmission", 404);
      await FormController.getFormSubmissionPDF(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      req.params = { submissionId: "s1" };
      mockGenericError("generatePDFForSubmission");
      await FormController.getFormSubmissionPDF(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
