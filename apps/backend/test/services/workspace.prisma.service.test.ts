import { prisma } from "src/config/prisma";
import { FormAssignmentService } from "src/services/form-assignment.service";
import { ClinicalArtifactService } from "src/services/clinical-artifact.service";
import {
  WorkspaceService,
  WorkspaceServiceError,
  dedupeTreatmentItemsByPrescription,
} from "../../src/services/workspace.prisma.service";
import { InvoiceService } from "src/services/invoice.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: { findFirst: jest.fn() },
    encounter: { findFirst: jest.fn(), findMany: jest.fn() },
    case: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
    patient: { findFirst: jest.fn() },
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
    invoice: { findFirst: jest.Mock };
    organization: { findUnique: jest.Mock };
    patient: { findFirst: jest.Mock };
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
    mockedPrisma.organization.findUnique.mockResolvedValue(null);
    mockedPrisma.patient.findFirst.mockResolvedValue(null);
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
      ["appointments:view:any", "tasks:view:any"],
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
    expect(
      mockedFormService.syncLinkedTemplateAssignmentsForAppointment,
    ).toHaveBeenCalledWith({
      organisationId: "org-1",
      appointmentId: "appt-1",
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
    expect(items).toHaveLength(1);

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
    expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
      "appt-1",
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
      [],
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

    const result = await WorkspaceService.getEncounterDocuments({
      organisationId: "org-doc",
      encounterId: "enc-doc-1",
    });

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

    await WorkspaceService.getEncounterDocuments({
      organisationId: "org-doc",
      encounterId: "enc-doc-2",
    });

    // The read model is built from the rendered-document pipeline and direct uploads; the
    // legacy form-submission store is never read (it is absent from the prisma mock, so any
    // dependency on it would throw here). This locks in the legacy-forms retirement.
    expect(mockedPrisma.renderedDocument.findMany).toHaveBeenCalled();
    expect(mockedPrisma.document.findMany).toHaveBeenCalled();
    expect(mockedPrisma).not.toHaveProperty("formSubmission");
  });

  it("returns companion medical records only", async () => {
    mockedPrisma.patient.findFirst.mockResolvedValue({
      id: "patient-med",
      name: "Milo",
      type: "PET",
      status: "ACTIVE",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
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
