import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
// 1. FIXED IMPORTS: Up 3 levels to reach 'src' from 'test/controllers/web'
import { AppointmentController } from "../../../src/controllers/web/appointment.controller";
import { AppointmentService } from "../../../src/services/appointment.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import * as UploadMiddleware from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

// 2. Mock Setup
jest.mock("../../../src/services/appointment.service");
jest.mock("../../../src/services/authUserMobile.service");
jest.mock("../../../src/middlewares/upload");
jest.mock("../../../src/utils/logger");

// 3. Typed Mocks
const mockedAppointmentService = jest.mocked(AppointmentService);
const mockedAuthService = jest.mocked(AuthUserMobileService);
const mockedUpload = jest.mocked(UploadMiddleware);
const mockedLogger = jest.mocked(logger);

describe("AppointmentController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      params: {},
      body: {}, // Default body is empty object
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  const throwErrorWithStatus = (message: string, statusCode?: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = new Error(message);
    if (statusCode) err.statusCode = statusCode;
    return err;
  };

  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe("createRequestedFromMobile", () => {
    it("should success (201)", async () => {
      req.body = { patientId: "p1" };
      mockedAppointmentService.createRequestedFromMobile.mockResolvedValue({
        id: "a1",
      } as any);

      await AppointmentController.createRequestedFromMobile(
        req as any,
        res as Response,
      );

      expect(
        mockedAppointmentService.createRequestedFromMobile,
      ).toHaveBeenCalledWith(req.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Appointment created",
        data: { id: "a1" },
      });
    });

    it("should handle error with statusCode", async () => {
      req.body = { patientId: "p1" };
      mockedAppointmentService.createRequestedFromMobile.mockRejectedValue(
        throwErrorWithStatus("Bad", 400),
      );

      await AppointmentController.createRequestedFromMobile(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad" });
    });

    it("should handle generic error (fallback)", async () => {
      mockedAppointmentService.createRequestedFromMobile.mockRejectedValue(
        "Unknown Error",
      );

      await AppointmentController.createRequestedFromMobile(
        req as any,
        res as Response,
      );

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Failed to create appointment",
      });
    });
  });

  describe("rescheduleFromMobile", () => {
    it("should 401 if no auth", async () => {
      await AppointmentController.rescheduleFromMobile(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if parent info missing", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: null,
      } as any);

      await AppointmentController.rescheduleFromMobile(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent information missing for user",
      });
    });

    it("should 400 if times missing", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      req.body = {}; // missing startTime

      await AppointmentController.rescheduleFromMobile(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      req.params = { appointmentId: "a1" };
      req.body = { startTime: "10:00", endTime: "11:00" };
      mockedAppointmentService.rescheduleFromParent.mockResolvedValue({
        id: "a1",
      } as any);

      await AppointmentController.rescheduleFromMobile(
        req as any,
        res as Response,
      );

      expect(
        mockedAppointmentService.rescheduleFromParent,
      ).toHaveBeenCalledWith(
        "a1",
        "p1",
        expect.objectContaining({ startTime: "10:00" }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      req.body = { startTime: "10:00", endTime: "11:00" };
      mockedAppointmentService.rescheduleFromParent.mockRejectedValue(
        new Error("Fail"),
      );

      await AppointmentController.rescheduleFromMobile(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createFromPms", () => {
    it("should success (201) with createPayment=true", async () => {
      req.query = { createPayment: "true" };
      req.body = { patientId: "p1" };
      mockedAppointmentService.createAppointmentFromPms.mockResolvedValue({
        id: "a1",
      } as any);

      await AppointmentController.createFromPms(req as any, res as Response);

      // Expect req.body (dto) and true
      expect(
        mockedAppointmentService.createAppointmentFromPms,
      ).toHaveBeenCalledWith(req.body, true);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should success (201) with createPayment=1", async () => {
      req.query = { createPayment: "1" };
      req.body = {};
      mockedAppointmentService.createAppointmentFromPms.mockResolvedValue({
        id: "a1",
      } as any);

      await AppointmentController.createFromPms(req as any, res as Response);
      expect(
        mockedAppointmentService.createAppointmentFromPms,
      ).toHaveBeenCalledWith({}, true);
    });

    it("should success (201) with createPayment=false", async () => {
      req.query = { createPayment: "false" };
      req.body = {};
      mockedAppointmentService.createAppointmentFromPms.mockResolvedValue({
        id: "a1",
      } as any);

      await AppointmentController.createFromPms(req as any, res as Response);
      expect(
        mockedAppointmentService.createAppointmentFromPms,
      ).toHaveBeenCalledWith({}, false);
    });

    it("should handle error", async () => {
      mockedAppointmentService.createAppointmentFromPms.mockRejectedValue(
        throwErrorWithStatus("Err", 400),
      );
      await AppointmentController.createFromPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("acceptRequested", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "a1" };
      req.body = { status: "booked" };
      mockedAppointmentService.approveRequestedFromPms.mockResolvedValue(
        {} as any,
      );

      await AppointmentController.acceptRequested(req as any, res as Response);

      expect(
        mockedAppointmentService.approveRequestedFromPms,
      ).toHaveBeenCalledWith("a1", req.body);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.approveRequestedFromPms.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.acceptRequested(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("rejectRequested", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "a1" };
      mockedAppointmentService.rejectRequestedAppointment.mockResolvedValue(
        {} as any,
      );

      await AppointmentController.rejectRequested(req as any, res as Response);
      expect(
        mockedAppointmentService.rejectRequestedAppointment,
      ).toHaveBeenCalledWith("a1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.rejectRequestedAppointment.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.rejectRequested(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("checkInAppointment (Parent)", () => {
    it("should 401 if no auth", async () => {
      await AppointmentController.checkInAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if parent info missing", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: null,
      } as any);
      await AppointmentController.checkInAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.headers = { "x-user-id": "headerUser" };
      req.params = { appointmentId: "a1" };
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedAppointmentService.checkInAppointmentParent.mockResolvedValue(
        {} as any,
      );

      await AppointmentController.checkInAppointment(
        req as any,
        res as Response,
      );

      expect(mockedAuthService.getByProviderUserId).toHaveBeenCalledWith(
        "headerUser",
      );
      expect(
        mockedAppointmentService.checkInAppointmentParent,
      ).toHaveBeenCalledWith("a1", "p1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedAppointmentService.checkInAppointmentParent.mockRejectedValue(
        new Error("Fail"),
      );

      await AppointmentController.checkInAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("checkInAppointmentForPMS", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "a1" };
      mockedAppointmentService.checkInAppointment.mockResolvedValue({} as any);

      await AppointmentController.checkInAppointmentForPMS(
        req as any,
        res as Response,
      );
      expect(mockedAppointmentService.checkInAppointment).toHaveBeenCalledWith(
        "a1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.checkInAppointment.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.checkInAppointmentForPMS(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateFromPms", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "a1" };
      req.body = { status: "arrived" };
      mockedAppointmentService.updateAppointmentPMS.mockResolvedValue(
        {} as any,
      );

      await AppointmentController.updateFromPms(req as any, res as Response);
      expect(
        mockedAppointmentService.updateAppointmentPMS,
      ).toHaveBeenCalledWith("a1", req.body);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.updateAppointmentPMS.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.updateFromPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("cancelFromMobile", () => {
    it("should 401 if no auth", async () => {
      await AppointmentController.cancelFromMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if parent info missing", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: null,
      } as any);
      await AppointmentController.cancelFromMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { appointmentId: "a1" };
      req.body = { reason: "sick" };
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedAppointmentService.cancelAppointmentFromParent.mockResolvedValue(
        {} as any,
      );

      await AppointmentController.cancelFromMobile(req as any, res as Response);
      expect(
        mockedAppointmentService.cancelAppointmentFromParent,
      ).toHaveBeenCalledWith("a1", "p1", "sick");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      mockedAuthService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedAppointmentService.cancelAppointmentFromParent.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.cancelFromMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("cancelFromPMS", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "a1" };
      mockedAppointmentService.cancelAppointment.mockResolvedValue({} as any);

      await AppointmentController.cancelFromPMS(req as any, res as Response);
      expect(mockedAppointmentService.cancelAppointment).toHaveBeenCalledWith(
        "a1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.cancelAppointment.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.cancelFromPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getById", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "a1" };
      mockedAppointmentService.getById.mockResolvedValue({} as any);

      await AppointmentController.getById(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.getById.mockRejectedValue(new Error("Fail"));
      await AppointmentController.getById(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listByCompanion", () => {
    it("should success (200)", async () => {
      req.params = { companionId: "c1" };
      mockedAppointmentService.getAppointmentsForCompanion.mockResolvedValue(
        [],
      );

      await AppointmentController.listByCompanion(req as any, res as Response);
      expect(
        mockedAppointmentService.getAppointmentsForCompanion,
      ).toHaveBeenCalledWith("c1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.getAppointmentsForCompanion.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.listByCompanion(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listByParent", () => {
    it("should success (200)", async () => {
      req.params = { parentId: "p1" };
      mockedAppointmentService.getAppointmentsForParent.mockResolvedValue([]);

      await AppointmentController.listByParent(req as any, res as Response);
      expect(
        mockedAppointmentService.getAppointmentsForParent,
      ).toHaveBeenCalledWith("p1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.getAppointmentsForParent.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.listByParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listByOrganisation", () => {
    it("should success (200) with minimal params", async () => {
      req.params = { organisationId: "o1" };
      mockedAppointmentService.getAppointmentsForOrganisation.mockResolvedValue(
        [],
      );

      await AppointmentController.listByOrganisation(
        req as any,
        res as Response,
      );
      expect(
        mockedAppointmentService.getAppointmentsForOrganisation,
      ).toHaveBeenCalledWith(
        "o1",
        expect.objectContaining({
          status: undefined,
          startDate: undefined,
          endDate: undefined,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should success (200) with status array and numeric dates", async () => {
      req.params = { organisationId: "o1" };
      req.query = {
        status: ["booked", "arrived"],
        startDate: "1000",
        endDate: "2000",
      };

      mockedAppointmentService.getAppointmentsForOrganisation.mockResolvedValue(
        [],
      );

      await AppointmentController.listByOrganisation(
        req as any,
        res as Response,
      );

      expect(
        mockedAppointmentService.getAppointmentsForOrganisation,
      ).toHaveBeenCalledWith(
        "o1",
        expect.objectContaining({
          status: ["booked", "arrived"],
          startDate: new Date("1000"),
          endDate: new Date("2000"),
        }),
      );
    });

    it("should success (200) with status string", async () => {
      req.params = { organisationId: "o1" };
      req.query = { status: "booked,arrived" };
      mockedAppointmentService.getAppointmentsForOrganisation.mockResolvedValue(
        [],
      );

      await AppointmentController.listByOrganisation(
        req as any,
        res as Response,
      );

      expect(
        mockedAppointmentService.getAppointmentsForOrganisation,
      ).toHaveBeenCalledWith(
        "o1",
        expect.objectContaining({ status: ["booked", "arrived"] }),
      );
    });

    it("should handle error", async () => {
      mockedAppointmentService.getAppointmentsForOrganisation.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.listByOrganisation(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listByLead", () => {
    it("should success (200)", async () => {
      req.params = { leadId: "l1" };
      mockedAppointmentService.getAppointmentsForLead.mockResolvedValue([]);

      await AppointmentController.listByLead(req as any, res as Response);
      expect(
        mockedAppointmentService.getAppointmentsForLead,
      ).toHaveBeenCalledWith("l1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      mockedAppointmentService.getAppointmentsForLead.mockRejectedValue(
        new Error("Fail"),
      );
      await AppointmentController.listByLead(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getDocumentUplaodURL", () => {
    it("should 400 if params missing", async () => {
      req.body = {};
      await AppointmentController.getDocumentUplaodURL(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.body = { companionId: "c1", mimeType: "image/png" };
      mockedUpload.generatePresignedUrl.mockResolvedValue({
        url: "http://s3",
        key: "k",
      });

      await AppointmentController.getDocumentUplaodURL(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ url: "http://s3", key: "k" });
    });

    it("should handle error", async () => {
      req.body = { companionId: "c1", mimeType: "image/png" };
      mockedUpload.generatePresignedUrl.mockRejectedValue(new Error("Fail"));

      await AppointmentController.getDocumentUplaodURL(
        req as any,
        res as Response,
      );
      expect(logger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
