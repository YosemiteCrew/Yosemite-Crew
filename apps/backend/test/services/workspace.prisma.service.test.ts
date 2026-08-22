import { prisma } from "src/config/prisma";
import { FormAssignmentService } from "src/services/form-assignment.service";
import { ClinicalArtifactService } from "src/services/clinical-artifact.service";
import {
  WorkspaceService,
  WorkspaceServiceError,
  dedupeTreatmentItemsByPrescription,
} from "../../src/services/workspace.prisma.service";
import {
  InvoiceService,
  InvoiceServiceError,
} from "src/services/invoice.service";
import { createRenderedDocumentRecord } from "src/services/rendered-document.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: { findFirst: jest.fn() },
    encounter: { findFirst: jest.fn(), findMany: jest.fn() },
    case: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn(), findMany: jest.fn() },
    organization: { findUnique: jest.fn() },
    patient: { findFirst: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    parent: { findFirst: jest.fn() },
    admission: { findUnique: jest.fn() },
    productItem: { findFirst: jest.fn(), findMany: jest.fn() },
    task: { findMany: jest.fn() },
    taskSchedule: { findMany: jest.fn() },
    templateInstance: { findMany: jest.fn() },
    document: { findMany: jest.fn() },
    renderedDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    prescriptionDispenseRequest: { findMany: jest.fn() },
    workspaceTreatmentItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    labOrder: { findMany: jest.fn() },
    labResult: { findMany: jest.fn() },
    financeEvent: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    syncLinkedTemplateAssignmentsForAppointment: jest.fn(),
    listAppointmentFormSummaries: jest.fn(),
  },
}));

jest.mock("src/services/invoice.service", () => ({
  __esModule: true,
  InvoiceService: {
    findOpenInvoiceForAppointment: jest.fn(),
    bootstrapForAppointment: jest.fn(),
    addItemsToInvoice: jest.fn(),
  },
  InvoiceServiceError: class InvoiceServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "InvoiceServiceError";
    }
  },
}));

jest.mock("src/services/rendered-document.service", () => ({
  __esModule: true,
  createRenderedDocumentRecord: jest.fn(),
}));

jest.mock("src/services/clinical-artifact.service", () => ({
  ClinicalArtifactService: {
    listSoapNotesForAppointment: jest.fn(),
    listSoapNotesForEncounter: jest.fn(),
    listPrescriptionsForAppointment: jest.fn(),
    listPrescriptionsForEncounter: jest.fn(),
    listDischargeSummariesForAppointment: jest.fn(),
    listDischargeSummariesForEncounter: jest.fn(),
    listVitalRecordsForAppointment: jest.fn(),
    listVitalRecordsForEncounter: jest.fn(),
  },
}));

