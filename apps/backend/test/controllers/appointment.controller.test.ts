import { AppointmentController } from "../../src/controllers/web/appointment.controller";
import { AppointmentService } from "src/services/appointment.service";
import logger from "src/utils/logger";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

jest.mock("src/services/appointment.service", () => ({
  AppointmentService: {
    createRequestedFromMobile: jest.fn(),
    rescheduleFromParent: jest.fn(),
    getAppointmentsForCompanion: jest.fn(),
  },
}));

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedService = AppointmentService as unknown as {
  createRequestedFromMobile: jest.Mock;
  rescheduleFromParent: jest.Mock;
  getAppointmentsForCompanion: jest.Mock;
};

const mockedAuthService = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("AppointmentController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates appointment from mobile", async () => {
    const req = {
      body: { resourceType: "Appointment" },
    } as any;
    const res = mockResponse();
    mockedService.createRequestedFromMobile.mockResolvedValueOnce({
      appointment: { id: "apt-1" },
    });

    await AppointmentController.createRequestedFromMobile(req, res as any);

    expect(mockedService.createRequestedFromMobile).toHaveBeenCalledWith(
      req.body,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment created",
      data: { appointment: { id: "apt-1" } },
    });
  });

  it("returns error with statusCode if thrown", async () => {
    const req = { body: { resourceType: "Appointment" } } as any;
    const res = mockResponse();
    const err = { statusCode: 400, message: "bad payload" };
    mockedService.createRequestedFromMobile.mockRejectedValueOnce(err);

    await AppointmentController.createRequestedFromMobile(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to create appointment",
    });
  });

  it("reschedules from mobile when auth user provided", async () => {
    const req = {
      params: { appointmentId: "apt-1" },
      headers: { "x-user-id": "user-1" },
      body: { startTime: "2024-01-01", endTime: "2024-01-01" },
    } as any;
    const res = mockResponse();
    mockedAuthService.getByProviderUserId.mockResolvedValueOnce({
      parentId: "user-1",
    });
    mockedService.rescheduleFromParent.mockResolvedValueOnce({ id: "apt-1" });

    await AppointmentController.rescheduleFromMobile(req, res as any);

    expect(mockedService.rescheduleFromParent).toHaveBeenCalledWith(
      "apt-1",
      "user-1",
      { startTime: "2024-01-01", endTime: "2024-01-01" },
    );
  });

  it("returns 401 if auth user missing on reschedule", async () => {
    const req = {
      params: { appointmentId: "apt-1" },
      headers: {},
      body: { startTime: "2024-01-01", endTime: "2024-01-01" },
    } as any;
    const res = mockResponse();

    await AppointmentController.rescheduleFromMobile(req, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("lists appointments by companion", async () => {
    const req = { params: { companionId: "comp-1" } } as any;
    const res = mockResponse();
    mockedService.getAppointmentsForCompanion.mockResolvedValueOnce([
      { id: "apt-1" },
    ]);

    await AppointmentController.listByCompanion(req, res as any);

    expect(mockedService.getAppointmentsForCompanion).toHaveBeenCalledWith(
      "comp-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: "apt-1" }] });
  });

  it("logs and returns error for listByCompanion failures", async () => {
    const req = { params: { companionId: "comp-1" } } as any;
    const res = mockResponse();
    const err = new Error("db down");
    mockedService.getAppointmentsForCompanion.mockRejectedValueOnce(err);

    await AppointmentController.listByCompanion(req, res as any);

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
