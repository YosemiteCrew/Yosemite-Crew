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

const mockLean = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe("CompanionHistoryService", () => {
  const organisationId = new Types.ObjectId().toHexString();
  const companionId = "507f191e810c19729de860ea";

  beforeEach(() => {
    jest.clearAllMocks();

    (CompanionService.getById as jest.Mock).mockResolvedValue({
      response: { id: companionId },
    });
    (CompanionOrganisationModel.findOne as jest.Mock).mockReturnValue(
      mockLean({ _id: "link-1" }),
    );

    (
      FormService.listSubmissionsForCompanionInOrganisation as jest.Mock
    ).mockResolvedValue([]);
    (DocumentService.listForPms as jest.Mock).mockResolvedValue([]);
    (LabResultService.list as jest.Mock).mockResolvedValue([]);
    (LabOrderService.listOrders as jest.Mock).mockResolvedValue([]);
    (InvoiceService.listForCompanion as jest.Mock).mockResolvedValue([]);
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
});