describe("WorkspaceService", () => {
  const mockedPrisma = prisma as unknown as {
    appointment: { findFirst: jest.Mock };
    encounter: { findFirst: jest.Mock; findMany: jest.Mock };
    case: { findFirst: jest.Mock };
    invoice: { findFirst: jest.Mock; findMany: jest.Mock };
    organization: { findUnique: jest.Mock };
    patient: { findFirst: jest.Mock };
    patientOrganisation: { findFirst: jest.Mock };
    parent: { findFirst: jest.Mock };
    admission: { findUnique: jest.Mock };
    productItem: { findFirst: jest.Mock; findMany: jest.Mock };
    task: { findMany: jest.Mock };
    taskSchedule: { findMany: jest.Mock };
    templateInstance: { findMany: jest.Mock };
    document: { findMany: jest.Mock };
    renderedDocument: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    prescriptionDispenseRequest: { findMany: jest.Mock };
    workspaceTreatmentItem: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    labOrder: { findMany: jest.Mock };
    labResult: { findMany: jest.Mock };
    financeEvent: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  const mockedFormService = FormAssignmentService as unknown as {
    syncLinkedTemplateAssignmentsForAppointment: jest.Mock;
    listAppointmentFormSummaries: jest.Mock;
  };
  const mockedInvoiceService = InvoiceService as unknown as {
    findOpenInvoiceForAppointment: jest.Mock;
    bootstrapForAppointment: jest.Mock;
    addItemsToInvoice: jest.Mock;
  };
  const mockedClinicalArtifactService = ClinicalArtifactService as unknown as {
    listSoapNotesForAppointment: jest.Mock;
    listSoapNotesForEncounter: jest.Mock;
    listPrescriptionsForAppointment: jest.Mock;
    listPrescriptionsForEncounter: jest.Mock;
    listDischargeSummariesForAppointment: jest.Mock;
    listDischargeSummariesForEncounter: jest.Mock;
    listVitalRecordsForAppointment: jest.Mock;
    listVitalRecordsForEncounter: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedPrisma.appointment.findFirst.mockResolvedValue(null);
    mockedPrisma.encounter.findFirst.mockResolvedValue(null);
    mockedPrisma.case.findFirst.mockResolvedValue(null);
    mockedPrisma.invoice.findFirst.mockResolvedValue(null);
    mockedPrisma.invoice.findMany.mockResolvedValue([]);
    mockedPrisma.organization.findUnique.mockResolvedValue(null);
    mockedPrisma.patient.findFirst.mockResolvedValue(null);
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue(null);
    mockedPrisma.parent.findFirst.mockResolvedValue(null);
    mockedPrisma.admission.findUnique.mockResolvedValue(null);
    mockedPrisma.productItem.findFirst.mockResolvedValue(null);
    mockedPrisma.task.findMany.mockResolvedValue([]);
    mockedPrisma.taskSchedule.findMany.mockResolvedValue([]);
    mockedPrisma.templateInstance.findMany.mockResolvedValue([]);
    mockedPrisma.document.findMany.mockResolvedValue([]);
    mockedPrisma.renderedDocument.findMany.mockResolvedValue([]);
    mockedPrisma.renderedDocument.findFirst.mockResolvedValue(null);
    mockedPrisma.renderedDocument.create.mockResolvedValue({
      id: "rendered-schedule-1",
    });
    mockedPrisma.prescriptionDispenseRequest.findMany.mockResolvedValue([]);
    mockedPrisma.productItem.findMany.mockResolvedValue([]);
    mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([]);
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValue(null);
    mockedPrisma.encounter.findMany.mockResolvedValue([]);
    mockedPrisma.labOrder.findMany.mockResolvedValue([]);
    mockedPrisma.labResult.findMany.mockResolvedValue([]);
    mockedInvoiceService.findOpenInvoiceForAppointment.mockResolvedValue(null);
    mockedInvoiceService.bootstrapForAppointment.mockResolvedValue(null);
    mockedInvoiceService.addItemsToInvoice.mockResolvedValue(null);

    mockedFormService.listAppointmentFormSummaries.mockResolvedValue([
      {
        assignmentId: "assignment-1",
        id: "assignment-1",
        organisationId: "org-1",
        templateId: "template-1",
        templateVersion: 1,
        appointmentId: "appt-1",
        encounterId: "enc-1",
        companionId: "patient-1",
        signerUserId: null,
        signerName: null,
        signerEmail: null,
        signerRole: null,
        mobileVisible: true,
        signingRequired: true,
        status: "pending",
        assignmentStatus: "sent",
        sentAt: new Date("2026-06-14T10:00:00.000Z"),
        viewedAt: null,
        submittedAt: null,
        signedAt: null,
        expiredAt: null,
        cancelledAt: null,
        signerIdentity: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);
    mockedFormService.syncLinkedTemplateAssignmentsForAppointment.mockResolvedValue(
      undefined,
    );

    mockedClinicalArtifactService.listSoapNotesForAppointment.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listSoapNotesForEncounter.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listPrescriptionsForAppointment.mockResolvedValue(
      [
        {
          artifact: {
            id: "prescription-1",
            status: "IN_PROGRESS",
            createdAt: new Date("2026-06-15T00:00:00.000Z"),
            updatedAt: new Date("2026-06-15T00:00:00.000Z"),
          },
          prescription: {
            medications: [{ name: "Amoxicillin" }],
          },
        },
      ],
    );
    mockedClinicalArtifactService.listPrescriptionsForEncounter.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listDischargeSummariesForAppointment.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listDischargeSummariesForEncounter.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listVitalRecordsForAppointment.mockResolvedValue(
      [],
    );
    mockedClinicalArtifactService.listVitalRecordsForEncounter.mockResolvedValue(
      [],
    );
  });

  it("builds the appointment bootstrap aggregate with derived action and permissions", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-1",
      organisationId: "org-1",
      status: "UPCOMING",
      appointmentKind: "OUTPATIENT",
      concern: "Annual review",
      productItemId: "pkg-1",
      encounterId: "enc-1",
      caseId: "case-1",
      patient: { id: "patient-1", parent: { id: "parent-1" } },
      startTime: new Date("2026-06-15T10:00:00.000Z"),
      endTime: new Date("2026-06-15T10:30:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-1",
      organisationId: "org-1",
      caseId: "case-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "onleave",
      encounterClass: "IMP",
      appointmentKind: "OUTPATIENT",
      title: "Annual review",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedClinicalArtifactService.listPrescriptionsForEncounter.mockResolvedValue(
      [
        {
          artifact: {
            id: "prescription-1",
            status: "IN_PROGRESS",
            createdAt: new Date("2026-06-15T00:00:00.000Z"),
            updatedAt: new Date("2026-06-15T00:00:00.000Z"),
          },
          prescription: {
            medications: [{ name: "Amoxicillin" }],
          },
        },
      ],
    );
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-1",
      organisationId: "org-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "active",
      appointmentKind: "OUTPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.productItem.findFirst.mockResolvedValue({
      kind: "PACKAGE",
    });
    mockedPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      visitBillingStage: "READY_FOR_BILLING",
      readyForBillingAt: new Date("2026-06-15T12:00:00.000Z"),
      readyForBillingActorId: "user-1",
    });
    // #1910: the appointment's invoice PDF (an INVOICE rendered document) must be pulled into the
    // All Documents set by matching its sourceId to the appointment's invoice ids.
    mockedPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);
    mockedPrisma.user.findUnique.mockResolvedValue({
      firstName: "Dr",
      lastName: "Ready",
      email: "ready@example.com",
    });
    mockedPrisma.organization.findUnique.mockResolvedValue({
      appointmentLockWindowOutpatientMinutes: 30,
      appointmentLockWindowInpatientMinutes: null,
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-1",
      name: "Buddy",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.parent.findFirst.mockResolvedValue({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.task.findMany.mockResolvedValue([
      {
        id: "task-1",
        status: "IN_PROGRESS",
        dueAt: new Date("2026-06-15T09:00:00.000Z"),
      },
    ]);
    mockedPrisma.labOrder.findMany.mockResolvedValue([
      {
        id: "order-1",
        provider: "IDEXX",
        appointmentId: "appt-1",
        status: "SUBMITTED",
        idexxOrderId: "idexx-1",
        tests: ["CBC"],
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);
    mockedPrisma.labResult.findMany.mockResolvedValue([
      {
        id: "result-1",
        provider: "IDEXX",
        status: "COMPLETE",
        createdAt: new Date("2026-06-14T10:00:00.000Z"),
        updatedAt: new Date("2026-06-14T10:00:00.000Z"),
      },
    ]);
    mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([
      {
        id: "ti-dx-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        encounterId: "enc-1",
        productId: "pkg-1",
        productVersion: 1,
        productSnapshot: { name: "Lab Package" },
        servicePackageKind: "PACKAGE",
        quantity: 1,
        priceSnapshot: { totalAmount: 120 },
        billingStatus: "UNBILLED",
        invoiceRowId: null,
        lockState: null,
        prescriptionId: null,
        createdAt: new Date("2026-06-14T11:00:00.000Z"),
        updatedAt: new Date("2026-06-14T11:00:00.000Z"),
      },
    ]);
    mockedPrisma.productItem.findMany.mockResolvedValue([
      {
        id: "pkg-1",
        organisationId: "org-1",
        name: "Lab Package",
        code: "PKG-LAB",
        kind: "PACKAGE",
        createdAt: new Date("2026-06-14T11:00:00.000Z"),
        updatedAt: new Date("2026-06-14T11:00:00.000Z"),
        package: {
          items: [
            {
              id: "pkg-item-1",
              sortOrder: 0,
              childProductItem: {
                id: "lab-test-1",
                name: "CBC",
                code: "IDEXX-CBC",
                kind: "LAB_TEST",
                createdAt: new Date("2026-06-14T11:00:00.000Z"),
                updatedAt: new Date("2026-06-14T11:00:00.000Z"),
              },
            },
          ],
        },
      },
    ]);

    const result = await WorkspaceService.getAppointmentBootstrap(
      {
        organisationId: "org-1",
        appointmentId: "appt-1",
      },
      [
        "appointments:view:any",
        "tasks:view:any",
        "forms:view:any",
        "prescription:view:any",
        "labs:view:any",
        "document:view:any",
        "billing:view:any",
      ],
    );

    expect(result.organisationId).toBe("org-1");
    expect(result.appointment?.id).toBe("appt-1");
    expect(result.appointment).toEqual(
      expect.objectContaining({
        productItemId: "pkg-1",
        productKind: "PACKAGE",
      }),
    );
    expect(result.companion?.id).toBe("patient-1");
    expect(result.client?.id).toBe("parent-1");
    expect(result.permissions.canViewAppointments).toBe(true);
    expect(result.permissions.canViewTasks).toBe(true);
    expect(result.permissions.canEditSoap).toBe(false);
    expect(result.permissions.canPrescribe).toBe(false);
    expect(result.permissions.canSignDocuments).toBe(false);
    expect(result.permissions.canDischarge).toBe(false);
    expect(result.permissions.canAssignTasks).toBe(false);
    expect(result.permissions.canResumeSchedules).toBe(false);
    expect(result.permissions.canCancelSchedules).toBe(false);
    expect(result.locks).toEqual(
      expect.objectContaining({
        appointment: true,
        encounter: true,
        episodeOfCare: true,
        templateInstances: true,
        clinicalArtifacts: true,
        prescriptions: true,
        documents: true,
        treatmentItems: true,
      }),
    );
    expect(result.forms).toEqual([
      expect.objectContaining({
        assignmentId: "assignment-1",
        status: "pending",
        assignmentStatus: "sent",
      }),
    ]);
    expect(result.primaryAction.kind).toBe("COMPLETE_FORMS");
    expect(result.primaryAction.enabled).toBe(false);
    expect(result.primaryAction.disabledReason).toBe(
      "You do not have permission to edit clinical forms.",
    );
    expect(result.finalizationGate).toEqual(
      expect.objectContaining({
        enabled: false,
        disabledReason: "Required forms are still pending.",
        requiredSoapOrDischargeComplete: true,
        requiredFormsSigned: false,
        pendingLabsResolved: false,
        billingReady: true,
        pendingDispenseRequestsResolved: true,
        inpatientRoomAdmissionReady: true,
        requiredTasksComplete: false,
      }),
    );
    expect(result.treatmentItems).toHaveLength(2);
    expect(result.diagnosticQueue).toHaveLength(3);
    expect(result.labSummary.pendingCount).toBe(1);
    expect(result.labSummary.hasLabs).toBe(true);
    expect(result.labSummary.resultedCount).toBe(1);
    expect(result.labSummary.failedCount).toBe(0);
    expect(result.labSummary.requiredPendingCount).toBe(1);
    expect(result.labSummary.providers).toEqual(["IDEXX"]);
    expect(result.labSummary.latestStatus).toBe("PARTIAL");
    expect(result.labSummary.blockingFinalization).toBe(true);
    expect(result).toEqual(
      expect.objectContaining({
        visitBillingStage: "READY_FOR_BILLING",
        readyForBilling: true,
        readyForDischarge: true,
        invoice: expect.objectContaining({
          id: "invoice-1",
          visitBillingStage: "READY_FOR_BILLING",
          readyForBillingAt: new Date("2026-06-15T12:00:00.000Z"),
          readyForBillingActorId: "user-1",
        }),
        readyForBillingByName: "Dr Ready",
      }),
    );
    expect(result.diagnosticQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "PROVIDER_TEST",
          provider: "IDEXX",
          providerTestCode: "IDEXX-CBC",
          sourceKind: "PACKAGE_ITEM",
          sourcePackageId: "pkg-1",
        }),
      ]),
    );
    expect(mockedFormService.listAppointmentFormSummaries).toHaveBeenCalledWith(
      "org-1",
      "appt-1",
    );
    // The bootstrap is a READ. Materialising linked-template assignments is a
    // `forms:edit:any` action, so a viewer without it syncs nothing - opening an
    // appointment used to persist client-visible consent requests on their behalf.
    expect(
      mockedFormService.syncLinkedTemplateAssignmentsForAppointment,
    ).toHaveBeenCalledWith({
      organisationId: "org-1",
      appointmentId: "appt-1",
      canManageForms: false,
    });
    // #1910: the rendered-document query must include an INVOICE sourceId condition built from the
    // appointment's invoice ids, so the invoice PDF is surfaced in All Documents.
    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledWith({
      where: { appointmentId: "appt-1" },
      select: { id: true },
    });
    const renderedDocumentQuery =
      mockedPrisma.renderedDocument.findMany.mock.calls.at(-1)?.[0];
    expect(renderedDocumentQuery?.where?.OR).toEqual(
      expect.arrayContaining([
        { sourceKind: "INVOICE", sourceId: { in: ["invoice-1"] } },
        {
          clinicalArtifact: {
            is: { appointmentId: "appt-1" },
          },
        },
      ]),
    );
    expect(renderedDocumentQuery?.where?.NOT).toEqual({
      clinicalArtifact: {
        is: { status: "VOID" },
      },
    });
  });

  it("returns a bootstrap payload without billing state when no invoice is open", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-2",
      organisationId: "org-1",
      status: "UPCOMING",
      appointmentKind: "OUTPATIENT",
      concern: "Annual review",
      productItemId: "pkg-1",
      encounterId: "enc-2",
      caseId: "case-2",
      patient: { id: "patient-2", parent: { id: "parent-2" } },
      startTime: new Date("2026-06-15T10:00:00.000Z"),
      endTime: new Date("2026-06-15T10:30:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-2",
      organisationId: "org-1",
      caseId: "case-2",
      patientId: "patient-2",
      parentId: "parent-2",
      status: "onleave",
      encounterClass: "IMP",
      appointmentKind: "OUTPATIENT",
      title: "Annual review",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-2",
      organisationId: "org-1",
      patientId: "patient-2",
      parentId: "parent-2",
      status: "active",
      appointmentKind: "OUTPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.productItem.findFirst.mockResolvedValue({
      kind: "PACKAGE",
    });
    mockedPrisma.organization.findUnique.mockResolvedValue({
      appointmentLockWindowOutpatientMinutes: 30,
      appointmentLockWindowInpatientMinutes: null,
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-2",
      name: "Buddy",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.parent.findFirst.mockResolvedValue({
      id: "parent-2",
      firstName: "Jane",
      lastName: "Doe",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.task.findMany.mockResolvedValue([]);
    mockedPrisma.labOrder.findMany.mockResolvedValue([]);
    mockedPrisma.labResult.findMany.mockResolvedValue([]);
    mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([]);
    mockedPrisma.productItem.findMany.mockResolvedValue([]);

    const result = (await WorkspaceService.getAppointmentBootstrap(
      {
        organisationId: "org-1",
        appointmentId: "appt-2",
      },
      [],
    )) as unknown as {
      invoice: unknown;
      visitBillingStage: string | null;
      readyForBilling: boolean;
      readyForBillingByName: string | null;
    };

    expect(result.invoice).toBeNull();
    expect(result.visitBillingStage).toBeNull();
    expect(result.readyForBilling).toBe(false);
    expect(result.readyForBillingByName).toBeNull();
  });

  it("omits the appointment invoice document when the caller lacks billing permission", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-3",
      organisationId: "org-1",
      status: "UPCOMING",
      appointmentKind: "OUTPATIENT",
      concern: "Annual review",
      productItemId: null,
      encounterId: "enc-3",
      caseId: "case-3",
      patient: { id: "patient-3", parent: { id: "parent-3" } },
      startTime: new Date("2026-06-15T10:00:00.000Z"),
      endTime: new Date("2026-06-15T10:30:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-3",
      organisationId: "org-1",
      caseId: "case-3",
      patientId: "patient-3",
      parentId: "parent-3",
      status: "onleave",
      encounterClass: "IMP",
      appointmentKind: "OUTPATIENT",
      title: "Annual review",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.organization.findUnique.mockResolvedValue({
      appointmentLockWindowOutpatientMinutes: 30,
      appointmentLockWindowInpatientMinutes: null,
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-3",
      name: "Buddy",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.parent.findFirst.mockResolvedValue({
      id: "parent-3",
      firstName: "Jane",
      lastName: "Doe",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    // An open invoice exists for the appointment, but a document-view-only caller must never receive
    // its PDF: INVOICE rendered documents are financial and require billing:view:any (mirrors the
    // rendered-document controller's access rule).
    mockedPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);

    await WorkspaceService.getAppointmentBootstrap(
      {
        organisationId: "org-1",
        appointmentId: "appt-3",
      },
      [
        "appointments:view:any",
        "tasks:view:any",
        "forms:view:any",
        "prescription:view:any",
        "labs:view:any",
        "document:view:any",
      ],
    );

    // The invoice-id lookup that feeds the INVOICE sourceId condition must be skipped entirely.
    expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalledWith({
      where: { appointmentId: "appt-3" },
      select: { id: true },
    });
    const renderedDocumentQuery =
      mockedPrisma.renderedDocument.findMany.mock.calls.at(-1)?.[0];
    const orConditions = (renderedDocumentQuery?.where?.OR ?? []) as Array<{
      sourceKind?: string;
    }>;
    expect(
      orConditions.some((condition) => condition.sourceKind === "INVOICE"),
    ).toBe(false);
  });

  it("manages persisted treatment items", async () => {
    mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([
      {
        id: "ti-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        encounterId: "enc-1",
        productId: "prod-1",
        productVersion: 2,
        productSnapshot: { name: "Medication" },
        servicePackageKind: "PRESCRIPTION",
        quantity: 1,
        priceSnapshot: { totalAmount: 25 },
        billingStatus: "UNBILLED",
        invoiceRowId: null,
        lockState: { locked: false },
        prescriptionId: null,
        createdAt: new Date("2026-06-15T00:00:00.000Z"),
        updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      },
      {
        id: "ti-1b",
        organisationId: "org-1",
        appointmentId: "appt-1",
        encounterId: "enc-1",
        productId: "prod-1b",
        productVersion: 1,
        productSnapshot: { name: "Bandage" },
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: { totalAmount: 10 },
        billingStatus: "UNBILLED",
        invoiceRowId: null,
        lockState: "LOCKED",
        prescriptionId: null,
        createdAt: new Date("2026-06-15T00:00:00.000Z"),
        updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.workspaceTreatmentItem.create.mockResolvedValue({
      id: "ti-2",
      organisationId: "org-1",
      appointmentId: null,
      encounterId: "enc-1",
      productId: "prod-2",
      productVersion: null,
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 2,
      priceSnapshot: { totalAmount: 40 },
      billingStatus: "UNBILLED",
      invoiceRowId: null,
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    });
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValue({
      id: "ti-2",
    });
    mockedPrisma.workspaceTreatmentItem.update.mockResolvedValue({
      id: "ti-2",
      organisationId: "org-1",
      appointmentId: null,
      encounterId: "enc-1",
      productId: "prod-2",
      productVersion: null,
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 3,
      priceSnapshot: { totalAmount: 45 },
      billingStatus: "BILLED",
      invoiceRowId: "invoice-row-1",
      lockState: { locked: true },
      prescriptionId: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T01:00:00.000Z"),
    });

    const items = await WorkspaceService.getEncounterTreatmentItems({
      organisationId: "org-1",
      encounterId: "enc-1",
    });
    expect(items).toHaveLength(2);
    expect(items[0].lockState).toEqual({ locked: false });
    expect(items[1].lockState).toBe("LOCKED");

    const created = await WorkspaceService.createEncounterTreatmentItem({
      organisationId: "org-1",
      encounterId: "enc-1",
      productId: "prod-2",
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 2,
      priceSnapshot: { totalAmount: 40 },
    });
    expect(created.productId).toBe("prod-2");

    // The lock window is surfaced to clients as `locks.treatmentItems`, but it
    // has to be enforced here too - a caller ignoring the UI could otherwise add
    // charges long after an appointment's billing window closed.
    mockedPrisma.organization.findUnique.mockResolvedValue({
      appointmentLockWindowOutpatientMinutes: 0,
      appointmentLockWindowInpatientMinutes: 0,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      startTime: new Date("2020-01-01T00:00:00.000Z"),
      appointmentKind: "OUTPATIENT",
    });

    await expect(
      WorkspaceService.createEncounterTreatmentItem({
        organisationId: "org-1",
        encounterId: "enc-1",
        appointmentId: "appt-1",
        productId: "prod-3",
        productSnapshot: { name: "Late charge" },
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: { totalAmount: 10 },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    mockedPrisma.organization.findUnique.mockResolvedValue(null);
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);

    const updated = await WorkspaceService.updateTreatmentItem(
      "ti-2",
      "org-1",
      {
        quantity: 3,
        billingStatus: "BILLED",
        invoiceRowId: "invoice-row-1",
        lockState: { locked: true },
      },
    );
    expect(updated.billingStatus).toBe("BILLED");

    await WorkspaceService.deleteTreatmentItem("ti-2", "org-1");
    expect(mockedPrisma.workspaceTreatmentItem.delete).toHaveBeenCalledWith({
      where: { id: "ti-2" },
    });
  });

  it("syncs a treatment item into the active invoice and marks it billed", async () => {
    mockedInvoiceService.findOpenInvoiceForAppointment.mockResolvedValueOnce({
      id: "invoice-1",
    });
    mockedPrisma.workspaceTreatmentItem.create.mockResolvedValueOnce({
      id: "ti-sync",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-sync",
      productVersion: null,
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 2,
      priceSnapshot: {
        name: "Procedure",
        grossAmount: 40,
        finalAmount: 36,
        discountPercent: 10,
        unitPrice: 20,
      },
      billingStatus: "UNBILLED",
      invoiceRowId: null,
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    });
    mockedPrisma.workspaceTreatmentItem.update.mockResolvedValueOnce({
      id: "ti-sync",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-sync",
      productVersion: null,
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 2,
      priceSnapshot: {
        name: "Procedure",
        grossAmount: 40,
        finalAmount: 36,
        discountPercent: 10,
        unitPrice: 20,
      },
      billingStatus: "BILLED",
      invoiceRowId: "ti-sync",
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T01:00:00.000Z"),
    });
    mockedInvoiceService.addItemsToInvoice.mockResolvedValueOnce({
      id: "invoice-1",
    });

    const created = await WorkspaceService.createEncounterTreatmentItem({
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-sync",
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 2,
      priceSnapshot: {
        name: "Procedure",
        grossAmount: 40,
        finalAmount: 36,
        discountPercent: 10,
        unitPrice: 20,
      },
    });

    expect(
      mockedInvoiceService.findOpenInvoiceForAppointment,
    ).toHaveBeenCalledWith("appt-1", "org-1");
    expect(mockedInvoiceService.addItemsToInvoice).toHaveBeenCalledWith(
      "invoice-1",
      [
        expect.objectContaining({
          id: "ti-sync",
          quantity: 2,
          unitPrice: 20,
          total: 36,
        }),
      ],
    );
    expect(mockedPrisma.workspaceTreatmentItem.update).toHaveBeenCalledWith({
      where: { id: "ti-sync" },
      data: {
        billingStatus: "BILLED",
        invoiceRowId: "ti-sync",
      },
    });
    expect(created.billingStatus).toBe("BILLED");
    expect(created.invoiceRowId).toBe("ti-sync");
  });

  it("bootstraps an appointment invoice before syncing a treatment item when none is open", async () => {
    mockedInvoiceService.findOpenInvoiceForAppointment.mockResolvedValueOnce(
      null,
    );
    mockedInvoiceService.bootstrapForAppointment.mockResolvedValueOnce({
      id: "invoice-bootstrap",
      status: "AWAITING_PAYMENT",
    });
    mockedPrisma.workspaceTreatmentItem.create.mockResolvedValueOnce({
      id: "ti-bootstrap",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-bootstrap",
      productVersion: null,
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 1,
      priceSnapshot: {
        name: "Procedure",
        grossAmount: 40,
        finalAmount: 36,
        discountPercent: 10,
        unitPrice: 40,
      },
      billingStatus: "UNBILLED",
      invoiceRowId: null,
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    });
    mockedPrisma.workspaceTreatmentItem.update.mockResolvedValueOnce({
      id: "ti-bootstrap",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-bootstrap",
      productVersion: null,
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 1,
      priceSnapshot: {
        name: "Procedure",
        grossAmount: 40,
        finalAmount: 36,
        discountPercent: 10,
        unitPrice: 40,
      },
      billingStatus: "BILLED",
      invoiceRowId: "ti-bootstrap",
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T01:00:00.000Z"),
    });
    mockedInvoiceService.addItemsToInvoice.mockResolvedValueOnce({
      id: "invoice-bootstrap",
    });

    const created = await WorkspaceService.createEncounterTreatmentItem({
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-bootstrap",
      productSnapshot: { name: "Procedure" },
      servicePackageKind: "PROCEDURE",
      quantity: 1,
      priceSnapshot: {
        name: "Procedure",
        grossAmount: 40,
        finalAmount: 36,
        discountPercent: 10,
        unitPrice: 40,
      },
    });

    expect(
      mockedInvoiceService.findOpenInvoiceForAppointment,
    ).toHaveBeenCalledWith("appt-1", "org-1");
    // Bound to the treatment item's own organisation, so a body-supplied
    // appointment id from another tenant cannot bootstrap that tenant's invoice.
    expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
      "appt-1",
      undefined,
      "org-1",
    );
    expect(mockedInvoiceService.addItemsToInvoice).toHaveBeenCalledWith(
      "invoice-bootstrap",
      [
        expect.objectContaining({
          id: "ti-bootstrap",
        }),
      ],
    );
    expect(created.billingStatus).toBe("BILLED");
    expect(created.invoiceRowId).toBe("ti-bootstrap");
  });

  it("does not reattach a treatment item that was already settled", async () => {
    mockedPrisma.workspaceTreatmentItem.create.mockResolvedValueOnce({
      id: "ti-settled",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-settled",
      productVersion: null,
      productSnapshot: { name: "Medication" },
      servicePackageKind: "PRESCRIPTION",
      quantity: 1,
      priceSnapshot: { name: "Medication", finalAmount: 25 },
      billingStatus: "BILLED",
      invoiceRowId: "ti-settled",
      settledInvoiceId: "invoice-paid",
      settledAt: new Date("2026-06-30T10:00:00.000Z"),
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-30T09:00:00.000Z"),
      updatedAt: new Date("2026-06-30T10:00:00.000Z"),
    });

    const created = await WorkspaceService.createEncounterTreatmentItem({
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-settled",
      productSnapshot: { name: "Medication" },
      servicePackageKind: "PRESCRIPTION",
      quantity: 1,
      priceSnapshot: { name: "Medication", finalAmount: 25 },
    });

    expect(created.settled).toBe(true);
    expect(
      mockedInvoiceService.findOpenInvoiceForAppointment,
    ).not.toHaveBeenCalled();
    expect(mockedInvoiceService.addItemsToInvoice).not.toHaveBeenCalled();
  });

  it("reopens the canonical paid invoice for a new treatment item", async () => {
    mockedInvoiceService.bootstrapForAppointment.mockResolvedValueOnce({
      id: "invoice-paid",
      status: "PAID",
    });
    mockedPrisma.workspaceTreatmentItem.create.mockResolvedValueOnce({
      id: "ti-new",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-new",
      productVersion: null,
      productSnapshot: { name: "Lab" },
      servicePackageKind: "PROCEDURE",
      quantity: 1,
      priceSnapshot: { name: "Lab", finalAmount: 30 },
      billingStatus: "UNBILLED",
      invoiceRowId: null,
      settledInvoiceId: null,
      settledAt: null,
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-30T11:00:00.000Z"),
      updatedAt: new Date("2026-06-30T11:00:00.000Z"),
    });
    mockedPrisma.workspaceTreatmentItem.update.mockResolvedValueOnce({
      id: "ti-new",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-new",
      productVersion: null,
      productSnapshot: { name: "Lab" },
      servicePackageKind: "PROCEDURE",
      quantity: 1,
      priceSnapshot: { name: "Lab", finalAmount: 30 },
      billingStatus: "BILLED",
      invoiceRowId: "ti-new",
      settledInvoiceId: null,
      settledAt: null,
      lockState: null,
      prescriptionId: null,
      createdAt: new Date("2026-06-30T11:00:00.000Z"),
      updatedAt: new Date("2026-06-30T11:01:00.000Z"),
    });

    await WorkspaceService.createEncounterTreatmentItem({
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      productId: "prod-new",
      productSnapshot: { name: "Lab" },
      servicePackageKind: "PROCEDURE",
      quantity: 1,
      priceSnapshot: { name: "Lab", finalAmount: 30 },
    });

    expect(mockedInvoiceService.addItemsToInvoice).toHaveBeenCalledWith(
      "invoice-paid",
      [expect.objectContaining({ id: "ti-new" })],
    );
  });

  it("preserves prescription classification when updating a linked treatment row", async () => {
    const existing = {
      id: "ti-prescription",
      organisationId: "org-1",
      appointmentId: null,
      encounterId: "enc-1",
      productId: "med-1",
      productVersion: null,
      productSnapshot: { name: "Medication" },
      servicePackageKind: "MEDICATION",
      quantity: 1,
      priceSnapshot: { unitPrice: 25 },
      billingStatus: "BILLED",
      invoiceRowId: "ti-prescription",
      settledInvoiceId: "invoice-paid",
      settledAt: new Date("2026-06-30T10:00:00.000Z"),
      lockState: null,
      prescriptionId: "prescription-1",
      createdAt: new Date("2026-06-30T09:00:00.000Z"),
      updatedAt: new Date("2026-06-30T10:00:00.000Z"),
    };
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValueOnce(
      existing,
    );
    mockedPrisma.workspaceTreatmentItem.update.mockResolvedValueOnce(existing);

    const updated = await WorkspaceService.updateTreatmentItem(
      existing.id,
      existing.organisationId,
      { servicePackageKind: "SERVICE" },
    );

    expect(mockedPrisma.workspaceTreatmentItem.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        servicePackageKind: "MEDICATION",
      }),
    });
    expect(updated.servicePackageKind).toBe("MEDICATION");
    expect(updated.prescriptionId).toBe("prescription-1");
  });

  it("builds the encounter bootstrap even when no linked appointment is resolved", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-2",
      organisationId: "org-2",
      caseId: "case-2",
      patientId: "patient-2",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: "Admit",
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-2",
      organisationId: "org-2",
      patientId: "patient-2",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-2",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });

    const result = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: "org-2",
        encounterId: "enc-2",
      },
      [],
    );

    expect(result.encounter?.id).toBe("enc-2");
    expect(result.appointment).toBeNull();
    expect(result.forms).toEqual([]);
    expect(result.primaryAction.kind).toBe("VIEW_SUMMARY");
    expect(result.primaryAction.enabled).toBe(true);
    expect(result.finalizationGate).toEqual(
      expect.objectContaining({
        enabled: false,
        disabledReason: "Inpatient admission or room state is incomplete.",
        requiredSoapOrDischargeComplete: true,
        requiredFormsSigned: true,
        pendingLabsResolved: true,
        billingReady: true,
        pendingDispenseRequestsResolved: true,
        inpatientRoomAdmissionReady: false,
        requiredTasksComplete: true,
      }),
    );
    expect(result.permissions.canEditSoap).toBe(false);
    expect(result.permissions.canPrescribe).toBe(false);
    expect(result.permissions.canSignDocuments).toBe(false);
    expect(result.permissions.canDischarge).toBe(false);
    expect(result.permissions.canAssignTasks).toBe(false);
    expect(result.permissions.canResumeSchedules).toBe(false);
    expect(result.permissions.canCancelSchedules).toBe(false);
  });

  it("marks inpatient admission ready when an active (not yet discharged) admission exists", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-3",
      organisationId: "org-3",
      caseId: "case-3",
      patientId: "patient-3",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: "Admit",
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-3",
      organisationId: "org-3",
      patientId: "patient-3",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-3",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    // Active admission: dischargedAt is null because discharge has not run yet.
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc-3",
      organisationId: "org-3",
      patientId: "patient-3",
      unitId: "unit-1",
      admittedAt: new Date("2026-06-14T10:00:00.000Z"),
      dischargedAt: null,
    });

    const result = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: "org-3",
        encounterId: "enc-3",
      },
      [],
    );

    expect(result.finalizationGate).toEqual(
      expect.objectContaining({
        inpatientRoomAdmissionReady: true,
      }),
    );
    // The assigned unit must round-trip on the bootstrap encounter so it is
    // retained after a refresh (read by the workspace + appointment views).
    expect(result.encounter?.admission?.unitId).toBe("unit-1");
  });

  it("returns the actor display name for a ready-for-discharge encounter", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-4",
      organisationId: "org-4",
      caseId: "case-4",
      patientId: "patient-4",
      parentId: null,
      status: "onleave",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: "Admit",
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-4",
      organisationId: "org-4",
      patientId: "patient-4",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-4",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.financeEvent.findFirst.mockResolvedValue({
      payload: { actorUserId: "user-1", actorName: "Dr Harshit" },
    });

    const result = await WorkspaceService.getEncounterBootstrap(
      { organisationId: "org-4", encounterId: "enc-4" },
      [],
    );

    expect(result.readyForDischarge).toBe(true);
    expect(result.readyForDischargeByName).toBe("Dr Harshit");
  });

  it("does not let labs from another visit for the same companion block finalization", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-1",
      organisationId: "org-1",
      status: "UPCOMING",
      appointmentKind: "OUTPATIENT",
      concern: "Annual review",
      encounterId: "enc-1",
      caseId: "case-1",
      patient: { id: "patient-1", parent: { id: "parent-1" } },
      startTime: new Date("2026-06-15T10:00:00.000Z"),
      endTime: new Date("2026-06-15T10:30:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-1",
      organisationId: "org-1",
      caseId: "case-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "in-progress",
      encounterClass: "AMB",
      appointmentKind: "OUTPATIENT",
      title: "Annual review",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-1",
      organisationId: "org-1",
      patientId: "patient-1",
      parentId: "parent-1",
      status: "active",
      appointmentKind: "OUTPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-1",
      name: "Buddy",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.parent.findFirst.mockResolvedValue({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    // A pending lab order from a DIFFERENT appointment, returned only because it
    // matches the same companion (patientId). It must not block this encounter.
    mockedPrisma.labOrder.findMany.mockResolvedValue([
      {
        id: "order-other",
        provider: "IDEXX",
        appointmentId: "appt-other",
        status: "SUBMITTED",
        idexxOrderId: "idexx-other",
        tests: ["CBC"],
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:00.000Z"),
      },
    ]);
    mockedPrisma.labResult.findMany.mockResolvedValue([]);

    const result = await WorkspaceService.getAppointmentBootstrap(
      {
        organisationId: "org-1",
        appointmentId: "appt-1",
      },
      ["labs:view:any"],
    );

    // The display summary still surfaces the companion's other-visit labs ...
    expect(result.labSummary.pendingCount).toBe(1);
    expect(result.labSummary.blockingFinalization).toBe(true);
    // ... but the finalization gate is not blocked by them.
    expect(result.finalizationGate).toEqual(
      expect.objectContaining({
        pendingLabsResolved: true,
      }),
    );
  });

  it("resolves the linked appointment when bootstrapping from an encounter", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-enc-1",
      organisationId: "org-2",
      status: "UPCOMING",
      appointmentKind: "INPATIENT",
      concern: "Linked appointment",
      encounterId: "enc-2",
      caseId: "case-2",
      patient: { id: "patient-2", parent: { id: "parent-2" } },
      startTime: new Date("2026-06-14T10:00:00.000Z"),
      endTime: new Date("2026-06-14T11:00:00.000Z"),
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-2",
      organisationId: "org-2",
      caseId: "case-2",
      patientId: "patient-2",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: "Admit",
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-2",
      organisationId: "org-2",
      patientId: "patient-2",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-2",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      updatedAt: new Date("2026-06-14T10:00:00.000Z"),
    });

    const result = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: "org-2",
        encounterId: "enc-2",
      },
      ["forms:view:any"],
    );

    expect(result.appointment?.id).toBe("appt-enc-1");
    expect(mockedFormService.listAppointmentFormSummaries).toHaveBeenCalledWith(
      "org-2",
      "appt-enc-1",
    );
    expect(
      mockedFormService.syncLinkedTemplateAssignmentsForAppointment,
    ).toHaveBeenCalledWith({
      organisationId: "org-2",
      appointmentId: "appt-enc-1",
      canManageForms: false,
    });
  });

  it("throws a not found error when the appointment is missing", async () => {
    await expect(
      WorkspaceService.getAppointmentBootstrap(
        {
          organisationId: "org-1",
          appointmentId: "missing",
        },
        [],
      ),
    ).rejects.toBeInstanceOf(WorkspaceServiceError);
  });

  it("returns encounter documents from the resolved bootstrap", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-doc-1",
      organisationId: "org-doc",
      caseId: "case-doc",
      patientId: "patient-doc",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Docs",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-doc",
      organisationId: "org-doc",
      patientId: "patient-doc",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-doc",
      name: "Nova",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.document.findMany.mockResolvedValue([
      {
        id: "doc-1",
        patientId: "patient-doc",
        appointmentId: null,
        category: "LAB",
        subcategory: null,
        visitType: null,
        title: "Uploaded result",
        issuingBusinessName: null,
        issueDate: null,
        uploadedByParentId: null,
        uploadedByPmsUserId: null,
        pmsVisible: true,
        syncedFromPms: false,
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
        updatedAt: new Date("2026-06-15T10:00:00.000Z"),
      },
    ]);

    const result = await WorkspaceService.getEncounterDocuments(
      {
        organisationId: "org-doc",
        encounterId: "enc-doc-1",
      },
      ["document:view:any"],
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "doc-1",
          sourceKind: "DOCUMENT",
        }),
      ]),
    );
  });

  it("sources workspace documents from the rendered-document pipeline + direct uploads only (legacy forms retired)", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-doc-2",
      organisationId: "org-doc",
      caseId: "case-doc",
      patientId: "patient-doc",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Docs",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-doc",
      organisationId: "org-doc",
      patientId: "patient-doc",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-doc",
      name: "Nova",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.document.findMany.mockResolvedValue([]);
    mockedPrisma.renderedDocument.findMany.mockResolvedValue([]);

    await WorkspaceService.getEncounterDocuments(
      {
        organisationId: "org-doc",
        encounterId: "enc-doc-2",
      },
      ["document:view:any"],
    );

    // The read model is built from the rendered-document pipeline and direct uploads; the
    // legacy form-submission store is never read (it is absent from the prisma mock, so any
    // dependency on it would throw here). This locks in the legacy-forms retirement.
    expect(mockedPrisma.renderedDocument.findMany).toHaveBeenCalled();
    expect(mockedPrisma.document.findMany).toHaveBeenCalled();
    expect(mockedPrisma).not.toHaveProperty("formSubmission");
  });

  it("still returns the full document set for system-access callers with no permissions", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-packet",
      organisationId: "org-1",
      patientId: "patient-1",
      appointmentKind: "OUTPATIENT",
      status: "IN_PROGRESS",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.document.findMany.mockResolvedValue([
      {
        id: "doc-packet-1",
        patientId: "patient-1",
        appointmentId: null,
        category: "HEALTH",
        title: "Upload",
        pmsVisible: true,
        syncedFromPms: false,
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
        updatedAt: new Date("2026-06-15T10:00:00.000Z"),
      },
    ]);

    // This is the packet-assembly path: an empty permission list must not be
    // read as "show nothing", or every clinical packet ships empty.
    const result = await WorkspaceService.getEncounterDocuments(
      { organisationId: "org-1", encounterId: "enc-packet" },
      [],
      { systemAccess: true },
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: "doc-packet-1" }),
      ]),
    );
  });

  it("rejects a companion that is not linked to the organisation", async () => {
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue(null);

    await expect(
      WorkspaceService.getCompanionDocuments({
        organisationId: "org-attacker",
        companionId: "patient-victim",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mockedPrisma.patientOrganisation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientId: "patient-victim",
          organisationId: "org-attacker",
          status: { in: ["ACTIVE", "PENDING"] },
        },
      }),
    );
    expect(mockedPrisma.document.findMany).not.toHaveBeenCalled();
  });

  it("scopes companion documents through patientOrganisation and excludes parent-private uploads", async () => {
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue({
      id: "link-1",
    });
    mockedPrisma.encounter.findMany.mockResolvedValue([]);

    await WorkspaceService.getCompanionDocuments({
      organisationId: "org-scope",
      companionId: "patient-scope",
    });

    expect(mockedPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "patient-scope",
          pmsVisible: true,
          patient: {
            organisations: {
              some: {
                organisationId: "org-scope",
                status: { in: ["ACTIVE", "PENDING"] },
              },
            },
          },
        }),
      }),
    );
    expect(mockedPrisma.renderedDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-scope",
          NOT: {
            clinicalArtifact: {
              is: { status: "VOID" },
            },
          },
        }),
      }),
    );
  });

  it("withholds aggregate slices the caller has no permission to view", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-gated",
      organisationId: "org-1",
      status: "BOOKED",
      appointmentKind: "OUTPATIENT",
      patient: { id: "patient-1" },
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });

    const result = await WorkspaceService.getAppointmentBootstrap(
      { organisationId: "org-1", appointmentId: "appt-gated" },
      ["appointments:view:any"],
    );

    expect(result.documents).toEqual([]);
    expect(result.forms).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.prescriptions).toEqual([]);
    expect(result.clinicalArtifacts).toEqual([]);
    expect(result.treatmentItems).toEqual([]);
    expect(result.templateInstances).toEqual([]);
    expect(result.diagnosticQueue).toEqual([]);
    // Response-only reads are skipped outright rather than fetched and dropped.
    expect(mockedPrisma.document.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.templateInstance.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.workspaceTreatmentItem.findMany).not.toHaveBeenCalled();
  });

  it("still blocks finalization on labs the caller cannot see", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-gated",
      organisationId: "org-1",
      status: "BOOKED",
      appointmentKind: "OUTPATIENT",
      patient: { id: "patient-1" },
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.labOrder.findMany.mockResolvedValue([
      {
        id: "lab-1",
        organisationId: "org-1",
        appointmentId: "appt-gated",
        patientId: "patient-1",
        status: "SUBMITTED",
        provider: "IDEXX",
        idexxOrderId: "idexx-1",
        tests: ["CBC"],
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
        updatedAt: new Date("2026-06-15T10:00:00.000Z"),
      },
    ]);
    mockedPrisma.labResult.findMany.mockResolvedValue([]);

    const result = await WorkspaceService.getAppointmentBootstrap(
      { organisationId: "org-1", appointmentId: "appt-gated" },
      ["appointments:view:any", "forms:view:any"],
    );

    // The lab data itself is withheld ...
    expect(result.labSummary.pendingCount).toBe(0);
    expect(result.labSummary.hasLabs).toBe(false);
    // ... but the gate must not silently green-light a finalization.
    expect(result.finalizationGate.pendingLabsResolved).toBe(false);
    expect(result.finalizationGate.enabled).toBe(false);
  });

  it("returns companion medical records only", async () => {
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue({
      id: "link-med-1",
    });
    mockedPrisma.encounter.findMany.mockResolvedValue([{ id: "enc-med-1" }]);
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc-med-1",
      organisationId: "org-med",
      caseId: "case-med",
      patientId: "patient-med",
      parentId: null,
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Inpatient stay",
      reason: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: "case-med",
      organisationId: "org-med",
      patientId: "patient-med",
      parentId: null,
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Episode",
      description: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.document.findMany.mockResolvedValue([]);
    mockedPrisma.renderedDocument.findMany.mockResolvedValue([
      {
        id: "rd-1",
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-1",
        templateId: "tpl-1",
        templateVersion: 1,
        kind: "SOAP_NOTE",
        title: "SOAP note",
        status: "SIGNED",
        pdfUrl: null,
        signing: { status: "SIGNED" },
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
        updatedAt: new Date("2026-06-15T10:00:00.000Z"),
        templateInstance: null,
        clinicalArtifact: { appointmentId: null, encounterId: "enc-med-1" },
      },
      {
        id: "rd-2",
        sourceKind: "FORM_SUBMISSION",
        sourceId: "form-1",
        templateId: "tpl-2",
        templateVersion: 1,
        kind: "FORM",
        title: "Form",
        status: "SIGNED",
        pdfUrl: null,
        signing: { status: "SIGNED" },
        createdAt: new Date("2026-06-15T10:00:00.000Z"),
        updatedAt: new Date("2026-06-15T10:00:00.000Z"),
        templateInstance: { appointmentId: null, encounterId: "enc-med-1" },
        clinicalArtifact: null,
      },
    ]);

    const result = await WorkspaceService.getCompanionMedicalRecords({
      organisationId: "org-med",
      companionId: "patient-med",
    });

    expect(result).toEqual([
      expect.objectContaining({
        documentId: "rd-1",
        kind: "SOAP_NOTE",
      }),
    ]);
  });

  it("still loads the chart when an inpatient schedule fails to render", async () => {
    // Regression: the schedule PDF render runs inside the aggregate that every
    // chart read goes through, so a throw there used to surface as a 500 and made
    // the appointment impossible to open, sign or discharge - permanently, because
    // a failed render persists nothing and so is retried on every load.
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt-1",
      organisationId: "org-1",
      status: "IN_PROGRESS",
      appointmentKind: "INPATIENT",
      concern: "Ward stay",
      encounterId: "enc-1",
      caseId: "case-1",
      patient: { id: "patient-1", parent: { id: "parent-1" } },
    });
    mockedPrisma.taskSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        templateId: "tmpl-1",
        templateVersion: 1,
        templateKind: "INPATIENT_SCHEDULE",
        appointmentId: "appt-1",
        encounterId: "enc-1",
      },
    ]);
    mockedPrisma.renderedDocument.findFirst.mockResolvedValue(null);
    (createRenderedDocumentRecord as jest.Mock).mockRejectedValue(
      new Error("pdf renderer exploded"),
    );

    const result = await WorkspaceService.getAppointmentBootstrap(
      { organisationId: "org-1", appointmentId: "appt-1" },
      ["appointments:view:any", "tasks:view:any"],
    );

    expect(result).toBeDefined();
    expect(createRenderedDocumentRecord).toHaveBeenCalled();
  });
});

