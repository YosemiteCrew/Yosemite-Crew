import { prisma } from "src/config/prisma";
import {
  FormAssignmentService,
  FormAssignmentServiceError,
} from "../../src/services/form-assignment.service";
import { TemplateService } from "src/services/template.service";

jest.mock("src/services/template.service", () => ({
  TemplateService: {
    resolve: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    template: { findFirst: jest.fn() },
    templateVersion: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    formSubmission: { findMany: jest.fn() },
    formAssignment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    parentPatient: { findMany: jest.fn() },
    parent: { findMany: jest.fn() },
    templateInstance: { findMany: jest.fn() },
  },
}));

describe("FormAssignmentService", () => {
  const mockedPrisma = prisma as unknown as {
    template: { findFirst: jest.Mock };
    templateVersion: { findFirst: jest.Mock };
    appointment: { findFirst: jest.Mock };
    formSubmission: { findMany: jest.Mock };
    formAssignment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    parentPatient: { findMany: jest.Mock };
    parent: { findMany: jest.Mock };
    templateInstance: { findMany: jest.Mock };
  };
  const mockedTemplateService = TemplateService as unknown as {
    resolve: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.template.findFirst.mockReset();
    mockedPrisma.templateVersion.findFirst.mockReset();
    mockedPrisma.appointment.findFirst.mockReset();
    mockedPrisma.formSubmission.findMany.mockReset();
    mockedTemplateService.resolve.mockReset();
    mockedPrisma.formAssignment.create.mockReset();
    mockedPrisma.formAssignment.findFirst.mockReset();
    mockedPrisma.formAssignment.findMany.mockReset();
    mockedPrisma.formAssignment.update.mockReset();
    mockedPrisma.formAssignment.updateMany.mockReset();

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
      productItemId: "svc-1",
      appointmentKind: "OUTPATIENT",
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
    mockedPrisma.formAssignment.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.formSubmission.findMany.mockResolvedValue([]);
    mockedTemplateService.resolve.mockResolvedValue({
      templateId: "template-1",
      templateVersion: 2,
      templateVersionId: "template-version-1",
      source: "ORGANISATION",
      ownerUserId: null,
      kind: "FORM",
      name: "Consent",
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: null,
      validationSnapshot: null,
      appliesTo: null,
      reason: "linked",
    });
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

  it("syncs linked templates once per appointment", async () => {
    mockedPrisma.formAssignment.findFirst.mockResolvedValueOnce(null);

    await FormAssignmentService.syncLinkedTemplateAssignmentsForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
    });

    expect(mockedTemplateService.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        appointmentId: "appt-1",
        encounterId: "enc-1",
        serviceId: "svc-1",
        species: undefined,
        kind: "FORM",
      }),
    );
    expect(mockedPrisma.formAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: "SYSTEM",
          templateId: "template-1",
          templateVersion: 2,
        }),
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
        appointment: {
          patient: {
            id: "comp-1",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
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

  it("lists organisation assignments with signed document metadata", async () => {
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
        status: "SIGNED",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: new Date("2026-06-14T11:00:00.000Z"),
        submittedAt: new Date("2026-06-14T12:00:00.000Z"),
        signedAt: new Date("2026-06-14T13:00:00.000Z"),
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T13:00:00.000Z"),
        template: { id: "template-1", name: "Annual Intake" },
        companion: { id: "comp-1", name: "Milo" },
        appointment: {
          patient: {
            id: "comp-1",
            name: "Milo",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
      },
    ]);
    mockedPrisma.formSubmission.findMany.mockResolvedValueOnce([
      {
        id: "submission-1",
        formId: "template-1",
        formVersion: 2,
        appointmentId: "appt-1",
        patientId: "comp-1",
        parentId: "parent-1",
        submittedAt: new Date("2026-06-14T12:00:00.000Z"),
        signing: {
          status: "SIGNED",
          documentId: "doc-123",
          pdf: { url: "https://files.example/signed.pdf" },
        },
      },
    ]);

    const rows = await FormAssignmentService.listForOrganisation({
      organisationId: "org-1",
      parentId: "parent-1",
      status: "signed",
    });

    expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          status: { in: ["SIGNED"] },
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: "assignment-1",
        templateName: "Annual Intake",
        templateTitle: "Annual Intake",
        companionName: "Milo",
        parentId: "parent-1",
        parentName: "Jane Doe",
        status: "SIGNED",
        signedDocument: {
          documentId: "doc-123",
          pdfUrl: "https://files.example/signed.pdf",
        },
      }),
    ]);
  });

  it("marks a viewed assignment when the parent opens the appointment", async () => {
    await FormAssignmentService.markViewedForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
    });

    expect(mockedPrisma.formAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          appointmentId: "appt-1",
          status: "SENT",
        }),
        data: expect.objectContaining({
          status: "VIEWED",
        }),
      }),
    );
  });

  it("marks a submitted assignment when the form is submitted", async () => {
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
        status: "VIEWED",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: new Date("2026-06-14T11:00:00.000Z"),
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T11:00:00.000Z"),
        appointment: {
          patient: {
            id: "comp-1",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
      },
    ]);
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
      status: "SUBMITTED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: new Date("2026-06-14T11:00:00.000Z"),
      submittedAt: new Date("2026-06-14T12:00:00.000Z"),
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T12:00:00.000Z"),
    });

    const row = await FormAssignmentService.markSubmittedFromSubmission({
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      companionId: "comp-1",
      parentId: "parent-1",
    });

    expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assignment-1" },
        data: expect.objectContaining({
          status: "SUBMITTED",
        }),
      }),
    );
    expect(row?.status).toBe("SUBMITTED");
  });

  it("marks a signed assignment when the signed document arrives", async () => {
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
        status: "SUBMITTED",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: new Date("2026-06-14T11:00:00.000Z"),
        submittedAt: new Date("2026-06-14T12:00:00.000Z"),
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T12:00:00.000Z"),
        appointment: {
          patient: {
            id: "comp-1",
            parent: { id: "parent-1", name: "Jane Doe" },
          },
        },
      },
    ]);
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
      status: "SIGNED",
      sentAt: new Date("2026-06-14T10:00:00.000Z"),
      viewedAt: new Date("2026-06-14T11:00:00.000Z"),
      submittedAt: new Date("2026-06-14T12:00:00.000Z"),
      signedAt: new Date("2026-06-14T13:00:00.000Z"),
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T13:00:00.000Z"),
    });

    const row = await FormAssignmentService.markSignedFromSubmission({
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 2,
      appointmentId: "appt-1",
      companionId: "comp-1",
      parentId: "parent-1",
    });

    expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assignment-1" },
        data: expect.objectContaining({
          status: "SIGNED",
        }),
      }),
    );
    expect(row?.status).toBe("SIGNED");
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

  describe("listForOrganisation", () => {
    it("enriches rows with template, companion, primary parent, and signed doc", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValue([
        {
          id: "fa-1",
          templateId: "tpl-1",
          templateVersion: 3,
          companionId: "comp-1",
          appointmentId: "appt-1",
          status: "SIGNED",
          signingRequired: true,
          mobileVisible: true,
          viewedAt: new Date("2026-06-22T08:00:00.000Z"),
          submittedAt: new Date("2026-06-22T08:10:00.000Z"),
          signedAt: new Date("2026-06-22T08:15:00.000Z"),
          expiredAt: null,
          cancelledAt: null,
          template: { name: "Intake Form" },
          companion: { name: "Milo" },
          appointment: {
            patient: {
              id: "comp-1",
              name: "Milo",
              parent: { id: "par-1", name: "Jane Doe" },
            },
          },
        },
      ]);
      mockedPrisma.formSubmission.findMany.mockResolvedValue([
        {
          id: "submission-1",
          formId: "tpl-1",
          formVersion: 3,
          appointmentId: "appt-1",
          patientId: "comp-1",
          parentId: "par-1",
          submittedAt: new Date("2026-06-22T08:10:00.000Z"),
          signing: {
            status: "SIGNED",
            documentId: "inst-1",
            pdf: { url: "https://pdf" },
          },
        },
      ]);

      const result = await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "fa-1",
        templateName: "Intake Form",
        templateTitle: "Intake Form",
        companionName: "Milo",
        parentId: "par-1",
        parentName: "Jane Doe",
        status: "SIGNED",
        signedAt: new Date("2026-06-22T08:15:00.000Z"),
        signedDocument: { documentId: "inst-1", pdfUrl: "https://pdf" },
      });
      // The service now filters rows after fetch, so the base query stays minimal.
      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });

    it("leaves signedDocument null when the assignment is not signed", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValue([
        {
          id: "fa-2",
          templateId: "tpl-1",
          templateVersion: 1,
          companionId: "comp-1",
          appointmentId: "appt-1",
          status: "SENT",
          signingRequired: true,
          mobileVisible: true,
          viewedAt: null,
          submittedAt: null,
          signedAt: null,
          expiredAt: null,
          cancelledAt: null,
          template: { name: "Intake Form" },
          companion: { name: "Milo", parentLinks: [] },
        },
      ]);

      const result = await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
      });

      expect(result[0].signedDocument).toBeNull();
      expect(result[0].parentId).toBeNull();
      expect(result[0].parentName).toBeNull();
      // No signed rows => no template-instance lookup.
      expect(mockedPrisma.templateInstance.findMany).not.toHaveBeenCalled();
    });

    it("resolves a parentId filter to the parent's companions", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([
        { patientId: "comp-9" },
      ]);
      mockedPrisma.formAssignment.findMany.mockResolvedValue([]);

      await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
        parentId: "par-9",
      });

      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });

    it("returns an empty list when a parent has no linked companions", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([]);

      const result = await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
        parentId: "par-none",
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });

    it("intersects parentId and companionId: empty when companion is not the parent's", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([
        { patientId: "comp-9" },
      ]);

      const result = await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
        parentId: "par-9",
        companionId: "comp-OTHER",
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org-1",
            companionId: "comp-OTHER",
          }),
        }),
      );
    });

    it("intersects parentId and companionId: scopes to the companion when it belongs to the parent", async () => {
      mockedPrisma.parentPatient.findMany.mockResolvedValue([
        { patientId: "comp-9" },
        { patientId: "comp-10" },
      ]);
      mockedPrisma.formAssignment.findMany.mockResolvedValue([]);

      await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
        parentId: "par-9",
        companionId: "comp-9",
      });

      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companionId: "comp-9" }),
        }),
      );
    });
  });
});
