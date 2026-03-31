import { Types } from "mongoose";
import { CompanionHistoryService } from "../../src/services/companion-history.service";
import { AppointmentService } from "../../src/services/appointment.service";
import { TaskService } from "../../src/services/task.service";
import { FormService } from "../../src/services/form.service";
import { DocumentService } from "../../src/services/document.service";
import { LabResultService } from "../../src/services/lab-result.service";
import { LabOrderService } from "../../src/services/lab-order.service";
import { InvoiceService } from "../../src/services/invoice.service";
import { CompanionService } from "../../src/services/companion.service";
import CompanionOrganisationModel from "../../src/models/companion-organisation";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import logger from "../../src/utils/logger";
import { fromFHIRInvoice } from "@yosemite-crew/types";

jest.mock("../../src/services/appointment.service");
jest.mock("../../src/services/task.service");
jest.mock("../../src/services/form.service");
jest.mock("../../src/services/document.service");
jest.mock("../../src/services/lab-result.service");
jest.mock("../../src/services/lab-order.service");
jest.mock("../../src/services/invoice.service");
jest.mock("../../src/services/companion.service");
jest.mock("../../src/models/companion-organisation");
jest.mock("../../src/utils/logger");
jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    companionOrganisation: { findFirst: jest.fn() },
  },
}));
jest.mock("@yosemite-crew/types", () => ({
  ...jest.requireActual("@yosemite-crew/types"),
  fromFHIRInvoice: jest.fn(),
}));

