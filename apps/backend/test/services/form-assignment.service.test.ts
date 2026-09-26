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
    template: { findFirst: jest.fn(), findMany: jest.fn() },
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
    template: { findFirst: jest.Mock; findMany: jest.Mock };
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
      kind: "CONSENT",
      rules: null,
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

  // What the visit's finalisation reads: a request saved when every request
  // asked for a signature completes on submission for a form the client does
  // not sign.
  describe("an appointment's form summaries", () => {
    const row = (
      templateId: string,
      status: string,
      signingRequired = true,
    ) => ({
      id: `assignment-${templateId}`,
      organisationId: "org-1",
      templateId,
      templateVersion: 1,
      appointmentId: "appt-1",
      encounterId: null,
      companionId: null,
      signerUserId: null,
      signerName: null,
      signerEmail: null,
      signerRole: null,
      mobileVisible: true,
      signingRequired,
      status,
      sentAt: null,
      viewedAt: null,
      submittedAt: null,
      signedAt: null,
      expiredAt: null,
      cancelledAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date("2026-09-25T00:00:00.000Z"),
      updatedAt: new Date("2026-09-25T00:00:00.000Z"),
    });

    it("needs a signature only on a form the client signs", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
        row("tpl-intake", "SUBMITTED"),
        row("tpl-consent", "SUBMITTED"),
        row("tpl-signed", "SIGNED"),
      ]);
      mockedPrisma.template.findMany.mockResolvedValueOnce([
        { id: "tpl-intake", kind: "FORM", rules: { requiredSigner: "VET" } },
        { id: "tpl-consent", kind: "CONSENT", rules: null },
        { id: "tpl-signed", kind: "CONSENT", rules: null },
      ]);

      const summaries =
        await FormAssignmentService.listAppointmentFormSummaries(
          "org-1",
          "appt-1",
        );

      expect(
        summaries.map(({ templateId, status, signingRequired }) => [
          templateId,
          status,
          signingRequired,
        ]),
      ).toEqual([
        ["tpl-intake", "completed", false],
        ["tpl-consent", "pending", true],
        ["tpl-signed", "completed", true],
      ]);
      expect(mockedPrisma.template.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["tpl-intake", "tpl-consent", "tpl-signed"] } },
        select: { id: true, kind: true, rules: true },
      });
    });

    it("reads no templates for an appointment with no requests", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([]);
      mockedPrisma.template.findMany.mockClear();

      await expect(
        FormAssignmentService.listAppointmentFormSummaries("org-1", "appt-1"),
      ).resolves.toEqual([]);
      expect(mockedPrisma.template.findMany).not.toHaveBeenCalled();
    });
  });

  // The client is asked to sign only what the template says they sign.
  describe("whether the client is asked to sign", () => {
    const createFor = async (
      template: Record<string, unknown>,
      signingRequired?: boolean,
    ) => {
      mockedPrisma.template.findFirst.mockResolvedValueOnce({
        id: "template-1",
        latestVersion: 3,
        publishedVersion: 2,
        ...template,
      });
      await FormAssignmentService.createForAppointment({
        organisationId: "org-1",
        appointmentId: "appt-1",
        templateId: "template-1",
        createdBy: "user-1",
        ...(signingRequired === undefined ? {} : { signingRequired }),
      });
      return mockedPrisma.formAssignment.create.mock.calls[0][0].data
        .signingRequired;
    };

    it.each([
      ["a consent", { kind: "CONSENT", rules: null }, true],
      [
        "a consent saved as a form",
        { kind: "FORM", rules: { category: "Consent form" } },
        true,
      ],
      [
        "a form the client signs",
        { kind: "FORM", rules: { requiredSigner: "CLIENT" } },
        true,
      ],
      [
        "a form the practice signs",
        { kind: "FORM", rules: { requiredSigner: "VET" } },
        false,
      ],
      ["a plain form", { kind: "FORM", rules: { category: "Intake" } }, false],
      ["a form with no rules", { kind: "FORM", rules: null }, false],
    ])("follows the template for %s", async (_label, template, expected) => {
      await expect(createFor(template)).resolves.toBe(expected);
    });

    it("keeps what the practice chose", async () => {
      await expect(
        createFor({ kind: "FORM", rules: null }, true),
      ).resolves.toBe(true);
    });

    it("selects the template's kind and rules", async () => {
      await createFor({ kind: "CONSENT", rules: null });
      expect(mockedPrisma.template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ kind: true, rules: true }),
        }),
      );
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

  // The sync runs from read flows (workspace bootstrap, document retrieval,
  // appointment form listing) that are authorised on view permissions, while
  // creating an assignment is a `forms:edit:any` action. Without the gate,
  // merely opening an appointment persisted client-visible consent requests.
  it("creates nothing for a caller who cannot manage forms", async () => {
    await FormAssignmentService.syncLinkedTemplateAssignmentsForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
      canManageForms: false,
    });

    expect(mockedTemplateService.resolve).not.toHaveBeenCalled();
    expect(mockedPrisma.formAssignment.create).not.toHaveBeenCalled();
  });

  it("syncs linked templates once per appointment", async () => {
    mockedPrisma.formAssignment.findFirst.mockResolvedValueOnce(null);

    await FormAssignmentService.syncLinkedTemplateAssignmentsForAppointment({
      organisationId: "org-1",
      appointmentId: "appt-1",
      canManageForms: true,
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

  // CONSENT became a storage kind of its own (1c3c790f0); a FORM-only lookup
  // refused every consent template, so none could be sent to a client.
  describe("assignable template kinds", () => {
    const storedKinds: Record<string, string> = {
      "template-form": "FORM",
      "template-consent": "CONSENT",
      "template-soap": "SOAP_NOTE",
    };

    beforeEach(() => {
      mockedPrisma.template.findFirst.mockImplementation(
        async ({ where }: { where: { id: string; kind: unknown } }) => {
          const kind = storedKinds[where.id];
          const filter = where.kind as string | { in: string[] };
          const matches =
            typeof filter === "string"
              ? filter === kind
              : filter.in.includes(kind);
          return matches
            ? { id: where.id, latestVersion: 2, publishedVersion: 2 }
            : null;
        },
      );
    });

    const assign = (templateId: string) =>
      FormAssignmentService.createForAppointment({
        organisationId: "org-1",
        appointmentId: "appt-1",
        templateId,
        createdBy: "user-1",
      });

    it.each(["template-form", "template-consent"])(
      "assigns %s",
      async (templateId) => {
        await expect(assign(templateId)).resolves.toMatchObject({
          assignmentId: "assignment-1",
        });
        expect(mockedPrisma.formAssignment.create).toHaveBeenCalledTimes(1);
      },
    );

    it("still refuses a clinical template", async () => {
      await expect(assign("template-soap")).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(mockedPrisma.formAssignment.create).not.toHaveBeenCalled();
    });
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

  it("normalizes viewed, submitted, signed, and expired assignment statuses", async () => {
    const baseRow = {
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
    };
    mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
      { ...baseRow, id: "assignment-viewed", status: "VIEWED" },
      { ...baseRow, id: "assignment-submitted", status: "SUBMITTED" },
      { ...baseRow, id: "assignment-signed", status: "SIGNED" },
      { ...baseRow, id: "assignment-expired", status: "EXPIRED" },
    ]);

    const rows = await FormAssignmentService.listForAppointment(
      "org-1",
      "appt-1",
    );

    expect(rows.map((row) => row.status)).toEqual([
      "viewed",
      "submitted",
      "signed",
      "expired",
    ]);
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

  // A template published again after it was sent submits at the newer
  // version; matching on the version too left the assignment open for good.
  describe("matching a submission to its assignment", () => {
    const assignment = (id: string, templateVersion: number) => ({
      id,
      templateVersion,
      status: "SENT",
      appointment: { patient: { parent: { id: "parent-1" } } },
    });

    // A co-parent answers the appointment's request as well as its primary
    // parent does; access to the appointment was checked on submitting.
    it("finds the appointment's assignment for a co-parent's submission", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
        assignment("assignment-1", 3),
      ]);
      mockedPrisma.formAssignment.update.mockResolvedValueOnce({
        id: "assignment-1",
      });

      await FormAssignmentService.markSubmittedFromSubmission({
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 3,
        appointmentId: "appt-1",
        parentId: "co-parent-2",
      });

      expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "assignment-1" } }),
      );
    });

    it("still matches the parent without an appointment", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
        assignment("assignment-1", 3),
      ]);

      await expect(
        FormAssignmentService.markSubmittedFromSubmission({
          organisationId: "org-1",
          templateId: "template-1",
          templateVersion: 3,
          parentId: "co-parent-2",
        }),
      ).resolves.toBeNull();
      expect(mockedPrisma.formAssignment.update).not.toHaveBeenCalled();
    });

    it("finds the appointment's assignment whatever version was submitted", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
        assignment("assignment-v1", 1),
      ]);
      mockedPrisma.formAssignment.update.mockResolvedValueOnce({
        id: "assignment-v1",
      });

      await FormAssignmentService.markSubmittedFromSubmission({
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 3,
        appointmentId: "appt-1",
        parentId: "parent-1",
      });

      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: "org-1",
            templateId: "template-1",
            appointmentId: "appt-1",
          },
        }),
      );
      expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "assignment-v1" } }),
      );
    });

    it("prefers the assignment sent at the submitted version", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
        assignment("assignment-v1", 1),
        assignment("assignment-v3", 3),
      ]);
      mockedPrisma.formAssignment.update.mockResolvedValueOnce({
        id: "assignment-v3",
      });

      await FormAssignmentService.markSubmittedFromSubmission({
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 3,
        appointmentId: "appt-1",
        parentId: "parent-1",
      });

      expect(mockedPrisma.formAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "assignment-v3" } }),
      );
    });

    it("still matches on the version without an appointment", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([]);

      await expect(
        FormAssignmentService.markSubmittedFromSubmission({
          organisationId: "org-1",
          templateId: "template-1",
          templateVersion: 3,
        }),
      ).resolves.toBeNull();

      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: "org-1",
            templateId: "template-1",
            templateVersion: 3,
          },
        }),
      );
    });
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
      // With no parentId there is nothing to push down, so the query stays minimal.
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

    it("normalizes viewed, submitted, expired, and cancelled lifecycle statuses", async () => {
      const baseRow = {
        templateId: "tpl-1",
        templateVersion: 1,
        companionId: "comp-1",
        appointmentId: null,
        signingRequired: true,
        mobileVisible: true,
        sentAt: null,
        viewedAt: null,
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        template: { name: "Intake Form" },
        companion: { name: "Milo" },
      };
      mockedPrisma.formAssignment.findMany.mockResolvedValue([
        { ...baseRow, id: "fa-viewed", status: "VIEWED" },
        { ...baseRow, id: "fa-submitted", status: "SUBMITTED" },
        { ...baseRow, id: "fa-expired", status: "EXPIRED" },
        { ...baseRow, id: "fa-cancelled", status: "CANCELLED" },
      ]);

      const result = await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
      });

      expect(result.map((item) => item.status)).toEqual([
        "VIEWED",
        "SUBMITTED",
        "EXPIRED",
        "CANCELLED",
      ]);
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

    it("filters by parent in the query rather than in memory", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValue([]);

      await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
        parentId: "par-9",
      });

      expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org-1",
            appointment: {
              is: { patient: { path: ["parent", "id"], equals: "par-9" } },
            },
          }),
        }),
      );
    });

    it("bounds the organisation query so it cannot scan the whole table", async () => {
      mockedPrisma.formAssignment.findMany.mockResolvedValue([]);

      await FormAssignmentService.listForOrganisation({
        organisationId: "org-1",
      });

      const [args] = mockedPrisma.formAssignment.findMany.mock.calls.at(-1) as [
        { take?: number },
      ];
      expect(args.take).toBe(500);
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
