import { prisma } from "src/config/prisma";
import {
  FormAssignmentService,
  FormAssignmentServiceError,
} from "../../src/services/form-assignment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    template: { findFirst: jest.fn() },
    templateVersion: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    formAssignment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("FormAssignmentService", () => {
  const mockedPrisma = prisma as unknown as {
    template: { findFirst: jest.Mock };
    templateVersion: { findFirst: jest.Mock };
    appointment: { findFirst: jest.Mock };
    formAssignment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.template.findFirst.mockResolvedValue({
      id: "template-1",
      latestVersion: 3,
      publishedVersion: 2,
    });
    mockedPrisma.templateVersion.findFirst.mockResolvedValue({
      templateId: "template-1",
      version: 2,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-1",
      organisationId: "org-1",
      encounterId: "enc-1",
      patient: { id: "comp-1" },
    });
    mockedPrisma.formAssignment.create.mockResolvedValue({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: "user-1",
      signerName: "Alex Nurse",
      signerEmail: "alex@example.com",
      signerRole: "CLIENT",
      mobileVisible: true,
      signingRequired: true,
      status: "SENT",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.formAssignment.findFirst.mockResolvedValue({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: "user-1",
      signerName: "Alex Nurse",
      signerEmail: "alex@example.com",
      signerRole: "CLIENT",
      mobileVisible: true,
      signingRequired: true,
      status: "SENT",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.formAssignment.findMany.mockResolvedValue([]);
    mockedPrisma.formAssignment.update.mockImplementation(
      async (_args: unknown, data?: unknown) => data,
    );
  });

  it("creates a sent assignment from a template-backed form", async () => {
    const assignment = await FormAssignmentService.createForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
      templateId: "template-1",
      createdBy: "user-1",
      signerIdentity: {
        userId: "user-1",
        name: "Alex Nurse",
        email: "alex@example.com",
        role: "CLIENT",
      },
    });

    expect(mockedPrisma.template.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "template-1",
          organisationId: "org-1",
        }),
      }),
    );
    expect(mockedPrisma.formAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
          mobileVisible: true,
          signingRequired: true,
          createdBy: "user-1",
        }),
      }),
    );
    expect(assignment.assignmentId).toBe("assignment-1");
    expect(assignment.status).toBe("sent");
    expect(assignment.signerIdentity).toEqual({
      userId: "user-1",
      name: "Alex Nurse",
      email: "alex@example.com",
      role: "CLIENT",
    });
  });

  it("falls back to the latest published template version when no version is provided", async () => {
    await FormAssignmentService.createForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
      templateId: "template-1",
      createdBy: "user-1",
    });

    expect(mockedPrisma.templateVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateId: "template-1",
          version: 2,
        },
      }),
    );
  });

  it("rejects assignments for missing templates", async () => {
    mockedPrisma.template.findFirst.mockResolvedValueOnce(null);

    await expect(
      FormAssignmentService.createForAppointment({
        organisationId: "org-1",
        appointmentId: "appt-1",
        templateId: "missing-template",
        createdBy: "user-1",
      }),
    ).rejects.toBeInstanceOf(FormAssignmentServiceError);
  });

  it("returns mapped assignments for an appointment", async () => {
    mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 2,
        appointmentId: "appt-1",
        encounterId: "enc-1",
        companionId: "comp-1",
        signerUserId: null,
        signerName: null,
        signerEmail: null,
        signerRole: null,
        mobileVisible: true,
        signingRequired: true,
        status: "SENT",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: null,
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);

    const rows = await FormAssignmentService.listForAppointment(
      "org-1",
      "appt-1",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].signerIdentity).toBeNull();
  });

  it("prevents resend after cancellation", async () => {
    mockedPrisma.formAssignment.findFirst.mockResolvedValueOnce({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired: true,
      status: "CANCELLED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: new Date("2026-06-14T10:00:00.000Z"),
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });

    await expect(
      FormAssignmentService.resend("assignment-1", "org-1", "user-2"),
    ).rejects.toBeInstanceOf(FormAssignmentServiceError);
  });

  it("cancels an active assignment and returns the updated row", async () => {
    mockedPrisma.formAssignment.findFirst.mockResolvedValueOnce({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired: true,
      status: "SENT",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.formAssignment.update.mockResolvedValueOnce({
      id: "assignment-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired: true,
      status: "CANCELLED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: new Date("2026-06-15T10:00:00.000Z"),
      createdBy: "user-1",
      updatedBy: "user-2",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });

    const assignment = await FormAssignmentService.cancel(
      "assignment-1",
      "org-1",
      "user-2",
    );

    expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          updatedBy: "user-2",
        }),
      }),
    );
    expect(assignment.status).toBe("cancelled");
  });
});