describe("dedupeTreatmentItemsByPrescription", () => {
  it("drops the virtual item when a persisted row has the same prescriptionId", () => {
    const fromPrescriptions = [
      { id: "rx-1", prescriptionId: "rx-1", label: "virtual" },
      { id: "rx-2", prescriptionId: "rx-2", label: "virtual-only" },
    ];
    const fromTable = [
      { id: "ti-1", prescriptionId: "rx-1", label: "persisted" },
    ];

    const result = dedupeTreatmentItemsByPrescription(
      fromPrescriptions,
      fromTable,
    );

    // rx-1 collapses to the persisted row; rx-2 (no persisted row) stays.
    expect(result).toHaveLength(2);
    expect(result.filter((i) => i.prescriptionId === "rx-1")).toEqual([
      { id: "ti-1", prescriptionId: "rx-1", label: "persisted" },
    ]);
    expect(result.some((i) => i.prescriptionId === "rx-2")).toBe(true);
  });

  it("keeps virtual items that have no prescriptionId", () => {
    const result = dedupeTreatmentItemsByPrescription(
      [{ id: "v-1", prescriptionId: null }],
      [{ id: "t-1", prescriptionId: "rx-9" }],
    );

    expect(result).toHaveLength(2);
  });
});

describe("WorkspaceService aggregate edge cases", () => {
  type PrismaMock = Record<string, Record<string, jest.Mock>>;
  const db = prisma as unknown as PrismaMock;
  const formService = FormAssignmentService as unknown as Record<
    string,
    jest.Mock
  >;
  const artifactService = ClinicalArtifactService as unknown as Record<
    string,
    jest.Mock
  >;
  const invoiceService = InvoiceService as unknown as Record<string, jest.Mock>;

  const ORG = "org-cov";
  const DAY = new Date("2026-06-20T09:00:00.000Z");
  const LATER = new Date("2026-06-20T11:00:00.000Z");

  const FULL_PERMISSIONS = [
    "appointments:view:any",
    "tasks:view:any",
    "tasks:edit:any",
    "forms:view:any",
    "forms:edit:any",
    "prescription:view:any",
    "prescription:edit:any",
    "labs:view:any",
    "document:view:any",
    "billing:view:any",
  ];

  const appointmentRow = (overrides: Record<string, unknown> = {}) => ({
    id: "appt-cov",
    organisationId: ORG,
    status: "IN_PROGRESS",
    appointmentKind: "OUTPATIENT",
    concern: "Checkup",
    productItemId: null,
    encounterId: null,
    caseId: null,
    patient: { id: "pet-cov", parent: { id: "parent-cov" } },
    startTime: DAY,
    endTime: LATER,
    createdAt: DAY,
    updatedAt: DAY,
    ...overrides,
  });

  const encounterRow = (overrides: Record<string, unknown> = {}) => ({
    id: "enc-cov",
    organisationId: ORG,
    caseId: "case-cov",
    patientId: "pet-cov",
    parentId: "parent-cov",
    status: "in-progress",
    encounterClass: "IMP",
    appointmentKind: "OUTPATIENT",
    title: "Visit",
    reason: null,
    periodStart: DAY,
    periodEnd: null,
    createdAt: DAY,
    updatedAt: DAY,
    ...overrides,
  });

  const treatmentRow = (overrides: Record<string, unknown> = {}) => ({
    id: "ti-cov",
    organisationId: ORG,
    appointmentId: "appt-cov",
    encounterId: "enc-cov",
    productId: "prod-cov",
    productVersion: null,
    productSnapshot: { name: "Procedure" },
    servicePackageKind: "PROCEDURE",
    quantity: 1,
    priceSnapshot: { finalAmount: 10 },
    billingStatus: "UNBILLED",
    invoiceRowId: null,
    settledInvoiceId: null,
    settledAt: null,
    lockState: null,
    prescriptionId: null,
    createdAt: DAY,
    updatedAt: DAY,
    ...overrides,
  });

  const renderedRow = (overrides: Record<string, unknown> = {}) => ({
    id: "rd-cov",
    sourceKind: "CLINICAL_ARTIFACT",
    sourceId: "artifact-cov",
    templateId: null,
    templateVersion: null,
    kind: "SOAP_NOTE",
    title: "SOAP note",
    status: "DRAFT",
    pdfUrl: null,
    signing: null,
    createdAt: DAY,
    updatedAt: DAY,
    templateInstance: null,
    clinicalArtifact: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    db.appointment.findFirst.mockResolvedValue(null);
    db.encounter.findFirst.mockResolvedValue(null);
    db.encounter.findMany.mockResolvedValue([]);
    db.case.findFirst.mockResolvedValue(null);
    db.invoice.findFirst.mockResolvedValue(null);
    db.invoice.findMany.mockResolvedValue([]);
    db.organization.findUnique.mockResolvedValue(null);
    db.patient.findFirst.mockResolvedValue(null);
    db.patientOrganisation.findFirst.mockResolvedValue(null);
    db.parent.findFirst.mockResolvedValue(null);
    db.admission.findUnique.mockResolvedValue(null);
    db.productItem.findFirst.mockResolvedValue(null);
    db.productItem.findMany.mockResolvedValue([]);
    db.task.findMany.mockResolvedValue([]);
    db.taskSchedule.findMany.mockResolvedValue([]);
    db.templateInstance.findMany.mockResolvedValue([]);
    db.document.findMany.mockResolvedValue([]);
    db.renderedDocument.findMany.mockResolvedValue([]);
    db.renderedDocument.findFirst.mockResolvedValue(null);
    db.renderedDocument.create.mockResolvedValue({ id: "rd-created" });
    db.prescriptionDispenseRequest.findMany.mockResolvedValue([]);
    db.workspaceTreatmentItem.findMany.mockResolvedValue([]);
    db.workspaceTreatmentItem.findFirst.mockResolvedValue(null);
    db.workspaceTreatmentItem.create.mockResolvedValue(treatmentRow());
    db.workspaceTreatmentItem.update.mockResolvedValue(treatmentRow());
    db.labOrder.findMany.mockResolvedValue([]);
    db.labResult.findMany.mockResolvedValue([]);
    db.financeEvent.findFirst.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue(null);

    formService.syncLinkedTemplateAssignmentsForAppointment.mockResolvedValue(
      undefined,
    );
    formService.listAppointmentFormSummaries.mockResolvedValue([]);

    for (const key of Object.keys(artifactService)) {
      artifactService[key].mockResolvedValue([]);
    }

    invoiceService.findOpenInvoiceForAppointment.mockResolvedValue(null);
    invoiceService.bootstrapForAppointment.mockResolvedValue(null);
    invoiceService.addItemsToInvoice.mockResolvedValue(null);
    (createRenderedDocumentRecord as jest.Mock).mockResolvedValue({
      id: "rd-created",
    });
  });

  describe("primary action permission gating", () => {
    it("disables the review-tasks action for a caller who cannot see tasks", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.task.findMany.mockResolvedValue([
        { id: "task-1", status: "IN_PROGRESS", dueAt: DAY },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        ["appointments:view:any"],
      );

      expect(result.primaryAction).toMatchObject({
        kind: "REVIEW_TASKS",
        label: "Review tasks",
        detail: "There are active tasks that still need attention.",
        enabled: false,
        disabledReason: "You do not have permission to view tasks.",
      });
      expect(result.finalizationGate.requiredTasksComplete).toBe(false);
      expect(result.finalizationGate.disabledReason).toBe(
        "There are active tasks that still need attention.",
      );
    });

    it("enables the review-tasks action for a caller who may only assign tasks", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.task.findMany.mockResolvedValue([
        { id: "task-1", status: "PENDING", dueAt: DAY },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        ["appointments:view:any", "tasks:edit:own"],
      );

      expect(result.primaryAction.kind).toBe("REVIEW_TASKS");
      expect(result.primaryAction.enabled).toBe(true);
      expect(result.primaryAction.disabledReason).toBeNull();
      expect(result.permissions.canAssignTasks).toBe(true);
      expect(result.permissions.canResumeSchedules).toBe(true);
    });

    it("offers continue-charting to a caller who may edit clinical forms", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.task.findMany.mockResolvedValue([
        { id: "task-done", status: "COMPLETED", dueAt: DAY },
        { id: "task-cancelled", status: "CANCELLED", dueAt: DAY },
      ]);
      artifactService.listSoapNotesForAppointment.mockResolvedValue([
        {
          artifact: {
            id: "soap-1",
            status: "DRAFT",
            kind: "SOAP_NOTE",
            createdAt: DAY,
            updatedAt: DAY,
          },
        },
      ]);
      // A bare artifact row (no nested `artifact`) falls back to its own status.
      artifactService.listVitalRecordsForAppointment.mockResolvedValue([
        { id: "vital-1", status: "FINAL" },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        ["appointments:view:any", "forms:view:any", "forms:edit:any"],
      );

      expect(result.primaryAction).toMatchObject({
        kind: "CONTINUE_CHARTING",
        label: "Continue charting",
        enabled: true,
        disabledReason: null,
      });
      expect(result.finalizationGate.requiredSoapOrDischargeComplete).toBe(
        false,
      );
      expect(result.finalizationGate.disabledReason).toBe(
        "SOAP notes or discharge summaries are still open.",
      );
    });

    it("treats an in-progress note as open charting and an untyped artifact as harmless", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-inprog", caseId: "case-untitled" }),
      );
      db.case.findFirst.mockResolvedValue({
        id: "case-untitled",
        organisationId: ORG,
        patientId: "pet-cov",
        parentId: null,
        status: "active",
        appointmentKind: "OUTPATIENT",
        title: null,
        description: null,
        createdAt: DAY,
        updatedAt: DAY,
      });
      artifactService.listSoapNotesForAppointment.mockResolvedValue([
        // An artifact row with neither a nested artifact nor a status defaults to
        // DRAFT but carries no kind, so it cannot block finalization ...
        {},
        // ... and neither can a flat row that reports its own status.
        { id: "flat-note", status: "COMPLETE" },
        {
          artifact: {
            id: "soap-inprog",
            status: "IN_PROGRESS",
            kind: "SOAP_NOTE",
            createdAt: DAY,
            updatedAt: DAY,
          },
        },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-inprog" },
        ["appointments:view:any", "forms:view:any", "forms:edit:any"],
      );

      expect(result.episodeOfCare).toMatchObject({
        id: "case-untitled",
        title: undefined,
        description: undefined,
      });
      expect(result.primaryAction.kind).toBe("CONTINUE_CHARTING");
      expect(result.finalizationGate.requiredSoapOrDischargeComplete).toBe(
        false,
      );
    });

    it("disables the review-labs action for a caller who cannot see labs", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.labOrder.findMany.mockResolvedValue([
        {
          id: "order-1",
          provider: "IDEXX",
          appointmentId: "appt-cov",
          status: "SUBMITTED",
          idexxOrderId: "idexx-1",
          tests: ["CBC"],
          createdAt: DAY,
          updatedAt: DAY,
        },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        ["appointments:view:any"],
      );

      expect(result.primaryAction).toMatchObject({
        kind: "VIEW_LABS",
        label: "Review labs",
        enabled: false,
        disabledReason: "You do not have permission to view labs.",
      });
    });

    it("falls back to the view-summary action when nothing is outstanding", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        ["appointments:view:any"],
      );

      expect(result.primaryAction).toMatchObject({
        kind: "VIEW_SUMMARY",
        enabled: true,
        disabledReason: null,
      });
      expect(result.finalizationGate.enabled).toBe(true);
      expect(result.finalizationGate.disabledReason).toBeNull();
    });
  });

  describe("billing readiness", () => {
    it("falls back to the finance event log when the invoice actor no longer resolves", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-bill", encounterId: "enc-bill" }),
      );
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-bill", status: "onleave" }),
      );
      db.invoice.findFirst.mockResolvedValue({
        id: "inv-legacy",
        visitBillingStage: "READY_FOR_BILLING",
        readyForBillingAt: LATER,
        readyForBillingActorId: "user-deleted",
      });
      db.user.findUnique.mockResolvedValue(null);
      db.financeEvent.findFirst.mockImplementation(
        async (args: { where: { eventType: string } }) => ({
          payload: {
            actorName:
              args.where.eventType === "INVOICE_READY_FOR_BILLING"
                ? "Legacy Biller"
                : "Night Vet",
          },
        }),
      );

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-bill" },
        FULL_PERMISSIONS,
      );

      expect(result.readyForBilling).toBe(true);
      expect(result.readyForBillingByName).toBe("Legacy Biller");
      expect(result.readyForDischarge).toBe(true);
      expect(result.readyForDischargeByName).toBe("Night Vet");
      expect(db.financeEvent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            eventType: "INVOICE_READY_FOR_BILLING",
            entityType: "INVOICE",
            entityId: "inv-legacy",
          },
        }),
      );
    });

    it("blocks finalization while a draft invoice is not ready for billing", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.invoice.findFirst.mockResolvedValue({
        id: "inv-draft",
        visitBillingStage: "DRAFT",
        readyForBillingAt: null,
        readyForBillingActorId: null,
      });

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        FULL_PERMISSIONS,
      );

      expect(
        (result as unknown as { visitBillingStage: string | null })
          .visitBillingStage,
      ).toBe("DRAFT");
      expect(result.readyForBilling).toBe(false);
      expect(result.readyForBillingByName).toBeNull();
      expect(result.finalizationGate.billingReady).toBe(false);
      expect(result.finalizationGate.disabledReason).toBe(
        "Billing is not ready for finalization.",
      );
    });

    it("treats a settled invoice as billing-ready", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.invoice.findFirst.mockResolvedValue({
        id: "inv-settled",
        visitBillingStage: "SETTLED",
        readyForBillingAt: null,
        readyForBillingActorId: null,
      });

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        FULL_PERMISSIONS,
      );

      expect(result.finalizationGate.billingReady).toBe(true);
      expect(result.finalizationGate.enabled).toBe(true);
    });
  });

  describe("pending dispense requests", () => {
    const requestRow = (
      id: string,
      appointmentId: string | null,
      encounterId: string | null,
    ) => ({
      id,
      status: "PENDING",
      prescription: { artifact: { appointmentId, encounterId } },
    });

    it("keeps only the dispense requests tied to this appointment or encounter", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-disp", encounterId: "enc-disp" }),
      );
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-disp", caseId: null }),
      );
      db.prescriptionDispenseRequest.findMany.mockResolvedValue([
        requestRow("dr-encounter", null, "enc-disp"),
        requestRow("dr-appointment", "appt-disp", null),
        requestRow("dr-other", "appt-other", "enc-other"),
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-disp" },
        FULL_PERMISSIONS,
      );

      expect(result.finalizationGate.pendingDispenseRequestsResolved).toBe(
        false,
      );
      expect(result.finalizationGate.disabledReason).toBe(
        "Pending dispense requests still need review.",
      );
    });

    it("ignores dispense requests that belong to another visit", async () => {
      db.appointment.findFirst.mockResolvedValue(appointmentRow());
      db.prescriptionDispenseRequest.findMany.mockResolvedValue([
        requestRow("dr-other", "appt-other", "enc-other"),
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-cov" },
        FULL_PERMISSIONS,
      );

      expect(result.finalizationGate.pendingDispenseRequestsResolved).toBe(
        true,
      );
    });
  });

  describe("lab summary derivation", () => {
    const bootstrapWithLabs = async (
      orders: Array<Record<string, unknown>>,
      results: Array<Record<string, unknown>>,
    ) => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-lab" }),
      );
      db.labOrder.findMany.mockResolvedValue(orders);
      db.labResult.findMany.mockResolvedValue(results);
      return WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-lab" },
        FULL_PERMISSIONS,
      );
    };

    it("reports PARTIAL from the counts when no lab row carries a timestamp", async () => {
      const result = await bootstrapWithLabs(
        [{ id: "o1", provider: "IDEXX", status: "RUNNING", tests: [] }],
        [{ id: "r1", provider: "IDEXX", status: "FINAL" }],
      );

      expect(result.labSummary.latestStatus).toBe("PARTIAL");
      expect(result.labSummary.pendingCount).toBe(1);
      expect(result.labSummary.resultedCount).toBe(1);
    });

    it("reports RESULTED when only untimed results exist", async () => {
      const result = await bootstrapWithLabs(
        [],
        [{ id: "r1", provider: "IDEXX", status: "RESULTED" }],
      );

      expect(result.labSummary.latestStatus).toBe("RESULTED");
      expect(result.labSummary.hasLabs).toBe(true);
    });

    it("reports ORDERED when only untimed open orders exist", async () => {
      const result = await bootstrapWithLabs(
        [{ id: "o1", provider: "IDEXX", status: "AT_THE_LAB", tests: null }],
        [],
      );

      expect(result.labSummary.latestStatus).toBe("ORDERED");
    });

    it("reports NONE when the untimed rows carry unrecognised statuses", async () => {
      const result = await bootstrapWithLabs(
        [{ id: "o1", provider: null, status: "ARCHIVED", tests: [] }],
        [],
      );

      expect(result.labSummary.latestStatus).toBe("NONE");
      expect(result.labSummary.providers).toEqual([]);
      expect(result.labSummary.blockingFinalization).toBe(false);
    });

    it("reports FAILED from the most recent lab event", async () => {
      const result = await bootstrapWithLabs(
        [
          {
            id: "o1",
            provider: "IDEXX",
            status: "ERROR",
            tests: [],
            appointmentId: "appt-lab",
            updatedAt: LATER,
            createdAt: DAY,
          },
        ],
        [],
      );

      expect(result.labSummary.latestStatus).toBe("FAILED");
      expect(result.labSummary.failedCount).toBe(1);
      expect(result.finalizationGate.pendingLabsResolved).toBe(false);
    });

    it("reports QUEUED for a freshly created order", async () => {
      const result = await bootstrapWithLabs(
        [
          {
            id: "o1",
            provider: "IDEXX",
            status: "CREATED",
            tests: [],
            updatedAt: LATER,
            createdAt: DAY,
          },
        ],
        [],
      );

      expect(result.labSummary.latestStatus).toBe("QUEUED");
    });

    it("reports RESULTED from the most recent lab event", async () => {
      const result = await bootstrapWithLabs(
        [],
        [
          {
            id: "r1",
            provider: "IDEXX",
            status: "COMPLETE",
            updatedAt: LATER,
            createdAt: DAY,
          },
        ],
      );

      expect(result.labSummary.latestStatus).toBe("RESULTED");
    });

    it("collapses duplicate diagnostic rows and labels order rows without tests", async () => {
      const order = {
        id: "o-dup",
        provider: "IDEXX",
        status: "SUBMITTED",
        tests: [],
        createdAt: DAY,
        updatedAt: LATER,
      };
      const result = await bootstrapWithLabs(
        [order, { ...order }],
        [
          {
            id: "r-nostatus",
            provider: null,
            createdAt: DAY,
            updatedAt: LATER,
          },
        ],
      );

      const orderRows = result.diagnosticQueue.filter(
        (item) => item.kind === "LAB_ORDER",
      );
      expect(orderRows).toHaveLength(1);
      expect(orderRows[0].label).toBe("Lab order");
      const resultRow = result.diagnosticQueue.find(
        (item) => item.kind === "LAB_RESULT",
      );
      expect(resultRow?.status).toBeNull();
    });

    it("picks the newest of several timestamped lab events", async () => {
      const result = await bootstrapWithLabs(
        [
          {
            id: "o-old",
            provider: "IDEXX",
            status: "SUBMITTED",
            tests: ["CBC"],
            createdAt: DAY,
            updatedAt: DAY,
          },
        ],
        [
          {
            id: "r-new",
            provider: "IDEXX",
            status: "CANCELLED",
            createdAt: DAY,
            updatedAt: LATER,
          },
        ],
      );

      expect(result.labSummary.latestStatus).toBe("FAILED");
      expect(result.labSummary.pendingCount).toBe(1);
      expect(result.labSummary.failedCount).toBe(1);
    });

    it("only counts results linked to this appointment's orders in the gate", async () => {
      const result = await bootstrapWithLabs(
        [
          {
            id: "o-mine",
            provider: "IDEXX",
            appointmentId: "appt-lab",
            status: "RESULTED",
            idexxOrderId: "idexx-mine",
            tests: ["CBC"],
            createdAt: DAY,
            updatedAt: LATER,
          },
        ],
        [
          {
            id: "r-mine",
            provider: "IDEXX",
            orderId: "idexx-mine",
            status: "RESULTED",
            createdAt: DAY,
            updatedAt: LATER,
          },
          {
            id: "r-unlinked",
            provider: "IDEXX",
            orderId: null,
            status: "RESULTED",
            createdAt: DAY,
            updatedAt: LATER,
          },
        ],
      );

      expect(result.labSummary.resultedCount).toBe(2);
      expect(result.finalizationGate.pendingLabsResolved).toBe(true);
    });
  });

  describe("invoice line derivation for treatment items", () => {
    it("prices a line from the snapshot unit price and trims the invoice row id", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-1",
      });
      const row = treatmentRow({
        id: "ti-unit",
        quantity: 0,
        invoiceRowId: "  row-42  ",
        priceSnapshot: {
          unitPrice: 12.5,
          discountPercent: 5,
          displayName: "Snapshot line",
        },
        productSnapshot: [],
      });
      db.workspaceTreatmentItem.create.mockResolvedValue(row);
      db.workspaceTreatmentItem.update.mockResolvedValue({
        ...row,
        billingStatus: "BILLED",
        invoiceRowId: "row-42",
      });

      const created = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(invoiceService.addItemsToInvoice).toHaveBeenCalledWith("inv-1", [
        {
          id: "row-42",
          name: "Snapshot line",
          description: "Snapshot line",
          quantity: 1,
          unitPrice: 12.5,
          discountPercent: 5,
          total: 12.5,
        },
      ]);
      // A non-object product snapshot degrades to an empty object.
      expect(created.productSnapshot).toEqual({});
      expect(created.invoiceRowId).toBe("row-42");
    });

    it("derives the unit price from the final amount when no gross amount is present", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-2",
      });
      const row = treatmentRow({
        id: "ti-final",
        quantity: 2,
        priceSnapshot: { finalAmount: 30 },
        productSnapshot: { displayName: "Package deal" },
      });
      db.workspaceTreatmentItem.create.mockResolvedValue(row);
      db.workspaceTreatmentItem.update.mockResolvedValue({
        ...row,
        billingStatus: "BILLED",
        invoiceRowId: "ti-final",
      });

      await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 2,
        priceSnapshot: {},
      });

      expect(invoiceService.addItemsToInvoice).toHaveBeenCalledWith("inv-2", [
        expect.objectContaining({
          name: "Package deal",
          quantity: 2,
          unitPrice: 15,
          total: 30,
          discountPercent: undefined,
        }),
      ]);
    });

    it("names the line after the product id when no snapshot text is usable", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-3",
      });
      const row = treatmentRow({
        id: "ti-noname",
        productId: "prod-noname",
        servicePackageKind: "",
        priceSnapshot: "not-an-object",
        productSnapshot: null,
      });
      db.workspaceTreatmentItem.create.mockResolvedValue(row);
      db.workspaceTreatmentItem.update.mockResolvedValue({
        ...row,
        billingStatus: "BILLED",
        invoiceRowId: "ti-noname",
      });

      const created = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-noname",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(invoiceService.addItemsToInvoice).toHaveBeenCalledWith("inv-3", [
        expect.objectContaining({
          id: "ti-noname",
          name: "prod-noname",
          unitPrice: 0,
          total: 0,
        }),
      ]);
      expect(created.priceSnapshot).toEqual({});
    });

    it("falls back to the product id when nothing names the line", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-4",
      });
      const row = treatmentRow({
        id: "ti-anonymous",
        productId: "",
        servicePackageKind: "",
        priceSnapshot: {},
        productSnapshot: {},
      });
      db.workspaceTreatmentItem.create.mockResolvedValue(row);
      db.workspaceTreatmentItem.update.mockResolvedValue({
        ...row,
        billingStatus: "BILLED",
        invoiceRowId: "ti-anonymous",
      });

      await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(invoiceService.addItemsToInvoice).toHaveBeenCalledWith("inv-4", [
        expect.objectContaining({ id: "ti-anonymous", name: "", total: 0 }),
      ]);
    });

    it("persists an explicit lock state and billing status on create", async () => {
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({ id: "ti-locked-create", appointmentId: null }),
      );

      await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        encounterId: "enc-cov",
        productId: "prod-cov",
        productVersion: 4,
        productSnapshot: { name: "Procedure" },
        servicePackageKind: "PROCEDURE",
        quantity: 2,
        priceSnapshot: { finalAmount: 20 },
        billingStatus: "BILLED",
        invoiceRowId: "row-77",
        lockState: { locked: true },
      });

      expect(db.workspaceTreatmentItem.create).toHaveBeenCalledWith({
        data: {
          organisationId: ORG,
          appointmentId: undefined,
          encounterId: "enc-cov",
          productId: "prod-cov",
          productVersion: 4,
          productSnapshot: { name: "Procedure" },
          servicePackageKind: "PROCEDURE",
          quantity: 2,
          priceSnapshot: { finalAmount: 20 },
          billingStatus: "BILLED",
          invoiceRowId: "row-77",
          lockState: { locked: true },
        },
      });
    });

    it("leaves the row untouched when the invoice bootstrap throws", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue(null);
      invoiceService.bootstrapForAppointment.mockRejectedValue(
        new Error("invoice service down"),
      );
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({ id: "ti-bootfail" }),
      );

      const created = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(created.billingStatus).toBe("UNBILLED");
      expect(invoiceService.addItemsToInvoice).not.toHaveBeenCalled();
      expect(db.workspaceTreatmentItem.update).not.toHaveBeenCalled();
    });

    it("skips the sync when the bootstrapped invoice is not in a billable state", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue(null);
      invoiceService.bootstrapForAppointment.mockResolvedValue({
        id: "inv-void",
        status: "CANCELLED",
      });
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({ id: "ti-notbillable" }),
      );

      const created = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(created.billingStatus).toBe("UNBILLED");
      expect(invoiceService.addItemsToInvoice).not.toHaveBeenCalled();
    });

    it("swallows a 409 from the invoice service and returns the unsynced row", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-locked",
      });
      invoiceService.addItemsToInvoice.mockRejectedValue(
        new InvoiceServiceError("Invoice is locked", 409),
      );
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({ id: "ti-locked" }),
      );

      const created = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(created.billingStatus).toBe("UNBILLED");
      expect(db.workspaceTreatmentItem.update).not.toHaveBeenCalled();
    });

    it("rethrows an unexpected invoice service failure", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-broken",
      });
      invoiceService.addItemsToInvoice.mockRejectedValue(
        new InvoiceServiceError("Invoice service exploded", 500),
      );
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({ id: "ti-broken" }),
      );

      await expect(
        WorkspaceService.createEncounterTreatmentItem({
          organisationId: ORG,
          appointmentId: "appt-cov",
          encounterId: "enc-cov",
          productId: "prod-cov",
          productSnapshot: {},
          servicePackageKind: "PROCEDURE",
          quantity: 1,
          priceSnapshot: {},
        }),
      ).rejects.toThrow("Invoice service exploded");
    });

    it("does not re-write a row that is already billed against the same invoice line", async () => {
      invoiceService.findOpenInvoiceForAppointment.mockResolvedValue({
        id: "inv-stable",
      });
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({
          id: "ti-stable",
          billingStatus: "BILLED",
          invoiceRowId: "ti-stable",
        }),
      );

      const created = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        appointmentId: "appt-cov",
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(invoiceService.addItemsToInvoice).toHaveBeenCalled();
      expect(db.workspaceTreatmentItem.update).not.toHaveBeenCalled();
      expect(created.invoiceRowId).toBe("ti-stable");
    });

    it("skips the invoice sync entirely for an encounter-only treatment item", async () => {
      db.workspaceTreatmentItem.create.mockResolvedValue(
        treatmentRow({ id: "ti-noappt", appointmentId: null }),
      );

      await WorkspaceService.createEncounterTreatmentItem({
        organisationId: ORG,
        encounterId: "enc-cov",
        productId: "prod-cov",
        productSnapshot: {},
        servicePackageKind: "PROCEDURE",
        quantity: 1,
        priceSnapshot: {},
      });

      expect(
        invoiceService.findOpenInvoiceForAppointment,
      ).not.toHaveBeenCalled();
    });

    it("reclassifies a prescription-linked row and normalizes its lock state", async () => {
      db.workspaceTreatmentItem.findMany.mockResolvedValue([
        treatmentRow({
          id: "ti-rx",
          servicePackageKind: "SERVICE",
          prescriptionId: "rx-1",
          lockState: { locked: true },
        }),
        treatmentRow({
          id: "ti-med",
          servicePackageKind: "MEDICATION",
          prescriptionId: "rx-2",
          lockState: 42,
        }),
      ]);

      const items = await WorkspaceService.getEncounterTreatmentItems({
        organisationId: ORG,
        encounterId: "enc-cov",
      });

      expect(items[0].servicePackageKind).toBe("PRESCRIPTION");
      expect(items[0].lockState).toEqual({ locked: true });
      expect(items[1].servicePackageKind).toBe("MEDICATION");
      expect(items[1].lockState).toBeNull();
    });
  });

  describe("treatment item guards", () => {
    it("requires an encounter id when listing treatment items", async () => {
      await expect(
        WorkspaceService.getEncounterTreatmentItems({
          organisationId: ORG,
          encounterId: "   ",
        }),
      ).rejects.toMatchObject({
        message: "Encounter is required",
        statusCode: 400,
      });
      expect(db.workspaceTreatmentItem.findMany).not.toHaveBeenCalled();
    });

    it("requires an encounter id when creating a treatment item", async () => {
      await expect(
        WorkspaceService.createEncounterTreatmentItem({
          organisationId: ORG,
          encounterId: "  ",
          productId: "prod-cov",
          productSnapshot: {},
          servicePackageKind: "PROCEDURE",
          quantity: 1,
          priceSnapshot: {},
        }),
      ).rejects.toMatchObject({
        message: "Encounter is required",
        statusCode: 400,
      });
      expect(db.workspaceTreatmentItem.create).not.toHaveBeenCalled();
    });

    it("rejects an update for a treatment item in another organisation", async () => {
      db.workspaceTreatmentItem.findFirst.mockResolvedValue(null);

      await expect(
        WorkspaceService.updateTreatmentItem("ti-cov", "org-other", {
          quantity: 2,
        }),
      ).rejects.toMatchObject({
        message: "Treatment item not found",
        statusCode: 404,
      });
      expect(db.workspaceTreatmentItem.update).not.toHaveBeenCalled();
    });

    it("rejects a delete for a treatment item in another organisation", async () => {
      db.workspaceTreatmentItem.findFirst.mockResolvedValue(null);

      await expect(
        WorkspaceService.deleteTreatmentItem("ti-cov", "org-other"),
      ).rejects.toMatchObject({
        message: "Treatment item not found",
        statusCode: 404,
      });
      expect(db.workspaceTreatmentItem.delete).not.toHaveBeenCalled();
    });

    it("passes through only the fields present in an update patch", async () => {
      const existing = treatmentRow({ id: "ti-patch" });
      db.workspaceTreatmentItem.findFirst.mockResolvedValue(existing);
      db.workspaceTreatmentItem.update.mockResolvedValue({
        ...existing,
        appointmentId: null,
        quantity: 4,
      });

      await WorkspaceService.updateTreatmentItem("ti-patch", ORG, {
        appointmentId: null,
        productVersion: null,
        productSnapshot: { name: "Updated" },
        priceSnapshot: { finalAmount: 8 },
        invoiceRowId: null,
        lockState: null,
        quantity: 4,
      });

      expect(db.workspaceTreatmentItem.update).toHaveBeenCalledWith({
        where: { id: "ti-patch" },
        data: {
          appointmentId: null,
          productId: undefined,
          productVersion: null,
          productSnapshot: { name: "Updated" },
          servicePackageKind: undefined,
          quantity: 4,
          priceSnapshot: { finalAmount: 8 },
          billingStatus: undefined,
          invoiceRowId: null,
          lockState: null,
        },
      });
    });
  });

  describe("diagnostic preloads", () => {
    it("expands diagnostic products and package children into provider tests", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-dx" }),
      );
      db.workspaceTreatmentItem.findMany.mockResolvedValue([
        treatmentRow({ id: "ti-a", productId: "prod-diag" }),
        treatmentRow({ id: "ti-b", productId: "prod-nocode" }),
        treatmentRow({ id: "ti-c", productId: "prod-med" }),
        treatmentRow({ id: "ti-d", productId: "prod-emptypkg" }),
        treatmentRow({ id: "ti-e", productId: "prod-pkg" }),
        treatmentRow({ id: "ti-f", productId: "" }),
      ]);
      db.productItem.findMany.mockResolvedValue([
        {
          id: "prod-diag",
          organisationId: ORG,
          name: "Chemistry panel",
          code: "IDEXX-CHEM",
          kind: "DIAGNOSTIC",
          createdAt: DAY,
          updatedAt: DAY,
          package: null,
        },
        {
          id: "prod-nocode",
          organisationId: ORG,
          name: "Uncoded lab",
          code: null,
          kind: "LAB_TEST",
          createdAt: DAY,
          updatedAt: DAY,
          package: null,
        },
        {
          id: "prod-med",
          organisationId: ORG,
          name: "Medication",
          code: "MED-1",
          kind: "MEDICATION",
          createdAt: DAY,
          updatedAt: DAY,
          package: null,
        },
        {
          id: "prod-emptypkg",
          organisationId: ORG,
          name: "Empty package",
          code: null,
          kind: "PACKAGE",
          createdAt: DAY,
          updatedAt: DAY,
          package: { items: [] },
        },
        {
          id: "prod-pkg",
          organisationId: ORG,
          name: "Wellness package",
          code: null,
          kind: "PACKAGE",
          createdAt: DAY,
          updatedAt: DAY,
          package: {
            items: [
              {
                id: "pkg-item-lab",
                sortOrder: 0,
                childProductItem: {
                  id: "child-lab",
                  name: "CBC",
                  code: "IDEXX-CBC",
                  kind: "LAB_TEST",
                  createdAt: DAY,
                  updatedAt: DAY,
                },
              },
              {
                id: "pkg-item-service",
                sortOrder: 1,
                childProductItem: {
                  id: "child-service",
                  name: "Consult",
                  code: "CONSULT",
                  kind: "SERVICE",
                  createdAt: DAY,
                  updatedAt: DAY,
                },
              },
              {
                id: "pkg-item-uncoded",
                sortOrder: 2,
                childProductItem: {
                  id: "child-uncoded",
                  name: "Uncoded diagnostic",
                  code: null,
                  kind: "DIAGNOSTIC",
                  createdAt: DAY,
                  updatedAt: DAY,
                },
              },
            ],
          },
        },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-dx" },
        FULL_PERMISSIONS,
      );

      expect(db.productItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: {
              in: [
                "prod-diag",
                "prod-nocode",
                "prod-med",
                "prod-emptypkg",
                "prod-pkg",
              ],
            },
          }),
        }),
      );
      expect(result.diagnosticQueue).toEqual([
        expect.objectContaining({
          id: "provider-test:prod-diag",
          kind: "PROVIDER_TEST",
          providerTestCode: "IDEXX-CHEM",
          sourceKind: "PRODUCT_ITEM",
          sourceProductId: "prod-diag",
          sourcePackageId: null,
          status: "AVAILABLE",
        }),
        expect.objectContaining({
          id: "provider-test:prod-pkg:pkg-item-lab",
          providerTestCode: "IDEXX-CBC",
          sourceKind: "PACKAGE_ITEM",
          sourceProductId: "child-lab",
          sourcePackageId: "prod-pkg",
        }),
      ]);
    });

    it("skips the product lookup when no treatment item names a product", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-noprod" }),
      );
      db.workspaceTreatmentItem.findMany.mockResolvedValue([
        treatmentRow({ id: "ti-x", productId: "" }),
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-noprod" },
        FULL_PERMISSIONS,
      );

      expect(db.productItem.findMany).not.toHaveBeenCalled();
      expect(result.diagnosticQueue).toEqual([]);
    });
  });

  describe("rendered documents and inpatient schedules", () => {
    it("resolves schedule-sourced documents through the schedule context", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-sched", encounterId: "enc-sched" }),
      );
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-sched", caseId: null }),
      );
      db.taskSchedule.findMany.mockResolvedValue([
        {
          id: "sched-rendered",
          templateId: "tpl-1",
          templateVersion: 1,
          templateKind: "INPATIENT_SCHEDULE",
          appointmentId: "appt-sched",
          encounterId: "enc-sched",
        },
        {
          id: "sched-new",
          templateId: "tpl-2",
          templateVersion: 2,
          templateKind: "INPATIENT_SCHEDULE",
          appointmentId: null,
          encounterId: null,
        },
      ]);
      db.renderedDocument.findFirst
        .mockResolvedValueOnce({ id: "rd-existing" })
        .mockResolvedValueOnce(null);
      db.renderedDocument.findMany.mockResolvedValue([
        renderedRow({
          id: "rd-sched",
          sourceKind: "TASK_SCHEDULE",
          sourceId: "sched-rendered",
          kind: "INPATIENT_SCHEDULE",
          title: "Inpatient Schedule",
          status: "SIGNED",
          signing: null,
        }),
        renderedRow({
          id: "rd-orphan",
          sourceKind: "TASK_SCHEDULE",
          sourceId: "sched-unknown",
          status: "DRAFT",
          signing: null,
        }),
        renderedRow({
          id: "rd-signing",
          sourceKind: "CLINICAL_ARTIFACT",
          status: "DRAFT",
          signing: { status: "IN_PROGRESS" },
          clinicalArtifact: {
            appointmentId: "appt-sched",
            encounterId: "enc-sched",
          },
        }),
        renderedRow({
          id: "rd-template",
          sourceKind: "FORM_SUBMISSION",
          status: "SIGNED",
          signing: {},
          templateInstance: {
            appointmentId: "appt-sched",
            encounterId: "enc-sched",
          },
        }),
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-sched" },
        FULL_PERMISSIONS,
      );

      // The already-rendered schedule is skipped; only the new one is rendered.
      expect(createRenderedDocumentRecord).toHaveBeenCalledTimes(1);
      expect(createRenderedDocumentRecord).toHaveBeenCalledWith({
        title: "Inpatient Schedule",
        source: {
          sourceKind: "TASK_SCHEDULE",
          sourceId: "sched-new",
          organisationId: ORG,
          templateKind: "INPATIENT_SCHEDULE",
          templateId: "tpl-2",
          templateVersion: 2,
        },
      });

      const renderedQuery = db.renderedDocument.findMany.mock.calls.at(
        -1,
      )?.[0] as { where?: { OR?: Array<Record<string, unknown>> } };
      expect(renderedQuery?.where?.OR).toEqual(
        expect.arrayContaining([
          {
            sourceKind: "TASK_SCHEDULE",
            sourceId: { in: ["sched-rendered", "sched-new"] },
          },
        ]),
      );

      const byId = new Map(
        result.documents.map((document) => [document.documentId, document]),
      );
      expect(byId.get("rd-sched")).toMatchObject({
        appointmentId: "appt-sched",
        encounterId: "enc-sched",
        signingStatus: "SIGNED",
      });
      expect(byId.get("rd-orphan")).toMatchObject({
        appointmentId: null,
        encounterId: null,
        signingStatus: "NOT_STARTED",
      });
      expect(byId.get("rd-signing")).toMatchObject({
        signingStatus: "IN_PROGRESS",
        appointmentId: "appt-sched",
        encounterId: "enc-sched",
      });
      // A signing envelope with no status falls back to the document status.
      expect(byId.get("rd-template")).toMatchObject({
        signingStatus: "SIGNED",
        appointmentId: "appt-sched",
        encounterId: "enc-sched",
      });
    });

    it("maps a parent-private upload as an unsigned draft with no companion", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-doc" }),
      );
      db.document.findMany.mockResolvedValue([
        {
          id: "doc-private",
          patientId: null,
          appointmentId: null,
          category: "OTHER",
          title: "Private upload",
          pmsVisible: false,
          createdAt: DAY,
          updatedAt: DAY,
        },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-doc" },
        FULL_PERMISSIONS,
      );

      expect(result.documents).toEqual([
        expect.objectContaining({
          documentId: "doc-private",
          sourceKind: "DOCUMENT",
          companionId: null,
          appointmentId: null,
          status: "DRAFT",
          signingStatus: "NOT_STARTED",
        }),
      ]);
    });
  });

  describe("workspace context resolution", () => {
    it("ignores unusable patient identifiers on the appointment", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({
          id: "appt-badpatient",
          caseId: "case-badpatient",
          productItemId: "prod-missing",
          patient: { id: 42, parent: { id: "   " } },
        }),
      );
      db.case.findFirst.mockResolvedValue({
        id: "case-badpatient",
        organisationId: ORG,
        patientId: "pet-cov",
        parentId: "parent-from-case",
        status: "active",
        appointmentKind: "OUTPATIENT",
        title: "Episode",
        description: "Ongoing dermatitis",
        createdAt: DAY,
        updatedAt: DAY,
      });
      db.parent.findFirst.mockResolvedValue({
        id: "parent-from-case",
        firstName: "Ada",
        lastName: null,
        createdAt: DAY,
        updatedAt: DAY,
      });

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-badpatient" },
        FULL_PERMISSIONS,
      );

      expect(db.patient.findFirst).not.toHaveBeenCalled();
      expect(result.companion).toBeNull();
      // The parent falls back to the episode of care.
      expect(result.client).toMatchObject({ id: "parent-from-case" });
      expect(result.client?.name).toBe("Ada");
      expect(result.episodeOfCare?.description).toBe("Ongoing dermatitis");
      // The product lookup found nothing, so no product kind is surfaced.
      expect(result.appointment).toMatchObject({
        productItemId: "prod-missing",
        productKind: null,
      });
    });

    it("ignores a non-object patient payload on the appointment", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-nopatient", patient: "unknown" }),
      );

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-nopatient" },
        FULL_PERMISSIONS,
      );

      expect(result.companion).toBeNull();
      expect(result.client).toBeNull();
      expect(db.parent.findFirst).not.toHaveBeenCalled();
    });

    it("locks an inpatient chart using the inpatient lock window", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-inpatient", appointmentKind: "INPATIENT" }),
      );
      db.organization.findUnique.mockResolvedValue({
        appointmentLockWindowOutpatientMinutes: 100000,
        appointmentLockWindowInpatientMinutes: 0,
      });
      db.admission.findUnique.mockResolvedValue(null);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-inpatient" },
        FULL_PERMISSIONS,
      );

      expect(result.locks.appointment).toBe(true);
      // An inpatient visit with no admission row cannot be finalized.
      expect(result.finalizationGate.inpatientRoomAdmissionReady).toBe(false);
      expect(result.finalizationGate.disabledReason).toBe(
        "Inpatient admission or room state is incomplete.",
      );
    });

    it("leaves the chart unlocked when the organisation has no lock window", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-nolock", appointmentKind: "INPATIENT" }),
      );
      db.organization.findUnique.mockResolvedValue({
        appointmentLockWindowOutpatientMinutes: 30,
        appointmentLockWindowInpatientMinutes: null,
      });

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-nolock" },
        FULL_PERMISSIONS,
      );

      expect(result.locks.appointment).toBe(false);
    });

    it("leaves the chart unlocked for a negative lock window", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-neglock" }),
      );
      db.organization.findUnique.mockResolvedValue({
        appointmentLockWindowOutpatientMinutes: -1,
        appointmentLockWindowInpatientMinutes: null,
      });

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-neglock" },
        FULL_PERMISSIONS,
      );

      expect(result.locks.appointment).toBe(false);
    });

    it("surfaces the admission without a unit on the encounter", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-adm", encounterId: "enc-adm" }),
      );
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-adm", appointmentKind: "INPATIENT" }),
      );
      db.admission.findUnique.mockResolvedValue({
        encounterId: "enc-adm",
        organisationId: ORG,
        patientId: "pet-cov",
        unitId: null,
        admittedAt: DAY,
        dischargedAt: null,
      });

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-adm" },
        FULL_PERMISSIONS,
      );

      expect(
        (result.encounter as unknown as { admission?: unknown })?.admission,
      ).toEqual({
        encounterId: "enc-adm",
        organisationId: ORG,
        patientId: "pet-cov",
        unitId: undefined,
        admittedAt: DAY,
        dischargedAt: undefined,
      });
      expect(result.finalizationGate.inpatientRoomAdmissionReady).toBe(true);
    });
  });

  describe("prescription-derived treatment items", () => {
    it("derives virtual treatment rows from prescription medications", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-rx" }),
      );
      artifactService.listPrescriptionsForAppointment.mockResolvedValue([
        {
          artifact: {
            id: "rx-inventory",
            status: "IN_PROGRESS",
            createdAt: DAY,
            updatedAt: DAY,
          },
          prescription: {
            medications: [
              { inventoryItemId: "inv-1", quantity: 3 },
              "not-a-record",
              { name: "no quantity" },
            ],
          },
        },
        {
          artifact: {
            id: "rx-sku",
            status: "SIGNED",
            createdAt: DAY,
            updatedAt: DAY,
          },
          prescription: {
            medications: [{ inventoryItemSku: "SKU-9", quantity: 2 }],
          },
        },
        {
          artifact: {
            id: "rx-empty",
            status: "DRAFT",
            createdAt: DAY,
            updatedAt: DAY,
          },
          prescription: { medications: null },
        },
      ]);

      const result = await WorkspaceService.getAppointmentBootstrap(
        { organisationId: ORG, appointmentId: "appt-rx" },
        FULL_PERMISSIONS,
      );

      const virtual = result.treatmentItems as unknown as Array<
        Record<string, unknown>
      >;
      expect(virtual).toEqual([
        expect.objectContaining({
          id: "rx-inventory",
          productId: "inv-1",
          quantity: 4,
          medicationCount: 3,
          name: "Treatment items",
          organisationId: ORG,
          appointmentId: "appt-rx",
          encounterId: "appt-rx",
        }),
        expect.objectContaining({
          id: "rx-sku",
          productId: "SKU-9",
          quantity: 2,
        }),
        expect.objectContaining({
          id: "rx-empty",
          productId: "rx-empty",
          quantity: 0,
          medicationCount: 0,
          name: "Prescription",
        }),
      ]);
    });

    it("scopes encounter-only virtual rows to the encounter", async () => {
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-only", caseId: null }),
      );
      db.patient.findFirst.mockResolvedValue({
        id: "pet-cov",
        name: "Rex",
        type: "PET",
        status: "ACTIVE",
        createdAt: DAY,
        updatedAt: DAY,
      });
      artifactService.listPrescriptionsForEncounter.mockResolvedValue([
        {
          artifact: {
            id: "rx-enc",
            status: "DRAFT",
            createdAt: DAY,
            updatedAt: DAY,
          },
          prescription: { medications: [{ quantity: 1 }] },
        },
      ]);

      const result = await WorkspaceService.getEncounterBootstrap(
        { organisationId: ORG, encounterId: "enc-only" },
        FULL_PERMISSIONS,
      );

      expect(result.treatmentItems[0]).toMatchObject({
        appointmentId: null,
        encounterId: "enc-only",
      });
      // With no appointment resolved, the treatment-item query is scoped to the encounter only.
      expect(db.workspaceTreatmentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: ORG,
            OR: [{ encounterId: "enc-only" }],
          },
        }),
      );
      expect(db.taskSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: ORG,
            OR: [{ encounterId: "enc-only" }, { patientId: "pet-cov" }],
          },
        }),
      );
      expect(db.templateInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: ORG,
            OR: [{ encounterId: "enc-only" }],
          },
        }),
      );
    });
  });

  describe("entry point delegation", () => {
    it("rejects an encounter bootstrap for an encounter that does not exist", async () => {
      db.encounter.findFirst.mockResolvedValue(null);

      await expect(
        WorkspaceService.getEncounterBootstrap(
          { organisationId: ORG, encounterId: "enc-missing" },
          FULL_PERMISSIONS,
        ),
      ).rejects.toMatchObject({
        message: "Encounter not found",
        statusCode: 404,
      });
    });

    it("returns only the finalization gate for the encounter gate endpoint", async () => {
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-gate", caseId: null }),
      );
      formService.listAppointmentFormSummaries.mockResolvedValue([]);
      db.task.findMany.mockResolvedValue([
        { id: "task-open", status: "IN_PROGRESS", dueAt: DAY },
      ]);

      const gate = await WorkspaceService.getEncounterFinalizationGate(
        { organisationId: ORG, encounterId: "enc-gate" },
        FULL_PERMISSIONS,
      );

      expect(gate).toEqual({
        enabled: false,
        disabledReason: "There are active tasks that still need attention.",
        requiredSoapOrDischargeComplete: true,
        requiredFormsSigned: true,
        pendingLabsResolved: true,
        billingReady: true,
        pendingDispenseRequestsResolved: true,
        inpatientRoomAdmissionReady: true,
        requiredTasksComplete: false,
      });
    });

    it("returns just the documents slice for the appointment documents endpoint", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-docs" }),
      );
      db.document.findMany.mockResolvedValue([
        {
          id: "doc-appt",
          patientId: "pet-cov",
          appointmentId: "appt-docs",
          category: "LAB",
          title: "Result",
          pmsVisible: true,
          createdAt: DAY,
          updatedAt: DAY,
        },
      ]);

      const documents = await WorkspaceService.getAppointmentDocuments(
        { organisationId: ORG, appointmentId: "appt-docs" },
        ["appointments:view:any", "document:view:any"],
      );

      expect(documents).toEqual([
        expect.objectContaining({
          documentId: "doc-appt",
          appointmentId: "appt-docs",
          companionId: "pet-cov",
          status: "SIGNED",
          signingStatus: "SIGNED",
        }),
      ]);
    });

    it("returns the full document set to a system-access appointment caller", async () => {
      db.appointment.findFirst.mockResolvedValue(
        appointmentRow({ id: "appt-system" }),
      );
      db.document.findMany.mockResolvedValue([
        {
          id: "doc-system",
          patientId: "pet-cov",
          appointmentId: "appt-system",
          category: "HEALTH",
          title: "Packet source",
          pmsVisible: true,
          createdAt: DAY,
          updatedAt: DAY,
        },
      ]);

      const documents = await WorkspaceService.getAppointmentDocuments(
        { organisationId: ORG, appointmentId: "appt-system" },
        [],
        { systemAccess: true },
      );

      expect(documents).toEqual([
        expect.objectContaining({ documentId: "doc-system" }),
      ]);
    });

    it("returns the full document set to a system-access encounter caller", async () => {
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-system", caseId: null }),
      );
      db.document.findMany.mockResolvedValue([
        {
          id: "doc-enc-system",
          patientId: "pet-cov",
          appointmentId: null,
          category: "HEALTH",
          title: "Packet source",
          pmsVisible: true,
          createdAt: DAY,
          updatedAt: DAY,
        },
      ]);

      const documents = await WorkspaceService.getEncounterDocuments(
        { organisationId: ORG, encounterId: "enc-system" },
        [],
        { systemAccess: true },
      );

      expect(documents).toEqual([
        expect.objectContaining({ documentId: "doc-enc-system" }),
      ]);
    });

    it("merges per-encounter and direct uploads for companion documents", async () => {
      db.patientOrganisation.findFirst.mockResolvedValue({ id: "link-cov" });
      db.encounter.findMany.mockResolvedValue([{ id: "enc-comp" }]);
      db.encounter.findFirst.mockResolvedValue(
        encounterRow({ id: "enc-comp", caseId: null, patientId: "pet-comp" }),
      );
      db.document.findMany.mockResolvedValue([
        {
          id: "doc-shared",
          patientId: "pet-comp",
          appointmentId: null,
          category: "SOAP_NOTE",
          title: "Chart",
          pmsVisible: true,
          createdAt: DAY,
          updatedAt: DAY,
        },
      ]);

      const documents = await WorkspaceService.getCompanionDocuments({
        organisationId: ORG,
        companionId: "pet-comp",
      });

      // The same document is reachable through the encounter and the direct read;
      // it must appear exactly once.
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({ documentId: "doc-shared" });
    });
  });
});
