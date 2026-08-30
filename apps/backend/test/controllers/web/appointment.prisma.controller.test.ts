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

  it("creates a requested appointment for the authenticated parent", async () => {
    (req as any).userId = "user_1";
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
    mockedService.createRequestedFromMobile.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedService.createRequestedFromMobile).toHaveBeenCalledWith(
      req.body,
      "parent_1",
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment created",
      data: { id: "appt_1" },
    });
  });

  it("returns 401 when creating a mobile appointment without a session", async () => {
    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedService.createRequestedFromMobile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when the authenticated mobile user has no parent", async () => {
    (req as any).userId = "user_1";
    mockedAuth.getByProviderUserId.mockResolvedValue({} as any);

    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedService.createRequestedFromMobile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
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

  it("loads mobile appointment details through the linked parent", async () => {
    (req as any).userId = "user_1";
    req.params = { appointmentId: "appt_1" };
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
    mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);

    await AppointmentController.getByIdMobile(req as any, res as any);

    expect(mockedAuth.getByProviderUserId).toHaveBeenCalledWith("user_1");
    expect(mockedService.getById).toHaveBeenCalledWith("appt_1", {
      parentId: "parent_1",
    });
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
    (req as any).userId = "user_1";
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
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
    (req as any).organisationId = "org_a";
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

  /*
   * `withOrgPermissions()` proves membership of the org the REQUEST names
   * (x-org-id / query / params). The appointment is persisted under the org its
   * BODY names, via the FHIR Organization participant. Those were unconnected:
   * a caller authorised at org A could write an appointment - plus its invoice
   * and an ACTIVE PatientOrganisation link - into org B.
   */
  describe("binds the write to the authorised organisation", () => {
    const bodyNaming = (orgId: string) =>
      ({
        resourceType: "Appointment",
        participant: [{ actor: { reference: `Organization/${orgId}` } }],
      }) as any;

    it("refuses a body naming a different organisation", async () => {
      (req as any).organisationId = "org_a";
      req.body = bodyNaming("org_b");

      await AppointmentController.createFromPms(req as any, res as any);

      expect(mockedService.createAppointmentFromPms).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("allows the body when it names the authorised organisation", async () => {
      (req as any).organisationId = "org_a";
      req.body = bodyNaming("org_a");
      mockedService.createAppointmentFromPms.mockResolvedValue({
        id: "appt_3",
      } as any);

      await AppointmentController.createFromPms(req as any, res as any);

      expect(mockedService.createAppointmentFromPms).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    /* The real client sends the same org in both places - x-org-id from the
       axios interceptor and Organization/<primaryOrgId> in the body - so this
       is the path it takes, and the guard must not disturb it. */
    it("refuses when no organisation is authorised at all", async () => {
      req.body = bodyNaming("org_b");

      await AppointmentController.createFromPms(req as any, res as any);

      expect(mockedService.createAppointmentFromPms).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    /* A body naming no organisation is left to the service, which already
       rejects it. Inventing a tenant for an ambiguous request is not this
       guard's job. */
    it("passes a body that names no organisation straight through", async () => {
      (req as any).organisationId = "org_a";
      req.body = { resourceType: "Appointment" } as any;
      mockedService.createAppointmentFromPms.mockResolvedValue({
        id: "appt_4",
      } as any);

      await AppointmentController.createFromPms(req as any, res as any);

      expect(mockedService.createAppointmentFromPms).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
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
    req.params = { appointmentId: "appt_1", organisationId: "org_1" };
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
    (req as { userId?: string }).userId = "actor-1";
    await AppointmentController.admitFromPMS(req as any, res as any);
    await AppointmentController.updateFromPms(req as any, res as any);

    expect(mockedService.checkInAppointment).toHaveBeenCalledWith(
      "appt_1",
      "org_1",
    );
    expect(mockedService.admitAppointmentToInpatient).toHaveBeenCalledWith(
      "appt_1",
      "org_1",
      expect.objectContaining({
        admittedAt: new Date("2026-06-11T12:00:00.000Z"),
        admittedBy: "actor-1",
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

  it("checks in an appointment for the authenticated parent", async () => {
    (req as any).userId = "user_1";
    req.params = { appointmentId: "appt_1" };
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
    mockedService.checkInAppointmentParent.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.checkInAppointment(req as any, res as any);

    expect(mockedService.checkInAppointmentParent).toHaveBeenCalledWith(
      "appt_1",
      "parent_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment checked in",
      data: { id: "appt_1" },
    });
  });

  it("rejects parent check-in when the caller is not authenticated", async () => {
    req.params = { appointmentId: "appt_1" };

    await AppointmentController.checkInAppointment(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "User not authenticated",
    });
    expect(mockedService.checkInAppointmentParent).not.toHaveBeenCalled();
  });

  it("maps parent check-in service failures to the error response", async () => {
    (req as any).userId = "user_1";
    req.params = { appointmentId: "appt_1" };
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
    mockedService.checkInAppointmentParent.mockRejectedValue(
      Object.assign(new Error("Appointment not found"), { statusCode: 404 }),
    );

    await AppointmentController.checkInAppointment(req as any, res as any);

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment not found",
    });
  });

  it("marks appointments ready for billing from PMS", async () => {
    req.params = { appointmentId: "appt_1", organisationId: "org_1" };
    (req as any).userId = "user-1";
    mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValue(
      null as any,
    );

    await AppointmentController.markReadyForBillingForPMS(
      req as any,
      res as any,
    );

    expect(
      mockedInvoiceService.markAppointmentReadyForBilling,
    ).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
      actorUserId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment marked ready for billing",
    });
  });

  it("reverses appointments ready for billing from PMS", async () => {
    req.params = { appointmentId: "appt_1", organisationId: "org_1" };
    (req as any).userId = "user-1";
    mockedInvoiceService.reverseAppointmentReadyForBilling.mockResolvedValue({
      id: "inv_1",
      visitBillingStage: "DRAFT",
      billingCollectionMode: "PAY_AT_VISIT_END",
    } as any);

    await AppointmentController.reverseReadyForBillingForPMS(
      req as any,
      res as any,
    );

    expect(
      mockedInvoiceService.reverseAppointmentReadyForBilling,
    ).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
      actorUserId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment billing readiness reversed",
    });
  });

  it("attaches forms, cancels, and fetches appointments", async () => {
    req.params = { appointmentId: "appt_1", organisationId: "org_1" };
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
    (req as any).userPermissions = ["appointments:view:any"];
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
      "org_1",
      ["form_1", "form_2"],
    );
    expect(mockedService.cancelAppointmentFromParent).toHaveBeenCalledWith(
      "appt_1",
      "parent_1",
    );
    expect(mockedService.cancelAppointment).toHaveBeenCalledWith("appt_1");
    expect(mockedService.getById).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
      actorId: undefined,
    });
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

  it("binds own-scope appointment reads to the actor and organisation", async () => {
    req.params = { appointmentId: "appt_1", organisationId: "org_1" };
    (req as any).userId = "lead_1";
    (req as any).userPermissions = ["appointments:view:own"];
    mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);

    await AppointmentController.getById(req as any, res as any);

    expect(mockedService.getById).toHaveBeenCalledWith("appt_1", {
      organisationId: "org_1",
      actorId: "lead_1",
    });
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

  describe("getById org-scoping and own-scope (IDOR)", () => {
    it("refuses to read without an authorized organisation", async () => {
      mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);
      req.params = { appointmentId: "appt_1" };

      await AppointmentController.getById(req as any, res as any);

      expect(mockedService.getById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("PMS view:any caller passes the authorized org and no own-scope restriction", async () => {
      mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);
      req.params = { appointmentId: "appt_1" };
      (req as any).userId = "vet_1";
      (req as any).organisationId = "org_1";
      (req as any).userPermissions = ["appointments:view:any"];

      await AppointmentController.getById(req as any, res as any);

      expect(mockedService.getById).toHaveBeenCalledWith("appt_1", {
        organisationId: "org_1",
        actorId: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("PMS view:own-only caller restricts to the authenticated actor", async () => {
      mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);
      req.params = { appointmentId: "appt_1" };
      (req as any).userId = "vet_1";
      (req as any).organisationId = "org_1";
      (req as any).userPermissions = ["appointments:view:own"];

      await AppointmentController.getById(req as any, res as any);

      expect(mockedService.getById).toHaveBeenCalledWith("appt_1", {
        organisationId: "org_1",
        actorId: "vet_1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("PMS path uses OrgRequest.organisationId over params", async () => {
      mockedService.getById.mockResolvedValue({ id: "appt_1" } as any);
      req.params = { appointmentId: "appt_1", organisationId: "org_param" };
      (req as any).userId = "vet_1";
      (req as any).organisationId = "org_authorized";
      (req as any).userPermissions = ["appointments:view:any"];

      await AppointmentController.getById(req as any, res as any);

      expect(mockedService.getById).toHaveBeenCalledWith("appt_1", {
        organisationId: "org_authorized",
        actorId: undefined,
      });
    });

    it("surfaces a service 404 for a cross-org id", async () => {
      const notFound = Object.assign(new Error("Appointment not found"), {
        statusCode: 404,
      });
      mockedService.getById.mockRejectedValue(notFound);
      req.params = { appointmentId: "appt_in_org_b" };
      (req as any).userId = "vet_1";
      (req as any).organisationId = "org_a";
      (req as any).userPermissions = ["appointments:view:any"];

      await AppointmentController.getById(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
  describe("PMS org scoping", () => {
    it.each([
      ["checkInAppointmentForPMS", "checkInAppointment"],
      ["admitFromPMS", "admitAppointmentToInpatient"],
      ["attachFormsToAppointment", "attachFormsToAppointment"],
    ])(
      "%s refuses to act without an authorized organisation",
      async (handler, serviceMethod) => {
        req.params = { appointmentId: "appt_1" };

        await (AppointmentController as any)[handler](req as any, res as any);

        expect((mockedService as any)[serviceMethod]).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      },
    );

    it("passes the middleware-derived org, not the org named in the URL", async () => {
      req.params = { appointmentId: "appt_1", organisationId: "org_attacker" };
      (req as any).organisationId = "org_owner";
      mockedService.checkInAppointment.mockResolvedValue({
        id: "appt_1",
      } as any);

      await AppointmentController.checkInAppointmentForPMS(
        req as any,
        res as any,
      );

      expect(mockedService.checkInAppointment).toHaveBeenCalledWith(
        "appt_1",
        "org_owner",
      );
    });

    it("surfaces a service 404 for a cross-tenant admit", async () => {
      req.params = { appointmentId: "appt_in_org_b", organisationId: "org_a" };
      mockedService.admitAppointmentToInpatient.mockRejectedValue(
        Object.assign(new Error("Appointment not found"), { statusCode: 404 }),
      );

      await AppointmentController.admitFromPMS(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
