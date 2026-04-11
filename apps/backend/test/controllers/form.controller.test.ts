import { FormController } from "../../src/controllers/web/form.controller";
import { FormService, FormServiceError } from "../../src/services/form.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import logger from "../../src/utils/logger";

// --- Global Mocks Setup (TDZ Safe) ---
jest.mock("../../src/services/form.service", () => {
  class MockFormServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "FormServiceError";
    }
  }

  return {
    __esModule: true,
    FormServiceError: MockFormServiceError,
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

jest.mock("../../src/services/authUserMobile.service", () => ({
  __esModule: true,
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("FormController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      userId: "auth_user_123", // By default authenticated via middleware
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
    };

    // Suppress console.error in tests to keep output clean for routes using it instead of logger
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Internal Helper (resolveUserIdFromRequest)", () => {
    it("should use x-user-id header if available", async () => {
      req.headers["x-user-id"] = "header_user_id";
      req.params.orgId = "org1";
      req.body = { title: "Test Form" };

      await FormController.createForm(req, res);

      expect(FormService.create).toHaveBeenCalledWith(
        "org1",
        req.body,
        "header_user_id",
      );
    });

    it("should fall back to authReq.userId if header is missing", async () => {
      req.params.orgId = "org1";
      req.body = { title: "Test Form" };

      await FormController.createForm(req, res);

      expect(FormService.create).toHaveBeenCalledWith(
        "org1",
        req.body,
        "auth_user_123",
      );
    });

    it("should return undefined if neither is present (triggers 401)", async () => {
      req.headers = {};
      req.userId = undefined;
      req.params.orgId = "org1";

      await FormController.createForm(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized: User ID missing",
      });
    });
  });

  describe("createForm", () => {
    it("should return 201 and the created form", async () => {
      req.params.orgId = "org1";
      req.body = { title: "New Form" };
      (FormService.create as jest.Mock).mockResolvedValue({ id: "form1" });

      await FormController.createForm(req, res);

      expect(FormService.create).toHaveBeenCalledWith(
        "org1",
        req.body,
        "auth_user_123",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "form1" });
    });

    it("should handle FormServiceError", async () => {
      req.params.orgId = "org1";
      (FormService.create as jest.Mock).mockRejectedValue(
        new FormServiceError("Bad Request", 400),
      );

      await FormController.createForm(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Bad Request" });
    });

    it("should handle generic errors", async () => {
      req.params.orgId = "org1";
      (FormService.create as jest.Mock).mockRejectedValue(
        new Error("Unknown DB Error"),
      );

      await FormController.createForm(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getFormForAdmin", () => {
    it("should return 200 and the form", async () => {
      req.params = { orgId: "org1", formId: "f1" };
      (FormService.getFormForAdmin as jest.Mock).mockResolvedValue({
        id: "f1",
      });

      await FormController.getFormForAdmin(req, res);

      expect(FormService.getFormForAdmin).toHaveBeenCalledWith("org1", "f1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "f1" });
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params = { orgId: "org1", formId: "f1" };

      (FormService.getFormForAdmin as jest.Mock).mockRejectedValue(
        new FormServiceError("Not Found", 404),
      );
      await FormController.getFormForAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.getFormForAdmin as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getFormForAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormListForOrganisation", () => {
    it("should return 200 and the form list", async () => {
      req.params.orgId = "org1";
      (FormService.listFormsForOrganisation as jest.Mock).mockResolvedValue([
        { id: "f1" },
      ]);

      await FormController.getFormListForOrganisation(req, res);

      expect(FormService.listFormsForOrganisation).toHaveBeenCalledWith("org1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "f1" }]);
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params.orgId = "org1";

      (FormService.listFormsForOrganisation as jest.Mock).mockRejectedValue(
        new FormServiceError("Bad Request", 400),
      );
      await FormController.getFormListForOrganisation(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (FormService.listFormsForOrganisation as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getFormListForOrganisation(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormForClient", () => {
    it("should return 200 and the form", async () => {
      req.params.formId = "f1";
      (FormService.getFormForUser as jest.Mock).mockResolvedValue({ id: "f1" });

      await FormController.getFormForClient(req, res);

      expect(FormService.getFormForUser).toHaveBeenCalledWith("f1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params.formId = "f1";

      (FormService.getFormForUser as jest.Mock).mockRejectedValue(
        new FormServiceError("Not Found", 404),
      );
      await FormController.getFormForClient(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.getFormForUser as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getFormForClient(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateForm", () => {
    it("should return 401 if user ID is missing", async () => {
      req.userId = null;
      await FormController.updateForm(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 200 and update the form", async () => {
      req.params = { formId: "f1", orgId: "org1" };
      req.body = { title: "Updated" };
      (FormService.update as jest.Mock).mockResolvedValue({
        id: "f1",
        title: "Updated",
      });

      await FormController.updateForm(req, res);

      expect(FormService.update).toHaveBeenCalledWith(
        "f1",
        req.body,
        "auth_user_123",
        "org1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params = { formId: "f1", orgId: "org1" };

      (FormService.update as jest.Mock).mockRejectedValue(
        new FormServiceError("Denied", 403),
      );
      await FormController.updateForm(req, res);
      expect(res.status).toHaveBeenCalledWith(403);

      (FormService.update as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.updateForm(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("publishForm", () => {
    it("should return 401 if user ID is missing", async () => {
      req.userId = null;
      await FormController.publishForm(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 200 and publish the form", async () => {
      req.params.formId = "f1";
      (FormService.publish as jest.Mock).mockResolvedValue({
        id: "f1",
        status: "PUBLISHED",
      });

      await FormController.publishForm(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      req.params.formId = "f1";

      (FormService.publish as jest.Mock).mockRejectedValue(
        new FormServiceError("Error", 400),
      );
      await FormController.publishForm(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (FormService.publish as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.publishForm(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("unpublishForm", () => {
    it("should return 401 if user ID is missing", async () => {
      req.userId = null;
      await FormController.unpublishForm(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 200 and unpublish the form", async () => {
      req.params.formId = "f1";
      (FormService.unpublish as jest.Mock).mockResolvedValue({
        id: "f1",
        status: "DRAFT",
      });

      await FormController.unpublishForm(req, res);

      expect(FormService.unpublish).toHaveBeenCalledWith("f1", "auth_user_123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      req.params.formId = "f1";

      (FormService.unpublish as jest.Mock).mockRejectedValue(
        new FormServiceError("Error", 400),
      );
      await FormController.unpublishForm(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (FormService.unpublish as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.unpublishForm(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("archiveForm", () => {
    it("should return 401 if user ID is missing", async () => {
      req.userId = null;
      await FormController.archiveForm(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 200 and archive the form", async () => {
      req.params.formId = "f1";
      (FormService.archive as jest.Mock).mockResolvedValue({
        id: "f1",
        status: "ARCHIVED",
      });

      await FormController.archiveForm(req, res);

      expect(FormService.archive).toHaveBeenCalledWith("f1", "auth_user_123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      req.params.formId = "f1";

      (FormService.archive as jest.Mock).mockRejectedValue(
        new FormServiceError("Error", 404),
      );
      await FormController.archiveForm(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.archive as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.archiveForm(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("submitForm", () => {
    it("should return 401 if AuthUser is not found in database", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue(null);

      await FormController.submitForm(req, res);

      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "auth_user_123",
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized: User not found",
      });
    });

    it("should return 201 on successful submission", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ id: "u1" });
      req.body = { answers: {} };
      (FormService.submitFHIR as jest.Mock).mockResolvedValue({ id: "sub1" });

      await FormController.submitForm(req, res);

      expect(FormService.submitFHIR).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "sub1" });
    });

    it("should handle FormServiceError and generic errors", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ id: "u1" });

      (FormService.submitFHIR as jest.Mock).mockRejectedValue(
        new FormServiceError("Error", 400),
      );
      await FormController.submitForm(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (FormService.submitFHIR as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.submitForm(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("submitFormFromPMS", () => {
    it("should return 201 on successful submission", async () => {
      req.body = { answers: {} };
      (FormService.submitFHIR as jest.Mock).mockResolvedValue({ id: "sub1" });

      await FormController.submitFormFromPMS(req, res);

      expect(FormService.submitFHIR).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "sub1" });
    });

    it("should handle FormServiceError and generic errors", async () => {
      (FormService.submitFHIR as jest.Mock).mockRejectedValue(
        new FormServiceError("Error", 400),
      );
      await FormController.submitFormFromPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (FormService.submitFHIR as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.submitFormFromPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormSubmissions", () => {
    it("should return 200 and the submission", async () => {
      req.params.formId = "sub1"; // Note: Parameter is named formId but used as submissionId in code
      (FormService.getSubmission as jest.Mock).mockResolvedValue({
        id: "sub1",
      });

      await FormController.getFormSubmissions(req, res);

      expect(FormService.getSubmission).toHaveBeenCalledWith("sub1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      (FormService.getSubmission as jest.Mock).mockRejectedValue(
        new FormServiceError("Not Found", 404),
      );
      await FormController.getFormSubmissions(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.getSubmission as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getFormSubmissions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listFormSubmissions", () => {
    it("should return 200 and the submissions list", async () => {
      req.params.formId = "f1";
      (FormService.listSubmissions as jest.Mock).mockResolvedValue([
        { id: "sub1" },
      ]);

      await FormController.listFormSubmissions(req, res);

      expect(FormService.listSubmissions).toHaveBeenCalledWith("f1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      (FormService.listSubmissions as jest.Mock).mockRejectedValue(
        new FormServiceError("Bad Request", 400),
      );
      await FormController.listFormSubmissions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (FormService.listSubmissions as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.listFormSubmissions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getSOAPNotesByAppointment", () => {
    it("should correctly parse latestOnly boolean and string values", async () => {
      req.params.appointmentId = "a1";

      // Test string "true"
      req.body = { latestOnly: "true" };
      (FormService.getSOAPNotesByAppointment as jest.Mock).mockResolvedValue(
        [],
      );
      await FormController.getSOAPNotesByAppointment(req, res);
      expect(FormService.getSOAPNotesByAppointment).toHaveBeenCalledWith("a1", {
        latestOnly: true,
      });

      // Test boolean true
      req.body = { latestOnly: true };
      await FormController.getSOAPNotesByAppointment(req, res);
      expect(FormService.getSOAPNotesByAppointment).toHaveBeenCalledWith("a1", {
        latestOnly: true,
      });

      // Test falsy / missing
      req.body = {};
      await FormController.getSOAPNotesByAppointment(req, res);
      expect(FormService.getSOAPNotesByAppointment).toHaveBeenCalledWith("a1", {
        latestOnly: false,
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params.appointmentId = "a1";

      (FormService.getSOAPNotesByAppointment as jest.Mock).mockRejectedValue(
        new FormServiceError("Not found", 404),
      );
      await FormController.getSOAPNotesByAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.getSOAPNotesByAppointment as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getSOAPNotesByAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getConsentFormForParent", () => {
    it("should parse string species and call service correctly", async () => {
      req.params = { organizationId: "org1", serivceId: "s1" }; // Typo in params matches controller
      req.query = { species: "DOG" };
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue({
        id: "form1",
      });

      await FormController.getConsentFormForParent(req, res);

      expect(FormService.getConsentFormForParent).toHaveBeenCalledWith("org1", {
        serviceId: "s1",
        species: "DOG",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should pass undefined for species if not string", async () => {
      req.params = { organizationId: "org1", serivceId: "s1" };
      req.query = { species: ["Array"] };

      await FormController.getConsentFormForParent(req, res);
      expect(FormService.getConsentFormForParent).toHaveBeenCalledWith("org1", {
        serviceId: "s1",
        species: undefined,
      });
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params = { organizationId: "org1", serivceId: "s1" };

      (FormService.getConsentFormForParent as jest.Mock).mockRejectedValue(
        new FormServiceError("Not found", 404),
      );
      await FormController.getConsentFormForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.getConsentFormForParent as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getConsentFormForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getFormsForAppointment", () => {
    it("should return 400 if appointmentId is missing", async () => {
      await FormController.getFormsForAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "appointmentId is required",
      });
    });

    it("should parse body values and call service", async () => {
      req.params.appointmentId = "a1";
      req.body = { serviceId: "s1", species: "CAT", isPMS: "true" };
      (FormService.getFormsForAppointment as jest.Mock).mockResolvedValue([]);

      await FormController.getFormsForAppointment(req, res);

      expect(FormService.getFormsForAppointment).toHaveBeenCalledWith({
        appointmentId: "a1",
        serviceId: "s1",
        species: "CAT",
        isPMS: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle non-string / missing properties safely", async () => {
      req.params.appointmentId = "a1";
      req.body = { serviceId: 123, isPMS: false }; // Non-strings

      await FormController.getFormsForAppointment(req, res);

      expect(FormService.getFormsForAppointment).toHaveBeenCalledWith({
        appointmentId: "a1",
        serviceId: undefined,
        species: undefined,
        isPMS: undefined,
      });
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params.appointmentId = "a1";

      (FormService.getFormsForAppointment as jest.Mock).mockRejectedValue(
        new FormServiceError("Not found", 404),
      );
      await FormController.getFormsForAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.getFormsForAppointment as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getFormsForAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("getFormSubmissionPDF", () => {
    it("should return 400 if submissionId is missing or not a string", async () => {
      req.params.submissionId = undefined;
      await FormController.getFormSubmissionPDF(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.params.submissionId = { id: 123 };
      await FormController.getFormSubmissionPDF(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should set headers and send PDF buffer on success", async () => {
      req.params.submissionId = "sub1";
      const mockBuffer = Buffer.from("pdf-data");
      (FormService.generatePDFForSubmission as jest.Mock).mockResolvedValue(
        mockBuffer,
      );

      await FormController.getFormSubmissionPDF(req, res);

      expect(FormService.generatePDFForSubmission).toHaveBeenCalledWith("sub1");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="form_submission_sub1.pdf"',
      );
      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it("should handle FormServiceError and generic errors", async () => {
      req.params.submissionId = "sub1";

      (FormService.generatePDFForSubmission as jest.Mock).mockRejectedValue(
        new FormServiceError("Not found", 404),
      );
      await FormController.getFormSubmissionPDF(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (FormService.generatePDFForSubmission as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await FormController.getFormSubmissionPDF(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
