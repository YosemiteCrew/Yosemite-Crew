import { Request, Response } from "express";
import { AppointmentController } from "../../src/controllers/web/appointment.controller";
import { AppointmentService } from "../../src/services/appointment.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { generatePresignedUrl } from "../../src/middlewares/upload";
import logger from "../../src/utils/logger";

// Mock Dependencies
jest.mock("../../src/services/appointment.service");
jest.mock("../../src/services/authUserMobile.service");
jest.mock("../../src/middlewares/upload");
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Helper to construct Express Request & Response mocks
const mockRequest = (overrides: Partial<Request | any> = {}): Request =>
  ({
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  } as unknown as Request);

const mockResponse = (): Response => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("AppointmentController", () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
  });

  describe("Internal Helper Coverage: resolveUserIdFromRequest & parseError", () => {
    it("resolves user id from headers if present", async () => {
      req = mockRequest({ headers: { "x-user-id": "header-user" } });
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue(null);

      await AppointmentController.rescheduleFromMobile(req as any, res as any);

      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith("header-user");
    });

    it("resolves user id from auth context if header missing", async () => {
      req = mockRequest({ userId: "auth-user" }); // Simulating AuthenticatedRequest
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue(null);

      await AppointmentController.rescheduleFromMobile(req as any, res as any);

      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith("auth-user");
    });

    it("parseError extracts custom status code and message", async () => {
      req = mockRequest();
      // Simulate an error object that has a statusCode property
      const customError = new Error("Custom error message") as any;
      customError.statusCode = 403;

      (AppointmentService.createRequestedFromMobile as jest.Mock).mockRejectedValue(customError);

      await AppointmentController.createRequestedFromMobile(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Custom error message" });
    });

    it("parseError falls back to 500 and fallback message for non-Error objects", async () => {
      req = mockRequest();
      (AppointmentService.createRequestedFromMobile as jest.Mock).mockRejectedValue("Plain string error");

      await AppointmentController.createRequestedFromMobile(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Failed to create appointment" });
    });
  });

  describe("createRequestedFromMobile", () => {
    it("returns 201 and data on success", async () => {
      req = mockRequest({ body: { some: "data" } });
      (AppointmentService.createRequestedFromMobile as jest.Mock).mockResolvedValue("created-data");

      await AppointmentController.createRequestedFromMobile(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Appointment created", data: "created-data" });
    });
  });

  describe("rescheduleFromMobile", () => {
    beforeEach(() => {
      req = mockRequest({
        headers: { "x-user-id": "user-123" },
        params: { appointmentId: "app-123" },
        body: { startTime: "2026-01-01", endTime: "2026-01-02" },
      });
    });

    it("returns 401 if user not authenticated", async () => {
      req = mockRequest(); // No headers, no userId
      await AppointmentController.rescheduleFromMobile(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 400 if parent info missing", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({}); // No parentId
      await AppointmentController.rescheduleFromMobile(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 if missing start or end time", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({ parentId: "parent-123" });
      req.body = { startTime: "2026-01-01" }; // missing end time

      await AppointmentController.rescheduleFromMobile(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 on successful reschedule", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({ parentId: "parent-123" });
      (AppointmentService.rescheduleFromParent as jest.Mock).mockResolvedValue("reschedule-data");

      await AppointmentController.rescheduleFromMobile(req as any, res as any);

      expect(AppointmentService.rescheduleFromParent).toHaveBeenCalledWith(
        "app-123",
        "parent-123",
        { startTime: "2026-01-01", endTime: "2026-01-02", concern: undefined, isEmergency: undefined }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("createFromPms", () => {
    it("handles createPayment=true string", async () => {
      req = mockRequest({ query: { createPayment: "true" } });
      (AppointmentService.createAppointmentFromPms as jest.Mock).mockResolvedValue("data");

      await AppointmentController.createFromPms(req as any, res as any);

      expect(AppointmentService.createAppointmentFromPms).toHaveBeenCalledWith(expect.any(Object), true);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("handles createPayment=1 string", async () => {
      req = mockRequest({ query: { createPayment: "1" } });
      await AppointmentController.createFromPms(req as any, res as any);
      expect(AppointmentService.createAppointmentFromPms).toHaveBeenCalledWith(expect.any(Object), true);
    });

    it("handles createPayment false/missing", async () => {
      req = mockRequest({ query: {} });
      await AppointmentController.createFromPms(req as any, res as any);
      expect(AppointmentService.createAppointmentFromPms).toHaveBeenCalledWith(expect.any(Object), false);
    });

    it("handles errors", async () => {
      req = mockRequest();
      (AppointmentService.createAppointmentFromPms as jest.Mock).mockRejectedValue(new Error("PMS Error"));
      await AppointmentController.createFromPms(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "PMS Error" });
    });
  });

  describe("acceptRequested", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { appointmentId: "app-123" }, body: { fhir: true } });
      (AppointmentService.approveRequestedFromPms as jest.Mock).mockResolvedValue("accepted");

      await AppointmentController.acceptRequested(req as any, res as any);

      expect(AppointmentService.approveRequestedFromPms).toHaveBeenCalledWith("app-123", { fhir: true });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.approveRequestedFromPms as jest.Mock).mockRejectedValue(new Error("Fail"));
      await AppointmentController.acceptRequested(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("rejectRequested", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { appointmentId: "app-123" } });
      (AppointmentService.rejectRequestedAppointment as jest.Mock).mockResolvedValue("rejected");

      await AppointmentController.rejectRequested(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.rejectRequestedAppointment as jest.Mock).mockRejectedValue(new Error("Fail"));
      await AppointmentController.rejectRequested(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("checkInAppointment", () => {
    beforeEach(() => {
      req = mockRequest({
        headers: { "x-user-id": "user-123" },
        params: { appointmentId: "app-123" },
      });
    });

    it("returns 401 if user not authenticated", async () => {
      req = mockRequest();
      await AppointmentController.checkInAppointment(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 400 if parent info missing", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({});
      await AppointmentController.checkInAppointment(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 on success", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({ parentId: "parent-123" });
      (AppointmentService.checkInAppointmentParent as jest.Mock).mockResolvedValue("checked-in");

      await AppointmentController.checkInAppointment(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({ parentId: "parent-123" });
      (AppointmentService.checkInAppointmentParent as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.checkInAppointment(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateFromPms", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { appointmentId: "123" }, body: { fhir: true } });
      (AppointmentService.updateAppointmentPMS as jest.Mock).mockResolvedValue("updated");

      await AppointmentController.updateFromPms(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.updateAppointmentPMS as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.updateFromPms(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("cancelFromMobile", () => {
    beforeEach(() => {
      req = mockRequest({
        headers: { "x-user-id": "user-123" },
        params: { appointmentId: "app-123" },
        body: { reason: "Sick" },
      });
    });

    it("returns 401 if user not authenticated", async () => {
      req = mockRequest();
      await AppointmentController.cancelFromMobile(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 400 if parent info missing", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({});
      await AppointmentController.cancelFromMobile(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 on success", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({ parentId: "parent-123" });
      (AppointmentService.cancelAppointmentFromParent as jest.Mock).mockResolvedValue("canceled");

      await AppointmentController.cancelFromMobile(req as any, res as any);
      expect(AppointmentService.cancelAppointmentFromParent).toHaveBeenCalledWith("app-123", "parent-123", "Sick");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({ parentId: "parent-123" });
      (AppointmentService.cancelAppointmentFromParent as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.cancelFromMobile(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("cancelFromPMS", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.cancelAppointment as jest.Mock).mockResolvedValue("canceled");

      await AppointmentController.cancelFromPMS(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.cancelAppointment as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.cancelFromPMS(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getById", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.getById as jest.Mock).mockResolvedValue("data");

      await AppointmentController.getById(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { appointmentId: "123" } });
      (AppointmentService.getById as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.getById(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listByCompanion", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { companionId: "123" } });
      (AppointmentService.getAppointmentsForCompanion as jest.Mock).mockResolvedValue(["data"]);

      await AppointmentController.listByCompanion(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { companionId: "123" } });
      (AppointmentService.getAppointmentsForCompanion as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.listByCompanion(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listByParent", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { parentId: "123" } });
      (AppointmentService.getAppointmentsForParent as jest.Mock).mockResolvedValue(["data"]);

      await AppointmentController.listByParent(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { parentId: "123" } });
      (AppointmentService.getAppointmentsForParent as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.listByParent(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listByOrganisation", () => {
    it("maps array status and string dates correctly", async () => {
      req = mockRequest({
        params: { organisationId: "org-1" },
        query: { status: ["PENDING", "ACTIVE"], startDate: "2026-01-01", endDate: "2026-01-02" },
      });
      (AppointmentService.getAppointmentsForOrganisation as jest.Mock).mockResolvedValue(["data"]);

      await AppointmentController.listByOrganisation(req as any, res as any);

      expect(AppointmentService.getAppointmentsForOrganisation).toHaveBeenCalledWith("org-1", {
        status: ["PENDING", "ACTIVE"],
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("maps comma-separated string status correctly", async () => {
      req = mockRequest({
        params: { organisationId: "org-1" },
        query: { status: "PENDING,ACTIVE" },
      });
      (AppointmentService.getAppointmentsForOrganisation as jest.Mock).mockResolvedValue(["data"]);

      await AppointmentController.listByOrganisation(req as any, res as any);

      expect(AppointmentService.getAppointmentsForOrganisation).toHaveBeenCalledWith("org-1", {
        status: ["PENDING", "ACTIVE"],
        startDate: undefined,
        endDate: undefined,
      });
    });

    it("handles missing query params correctly", async () => {
      req = mockRequest({ params: { organisationId: "org-1" }, query: {} });
      (AppointmentService.getAppointmentsForOrganisation as jest.Mock).mockResolvedValue(["data"]);

      await AppointmentController.listByOrganisation(req as any, res as any);

      expect(AppointmentService.getAppointmentsForOrganisation).toHaveBeenCalledWith("org-1", {
        status: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { organisationId: "org-1" }, query: {} });
      (AppointmentService.getAppointmentsForOrganisation as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.listByOrganisation(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listByLead", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { leadId: "123" } });
      (AppointmentService.getAppointmentsForLead as jest.Mock).mockResolvedValue(["data"]);

      await AppointmentController.listByLead(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handles errors", async () => {
      req = mockRequest({ params: { leadId: "123" } });
      (AppointmentService.getAppointmentsForLead as jest.Mock).mockRejectedValue(new Error("Fail"));

      await AppointmentController.listByLead(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getDocumentUplaodURL", () => {
    it("returns 400 if companionId missing", async () => {
      req = mockRequest({ body: { mimeType: "image/png" } });
      await AppointmentController.getDocumentUplaodURL(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 if mimeType missing", async () => {
      req = mockRequest({ body: { companionId: "comp-1" } });
      await AppointmentController.getDocumentUplaodURL(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 and url/key on success", async () => {
      req = mockRequest({ body: { companionId: "comp-1", mimeType: "image/png" } });
      (generatePresignedUrl as jest.Mock).mockResolvedValue({ url: "mock-url", key: "mock-key" });

      await AppointmentController.getDocumentUplaodURL(req as any, res as any);

      expect(generatePresignedUrl).toHaveBeenCalledWith("image/png", "companion", "comp-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "mock-url", key: "mock-key" });
    });

    it("returns 500 on error", async () => {
      req = mockRequest({ body: { companionId: "comp-1", mimeType: "image/png" } });
      (generatePresignedUrl as jest.Mock).mockRejectedValue(new Error("S3 Fail"));

      await AppointmentController.getDocumentUplaodURL(req as any, res as any);

      expect(logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Failed to generate upload URL." });
    });
  });
});