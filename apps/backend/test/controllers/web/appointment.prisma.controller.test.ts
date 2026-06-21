import { beforeEach, describe, expect, jest, it } from "@jest/globals";
import { Request, Response } from "express";
import { AppointmentController } from "../../../src/controllers/web/appointment.prisma.controller";
import { AppointmentPrismaService } from "../../../src/services/appointment.prisma.service";
import { InvoiceService } from "../../../src/services/invoice.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import { generatePresignedUrl } from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/appointment.prisma.service");
jest.mock("../../../src/services/invoice.service");
jest.mock("../../../src/services/authUserMobile.service");
jest.mock("../../../src/middlewares/upload");
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockedService = jest.mocked(AppointmentPrismaService);
const mockedInvoiceService = jest.mocked(InvoiceService);
const mockedAuth = jest.mocked(AuthUserMobileService);
const mockedUpload = jest.mocked(generatePresignedUrl);
const mockedLogger = jest.mocked(logger);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("AppointmentPrismaController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, params: {}, body: {}, query: {} };
    res = buildResponse();
  });

  it("creates a requested appointment", async () => {
    mockedService.createRequestedFromMobile.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedService.createRequestedFromMobile).toHaveBeenCalledWith(
      req.body,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment created",
      data: { id: "appt_1" },
    });
  });

  it("reschedules mobile appointments after auth lookup", async () => {
    (req as any).userId = "user_1";
    req.params = { appointmentId: "appt_1" };
    req.body = {
      startTime: "2026-06-10T11:00:00.000Z",
      endTime: "2026-06-10T11:30:00.000Z",
    };
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
    mockedService.rescheduleFromParent.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.rescheduleFromMobile(req as any, res as any);

    expect(mockedService.rescheduleFromParent).toHaveBeenCalledWith(
      "appt_1",
      "parent_1",
      expect.objectContaining({
        startTime: "2026-06-10T11:00:00.000Z",
        endTime: "2026-06-10T11:30:00.000Z",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 401 when mobile user is missing", async () => {
    await AppointmentController.rescheduleFromMobile(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("lists appointments for organisation", async () => {
    req.params = { organisationId: "org_1" };
    req.query = { status: "REQUESTED" };
    mockedService.getAppointmentsForOrganisation.mockResolvedValue([
      { id: "appt_1" },
    ] as any);

    await AppointmentController.listByOrganisation(req as any, res as any);

    expect(mockedService.getAppointmentsForOrganisation).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ status: ["REQUESTED"] }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("creates document upload urls", async () => {
    (req as any).userId = "user_1";
    req.body = { patientId: "comp_1", mimeType: "image/png" };
    mockedUpload.mockResolvedValue({
      url: "https://upload-url",
      key: "appointments/comp_1/file",
    } as any);

    await AppointmentController.getDocumentUplaodURL(req as any, res as any);

    expect(mockedUpload).toHaveBeenCalledWith(
      "image/png",
      "custom",
      "appointments/comp_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("logs and surfaces service errors", async () => {
    mockedService.createRequestedFromMobile.mockRejectedValue(
      Object.assign(new Error("Bad"), { statusCode: 400 }),
    );

    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Bad" });
  });

  it("creates PMS appointments with payment options", async () => {
    req.query = { createPayment: "1", paymentCollectionMethod: "clinic" };
    req.body = { resourceType: "Appointment" } as any;
    mockedService.createAppointmentFromPms.mockResolvedValue({
      id: "appt_2",
    } as any);

    await AppointmentController.createFromPms(req as any, res as any);

    expect(mockedService.createAppointmentFromPms).toHaveBeenCalledWith(
      req.body,
      true,
      "clinic",
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("accepts and rejects requested appointments", async () => {
    req.params = { appointmentId: "appt_1" };
    req.body = { resourceType: "Appointment" } as any;
    mockedService.approveRequestedFromPms.mockResolvedValue({
      id: "appt_1",
    } as any);
    mockedService.rejectRequestedAppointment.mockResolvedValue({
      id: "appt_2",
    } as any);

    await AppointmentController.acceptRequested(req as any, res as any);
    await AppointmentController.rejectRequested(req as any, res as any);

    expect(mockedService.approveRequestedFromPms).toHaveBeenCalledWith(
      "appt_1",
      req.body,
    );
    expect(mockedService.rejectRequestedAppointment).toHaveBeenCalledWith(
      "appt_1",
    );
  });

  it("checks in and updates appointments from PMS", async () => {
    req.params = { appointmentId: "appt_1" };
    req.body = {
      admittedAt: "2026-06-11T12:00:00.000Z",
      expectedStayDays: 3,
      lead: {
        id: "lead_1",
        name: "Dr. Patel",
      },
      supportStaff: [
        {
          id: "staff_1",
          name: "Nurse One",
        },
      ],
      room: {
        id: "room_1",
        name: "ICU Room 1",
      },
      roomUnitId: "unit_1",
      assignedAt: "2026-06-11T12:15:00.000Z",
      assignedBy: "user_1",
      assignmentReason: "Initial inpatient placement",
    } as any;
    mockedService.checkInAppointment.mockResolvedValue({ id: "appt_1" } as any);
    mockedService.admitAppointmentToInpatient.mockResolvedValue({
      appointment: { id: "appt_1" },
      admission: { encounterId: "enc_1", unitId: "unit_1" },
      unitAssignment: { id: "assign_1", unitId: "unit_1" },
    } as any);
    mockedService.updateAppointmentPMS.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.checkInAppointmentForPMS(
      req as any,
      res as any,
    );
    await AppointmentController.admitFromPMS(req as any, res as any);
    await AppointmentController.updateFromPms(req as any, res as any);

    expect(mockedService.checkInAppointment).toHaveBeenCalledWith("appt_1");
    expect(mockedService.admitAppointmentToInpatient).toHaveBeenCalledWith(
      "appt_1",
      expect.objectContaining({
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        expectedStayDays: 3,
        lead: {
          id: "lead_1",
          name: "Dr. Patel",
        },
        roomUnitId: "unit_1",
        assignedAt: new Date("2026-06-11T12:15:00.000Z"),
      }),
    );
    expect(mockedService.updateAppointmentPMS).toHaveBeenCalledWith(
      "appt_1",
      req.body,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Appointment admitted",
        data: expect.objectContaining({
          admission: expect.objectContaining({
            encounterId: "enc_1",
            unitId: "unit_1",
          }),
        }),
      }),
    );
  });

  it("marks appointments ready for billing from PMS", async () => {
    req.params = { appointmentId: "appt_1" };
    mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValue(
      null as any,
    );

    await AppointmentController.markReadyForBillingForPMS(
      req as any,
      res as any,
    );

    expect(
      mockedInvoiceService.markAppointmentReadyForBilling,
    ).toHaveBeenCalledWith("appt_1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment marked ready for billing",
    });
  });

  it("attaches forms, cancels, and fetches appointments", async () => {
    req.params = { appointmentId: "appt_1" };
    req.body = { formIds: ["form_1", "form_2"] };
    mockedService.attachFormsToAppointment.mockResolvedValue({
      id: "appt_1",
    } as any);
    mockedService.cancelAppointmentFromParent.mockResolvedValue({
      id: "appt_1",
    } as any);
    mockedService.cancelAppointment.mockResolvedValue({ id: "appt_1" } as any);
    mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);
    mockedService.getAppointmentsForCompanion.mockResolvedValue([
      { id: "appt_1" },
    ] as any);
    mockedService.getAppointmentsForCompanionByOrganisation.mockResolvedValue([
      { id: "appt_1" },
    ] as any);
    mockedService.getAppointmentsForParent.mockResolvedValue([
      { id: "appt_1" },
    ] as any);
    mockedService.getAppointmentsForLead.mockResolvedValue([
      { id: "appt_1" },
    ] as any);

    (req as any).userId = "user_1";
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);

    await AppointmentController.attachFormsToAppointment(
      req as any,
      res as any,
    );
    await AppointmentController.cancelFromMobile(req as any, res as any);
    await AppointmentController.cancelFromPMS(req as any, res as any);
    await AppointmentController.getById(req as any, res as any);
    await AppointmentController.listByCompanion(
      { params: { patientId: "comp_1" } } as any,
      res as any,
    );
    await AppointmentController.listByCompanionForOrganisation(
      { params: { patientId: "comp_1", organisationId: "org_1" } } as any,
      res as any,
    );
    await AppointmentController.listByParent(req as any, res as any);
    await AppointmentController.listByLead(
      { params: { leadId: "lead_1" } } as any,
      res as any,
    );

    expect(mockedService.attachFormsToAppointment).toHaveBeenCalledWith(
      "appt_1",
      ["form_1", "form_2"],
    );
    expect(mockedService.cancelAppointmentFromParent).toHaveBeenCalledWith(
      "appt_1",
      "parent_1",
      undefined,
    );
    expect(mockedService.cancelAppointment).toHaveBeenCalledWith(
      "appt_1",
      undefined,
    );
    expect(mockedService.getById).toHaveBeenCalledWith("appt_1");
    expect(mockedService.getAppointmentsForCompanion).toHaveBeenCalledWith(
      "comp_1",
    );
    expect(
      mockedService.getAppointmentsForCompanionByOrganisation,
    ).toHaveBeenCalledWith("comp_1", "org_1");
    expect(mockedService.getAppointmentsForParent).toHaveBeenCalledWith(
      "parent_1",
    );
    expect(mockedService.getAppointmentsForLead).toHaveBeenCalledWith("lead_1");
  });

  it("handles mobile auth and upload validation errors", async () => {
    await AppointmentController.cancelFromMobile(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);

    await AppointmentController.listByParent(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);

    await AppointmentController.getDocumentUplaodURL(
      { body: {} } as any,
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(401);

    (req as any).userId = "user_1";
    mockedAuth.getByProviderUserId.mockResolvedValueOnce({} as any);
    await AppointmentController.rescheduleFromMobile(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);

    await AppointmentController.getDocumentUplaodURL(
      { body: { patientId: "comp_1" }, userId: "user_1" } as any,
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