const mockLean = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe("CompanionHistoryService", () => {
  const organisationId = new Types.ObjectId().toHexString();
  const companionId = "507f191e810c19729de860ea";

  beforeEach(() => {
    jest.clearAllMocks();
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);

    (CompanionService.getById as jest.Mock).mockResolvedValue({
      response: { id: companionId },
    });
    (CompanionOrganisationModel.findOne as jest.Mock).mockReturnValue(
      mockLean({ _id: "link-1" }),
    );
    (prisma.companionOrganisation.findFirst as jest.Mock).mockResolvedValue({
      id: "pg-link",
    });

    (
      FormService.listSubmissionsForCompanionInOrganisation as jest.Mock
    ).mockResolvedValue([]);
    (DocumentService.listForPms as jest.Mock).mockResolvedValue([]);
    (LabResultService.list as jest.Mock).mockResolvedValue([]);
    (LabOrderService.listOrders as jest.Mock).mockResolvedValue([]);
    (InvoiceService.listForCompanion as jest.Mock).mockResolvedValue([]);
    (fromFHIRInvoice as jest.Mock).mockImplementation((value) => value);
  });

  it("merges entries, sorts by occurredAt desc, and paginates with cursor", async () => {
    (
      AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock
    ).mockResolvedValue([
      {
        resourceType: "Appointment",
        id: "apt-1",
        status: "COMPLETED",
        start: "2024-01-02T10:00:00.000Z",
        end: "2024-01-02T10:30:00.000Z",
        participant: [],
        serviceType: [
          {
            coding: [{ code: "svc1", display: "Checkup" }],
            text: "Checkup",
          },
        ],
        speciality: [{ coding: [{ code: "spec1", display: "General" }] }],
        extension: [],
      },
      {
        resourceType: "Appointment",
        id: "apt-2",
        status: "COMPLETED",
        start: "2024-01-01T10:00:00.000Z",
        end: "2024-01-01T10:30:00.000Z",
        participant: [],
        serviceType: [
          {
            coding: [{ code: "svc2", display: "Vaccination" }],
            text: "Vaccination",
          },
        ],
        speciality: [{ coding: [{ code: "spec1", display: "General" }] }],
        extension: [],
      },
    ]);

    const taskId = new Types.ObjectId();
    (TaskService.listForCompanion as jest.Mock).mockResolvedValue([
      {
        _id: taskId,
        organisationId,
        appointmentId: "apt-1",
        name: "Follow up",
        category: "CARE",
        audience: "EMPLOYEE_TASK",
        dueAt: new Date("2024-01-03T09:00:00.000Z"),
        status: "PENDING",
        createdAt: new Date("2024-01-02T12:00:00.000Z"),
      },
    ]);

    const firstPage = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      limit: 2,
    });

    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.entries[0].type).toBe("TASK");
    expect(firstPage.entries[1].type).toBe("APPOINTMENT");
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.entries[0].link.id).toBe("apt-2");
  });

  it("filters by types", async () => {
    (
      AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock
    ).mockResolvedValue([
      {
        resourceType: "Appointment",
        id: "apt-1",
        status: "COMPLETED",
        start: "2024-01-02T10:00:00.000Z",
        end: "2024-01-02T10:30:00.000Z",
        participant: [],
        serviceType: [],
        speciality: [],
        extension: [],
      },
    ]);

    const taskId = new Types.ObjectId();
    (TaskService.listForCompanion as jest.Mock).mockResolvedValue([
      {
        _id: taskId,
        organisationId,
        appointmentId: "apt-1",
        name: "Follow up",
        category: "CARE",
        audience: "EMPLOYEE_TASK",
        dueAt: new Date("2024-01-03T09:00:00.000Z"),
        status: "PENDING",
      },
    ]);

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["TASK"],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].type).toBe("TASK");
  });

  it("rejects invalid inputs", async () => {
    await expect(
      CompanionHistoryService.listForCompanion({
        organisationId: "bad.$",
        companionId,
      }),
    ).rejects.toThrow("Invalid organisationId");

    await expect(
      CompanionHistoryService.listForCompanion({
        organisationId,
        companionId,
        limit: 0,
      }),
    ).rejects.toThrow("Invalid limit");

    await expect(
      CompanionHistoryService.listForCompanion({
        organisationId,
        companionId,
        cursor: "not-base64",
      }),
    ).rejects.toThrow("Invalid cursor");
  });

  it("rejects invalid types filter", async () => {
    await expect(
      CompanionHistoryService.listForCompanion({
        organisationId,
        companionId,
        types: ["BAD" as any],
      }),
    ).rejects.toThrow("Invalid types filter");
  });

  it("rejects when companion is missing", async () => {
    (CompanionService.getById as jest.Mock).mockResolvedValue({
      response: null,
    });

    await expect(
      CompanionHistoryService.listForCompanion({
        organisationId,
        companionId,
      }),
    ).rejects.toThrow("Companion not found");
  });

  it("rejects when companion is not visible", async () => {
    (CompanionOrganisationModel.findOne as jest.Mock).mockReturnValue(
      mockLean(null),
    );

    await expect(
      CompanionHistoryService.listForCompanion({
        organisationId,
        companionId,
      }),
    ).rejects.toThrow("Companion not found");
  });

  it("uses postgres visibility when read switch is enabled", async () => {
    (isReadFromPostgres as jest.Mock).mockReturnValue(true);
    (prisma.companionOrganisation.findFirst as jest.Mock).mockResolvedValue({
      id: "pg-link",
    });

    await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: [],
    });

    expect(prisma.companionOrganisation.findFirst).toHaveBeenCalled();
    expect(CompanionOrganisationModel.findOne).not.toHaveBeenCalled();
  });

  it("excludes tasks from other organisations", async () => {
    (
      AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock
    ).mockResolvedValue([]);

    const taskId = new Types.ObjectId();
    (TaskService.listForCompanion as jest.Mock).mockResolvedValue([
      {
        _id: taskId,
        organisationId: "other-org",
        appointmentId: "apt-1",
        name: "Follow up",
        category: "CARE",
        audience: "EMPLOYEE_TASK",
        dueAt: new Date("2024-01-03T09:00:00.000Z"),
        status: "PENDING",
      },
    ]);

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["TASK"],
    });

    expect(result.entries).toHaveLength(0);
  });

  it("builds appointment payload details", async () => {
    (
      AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock
    ).mockResolvedValue([
      {
        resourceType: "Appointment",
        id: "apt-1",
        status: "COMPLETED",
        start: "2024-01-02T10:00:00.000Z",
        participant: [
          {
            type: [{ coding: [{ code: "PPRF" }] }],
            actor: { reference: "Practitioner/123", display: "Dr Vet" },
          },
          {
            type: [{ coding: [{ code: "LOC" }] }],
            actor: { display: "Room A" },
          },
          {
            type: [{ coding: [{ code: "SPRF" }] }],
            actor: { display: "Tech A" },
          },
        ],
        serviceType: [{ coding: [{ code: "svc1", display: "Checkup" }] }],
        speciality: [{ coding: [{ code: "spec1", display: "General" }] }],
        extension: [
          {
            url: "https://yosemitecrew.com/fhir/StructureDefinition/appointment-payment-status",
            valueString: "PAID",
          },
        ],
      },
    ]);

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["APPOINTMENT"],
    });

    expect(result.entries[0].actor).toEqual({
      id: "123",
      name: "Dr Vet",
      role: "VET",
    });
    expect(result.entries[0].subtitle).toContain("Room A");
    expect(result.entries[0].payload).toEqual(
      expect.objectContaining({ paymentStatus: "PAID" }),
    );
  });

  it("skips documents from appointments outside the organisation", async () => {
    (
      AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock
    ).mockResolvedValue([{ id: "apt-1" }]);

    (DocumentService.listForPms as jest.Mock).mockResolvedValue([
      {
        id: "doc-1",
        title: "Doc 1",
        appointmentId: "apt-1",
        category: "CAT",
        attachments: [],
      },
      {
        id: "doc-2",
        title: "Doc 2",
        appointmentId: "apt-2",
        category: "CAT",
        attachments: [],
      },
    ]);

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["DOCUMENT"],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].link.id).toBe("doc-1");
  });

  it("adds SOAP tags and answers preview for form submissions", async () => {
    (
      FormService.listSubmissionsForCompanionInOrganisation as jest.Mock
    ).mockResolvedValue([
      {
        id: "form-1",
        submittedAt: new Date("2024-01-01T00:00:00.000Z"),
        formName: "SOAP Form",
        formCategory: "SOAP-Plan",
        answers: { a: " yes ", b: { note: "x" }, c: 2 },
      },
    ]);

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["FORM_SUBMISSION"],
    });

    expect(result.entries[0].tags).toEqual(["SOAP", "SOAP-Plan"]);
    expect(result.entries[0].summary).toContain("yes");
  });

  it("includes lab result payload with order mapping", async () => {
    (LabResultService.list as jest.Mock).mockResolvedValue([
      {
        resultId: "res-1",
        orderId: "order-1",
        provider: "IDEXX",
        status: "COMPLETE",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        rawPayload: { raw: true },
      },
    ]);
    (LabOrderService.listOrders as jest.Mock).mockResolvedValue([
      {
        idexxOrderId: "order-1",
        appointmentId: "apt-1",
        pdfUrl: "pdf",
      },
    ]);

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["LAB_RESULT"],
    });

    expect(result.entries[0].payload).toEqual(
      expect.objectContaining({
        pdfAvailable: true,
        orderId: "order-1",
      }),
    );
    expect(result.entries[0].link.appointmentId).toBe("apt-1");
  });

  it("builds invoice entries from FHIR invoices", async () => {
    (InvoiceService.listForCompanion as jest.Mock).mockResolvedValue([
      { id: "inv-1" },
      { id: "inv-2" },
    ]);
    (fromFHIRInvoice as jest.Mock)
      .mockReturnValueOnce({
        id: "inv-1",
        organisationId,
        status: "PAID",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      })
      .mockReturnValueOnce({
        id: "inv-2",
        organisationId: "other",
        status: "PAID",
        totalAmount: 50,
        currency: "USD",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      });

    const result = await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["INVOICE"],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].link.id).toBe("inv-1");
  });

  it("logs warnings when a source fetch fails", async () => {
    (
      AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock
    ).mockRejectedValueOnce(new Error("fail"));

    await CompanionHistoryService.listForCompanion({
      organisationId,
      companionId,
      types: ["APPOINTMENT"],
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Companion history appointments failed",
      expect.objectContaining({ organisationId, companionId }),
    );
  });
});
