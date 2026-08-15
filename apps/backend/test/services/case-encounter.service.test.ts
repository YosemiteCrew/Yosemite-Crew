import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CaseEncounterService,
  CaseEncounterServiceError,
} from "../../src/services/case-encounter.service";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";
import { WorkspaceService } from "../../src/services/workspace.prisma.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/services/catalog.service", () => ({
  __esModule: true,
  CatalogServiceError: class CatalogServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "CatalogServiceError";
    }
  },
  CatalogService: {
    resolveSelection: jest.fn(),
  },
}));

jest.mock("../../src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getEncounterFinalizationGate: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    case: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    encounter: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    financeEvent: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    roomUnit: {
      findUnique: jest.fn(),
    },
    roomUnitGroup: {
      findUnique: jest.fn(),
    },
    companion: {
      findUnique: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    roomUnitAssignment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    workspaceTreatmentItem: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    templateInstance: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    clinicalArtifact: {
      create: jest.fn(),
    },
    prescription: {
      create: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;
const mockedCatalogService = CatalogService as unknown as {
  resolveSelection: jest.Mock;
};
const mockedWorkspaceService = WorkspaceService as any;
const mockedAuditTrailService = AuditTrailService as any;

const baseCaseRow = {
  id: "case_1",
  organisationId: "org_1",
  patientId: "comp_1",
  parentId: "parent_1",
  status: "active",
  appointmentKind: "INPATIENT" as const,
  title: "Case title",
  description: "Case description",
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

const baseEncounterRow = {
  id: "enc_1",
  caseId: "case_1",
  organisationId: "org_1",
  patientId: "comp_1",
  parentId: "parent_1",
  status: "planned",
  encounterClass: "IMP",
  appointmentKind: "INPATIENT" as const,
  title: "Admission encounter",
  reason: "Observation",
  periodStart: new Date("2026-06-11T10:30:00.000Z"),
  periodEnd: new Date("2026-06-11T11:00:00.000Z"),
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

describe("CaseEncounterService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(mockedPrisma),
    );
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue(null);
    mockedPrisma.admission.findMany.mockResolvedValue([] as never);
    mockedWorkspaceService.getEncounterFinalizationGate.mockResolvedValue({
      enabled: true,
      disabledReason: null,
      requiredSoapOrDischargeComplete: true,
      requiredFormsSigned: true,
      pendingLabsResolved: true,
      billingReady: true,
      pendingDispenseRequestsResolved: true,
      inpatientRoomAdmissionReady: true,
      requiredTasksComplete: true,
    });
    mockedAuditTrailService.recordSafely.mockResolvedValue(undefined);
    mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([]);
    mockedPrisma.workspaceTreatmentItem.create.mockResolvedValue({
      id: "ti_1",
    } as never);
    mockedPrisma.templateInstance.findFirst.mockResolvedValue(null);
    mockedPrisma.templateInstance.create.mockResolvedValue({
      id: "template_instance_pkg_1",
    } as never);
    mockedPrisma.clinicalArtifact.create.mockResolvedValue({
      id: "artifact_pkg_rx_1",
      organisationId: "org_1",
    } as never);
    mockedPrisma.prescription.create.mockResolvedValue({
      id: "rx_pkg_1",
    } as never);
    mockedCatalogService.resolveSelection.mockResolvedValue(null as never);
  });

  it("creates a case", async () => {
    mockedPrisma.case.create.mockResolvedValue(baseCaseRow as never);

    const result = await CaseEncounterService.createCase(
      {
        organisationId: "org_1",
        patientId: "comp_1",
        parentId: "parent_1",
        status: "active",
        appointmentKind: "INPATIENT",
        title: "Case title",
        description: "Case description",
      },
      "org_1",
    );

    expect(mockedPrisma.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org_1",
        patientId: "comp_1",
        status: "active",
        appointmentKind: "INPATIENT",
      }),
    });
    expect(result.id).toBe("case_1");
  });

  it("rejects invalid case and encounter status values", async () => {
    await expect(
      CaseEncounterService.createCase(
        {
          organisationId: "org_1",
          patientId: "comp_1",
          parentId: "parent_1",
          status: "bogus" as never,
          appointmentKind: "INPATIENT",
        } as never,
        "org_1",
      ),
    ).rejects.toMatchObject({
      message: "Invalid case status.",
      statusCode: 400,
    } satisfies Partial<CaseEncounterServiceError>);

    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    await expect(
      CaseEncounterService.createEncounter(
        {
          caseId: "case_1",
          organisationId: "org_1",
          patientId: "comp_1",
          status: "planned",
          encounterClass: "bogus" as never,
          appointmentKind: "INPATIENT",
        } as never,
        "org_1",
      ),
    ).rejects.toMatchObject({
      message: "Invalid encounter class.",
      statusCode: 400,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("creates an encounter and links the appointment", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.create.mockResolvedValue(baseEncounterRow as never);
    mockedPrisma.appointment.update.mockResolvedValue({
      id: "appt_1",
    } as never);

    const result = await CaseEncounterService.createEncounter(
      {
        caseId: "case_1",
        appointmentId: "appt_1",
        organisationId: "org_1",
        patientId: "comp_1",
        parentId: "parent_1",
        status: "planned",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
        title: "Admission encounter",
        reason: "Observation",
        periodStart: new Date("2026-06-11T10:30:00.000Z"),
        periodEnd: new Date("2026-06-11T11:00:00.000Z"),
      },
      "org_1",
    );

    expect(mockedPrisma.encounter.create).toHaveBeenCalled();
    expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(result.appointmentId).toBe("appt_1");
  });

  it("rejects creating an encounter for an appointment already linked to another encounter", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: "enc_existing",
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);

    await expect(
      CaseEncounterService.createEncounter(
        {
          caseId: "case_1",
          appointmentId: "appt_1",
          organisationId: "org_1",
          patientId: "comp_1",
          parentId: "parent_1",
          status: "planned",
          encounterClass: "IMP",
          appointmentKind: "INPATIENT",
        } as never,
        "org_1",
      ),
    ).rejects.toMatchObject({
      message: "Appointment is already linked to a different encounter.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);

    expect(mockedPrisma.encounter.create).not.toHaveBeenCalled();
    expect(mockedPrisma.appointment.update).not.toHaveBeenCalled();
  });

  it("expands a package appointment into workspace treatment rows once", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_pkg",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      productItemId: "pkg_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.create.mockResolvedValue({
      ...baseEncounterRow,
      id: "enc_pkg",
    } as never);
    mockedPrisma.appointment.update.mockResolvedValue({
      id: "appt_pkg",
    } as never);
    mockedCatalogService.resolveSelection.mockResolvedValue({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Bundle",
      code: "PKG-1",
      currency: "USD",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      grossAmount: 100,
      itemDiscountAmount: 0,
      additionalDiscountAmount: 0,
      finalAmount: 100,
      templateKinds: [],
      templateBindings: [
        {
          templateKind: "INPATIENT_SCHEDULE",
          templateId: "tmpl_schedule_1",
          templateVersion: 3,
        },
        {
          templateKind: "TASK_ASSIGNMENT",
          templateId: "tmpl_task_1",
          templateVersion: 1,
        },
      ],
      billingItems: [
        {
          productItemId: "pkg_1",
          code: "PKG-1",
          name: "Bundle",
          kind: "PACKAGE",
          quantity: 1,
          currency: "USD",
          unitPrice: 100,
          referenceUnitPrice: null,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 100,
          discountAmount: 0,
          finalAmount: 100,
          isPackageComponent: false,
          packageProductItemId: null,
        },
        {
          productItemId: "svc_1",
          code: "LAB-1",
          name: "Lab",
          kind: "LAB_TEST",
          quantity: 2,
          currency: "USD",
          unitPrice: 30,
          referenceUnitPrice: 30,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 60,
          discountAmount: 0,
          finalAmount: 60,
          isPackageComponent: true,
          packageProductItemId: "pkg_1",
        },
      ],
      includedItems: [
        {
          productItemId: "med_1",
          code: "MED-1",
          name: "Medication",
          kind: "MEDICATION",
          quantity: 1,
          currency: "USD",
          unitPrice: 0,
          referenceUnitPrice: 25,
          defaultDiscountPercent: null,
          maxDiscountPercent: null,
          discountPercent: 0,
          grossAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          isPackageComponent: true,
          packageProductItemId: "pkg_1",
        },
      ],
    } as never);

    const result = await CaseEncounterService.createEncounter(
      {
        caseId: "case_1",
        appointmentId: "appt_pkg",
        organisationId: "org_1",
        patientId: "comp_1",
        parentId: "parent_1",
        status: "planned",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
        title: "Admission encounter",
        reason: "Observation",
        periodStart: new Date("2026-06-11T10:30:00.000Z"),
        periodEnd: new Date("2026-06-11T11:00:00.000Z"),
      },
      "org_1",
    );

    expect(mockedCatalogService.resolveSelection).toHaveBeenCalledWith(
      "pkg_1",
      "org_1",
    );
    expect(mockedPrisma.workspaceTreatmentItem.create).toHaveBeenCalledTimes(3);
    expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "PRESCRIPTION",
        status: "DRAFT",
        summary: "Bundle medication package",
      }),
    });
    expect(mockedPrisma.templateInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tmpl_schedule_1",
        templateVersion: 3,
        data: expect.objectContaining({
          origin: "PACKAGE_EXPANSION",
          packageId: "pkg_1",
          templateKind: "INPATIENT_SCHEDULE",
        }),
      }),
    });
    expect(mockedPrisma.templateInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tmpl_task_1",
        templateVersion: 1,
        data: expect.objectContaining({
          origin: "PACKAGE_EXPANSION",
          packageId: "pkg_1",
          templateKind: "TASK_ASSIGNMENT",
        }),
      }),
    });
    expect(mockedPrisma.prescription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artifactId: "artifact_pkg_rx_1",
        metadata: expect.objectContaining({
          origin: "PACKAGE_EXPANSION",
          packageId: "pkg_1",
        }),
        items: {
          create: [
            expect.objectContaining({
              medication: "Medication",
              quantity: "1",
            }),
          ],
        },
      }),
    });
    expect(mockedPrisma.workspaceTreatmentItem.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "pkg_1",
          servicePackageKind: "PACKAGE",
          quantity: 1,
          priceSnapshot: expect.objectContaining({
            unitPrice: 100,
            packageProductItemId: "pkg_1",
            origin: "PACKAGE_EXPANSION",
          }),
        }),
      }),
    );
    expect(mockedPrisma.workspaceTreatmentItem.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "med_1",
          servicePackageKind: "MEDICATION",
          priceSnapshot: expect.objectContaining({
            unitPrice: 0,
            finalAmount: 0,
            packageProductItemId: "pkg_1",
            origin: "PACKAGE_EXPANSION",
          }),
          productSnapshot: expect.objectContaining({
            packageProductItemId: "pkg_1",
            origin: "PACKAGE_EXPANSION",
          }),
        }),
      }),
    );
    expect(result.appointmentId).toBe("appt_pkg");
  });

  it("does not duplicate package treatment rows when they already exist", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_pkg",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      productItemId: "pkg_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.create.mockResolvedValue({
      ...baseEncounterRow,
      id: "enc_pkg",
    } as never);
    mockedPrisma.appointment.update.mockResolvedValue({
      id: "appt_pkg",
    } as never);
    mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([
      {
        productSnapshot: { packageProductItemId: "pkg_1" },
      },
    ] as never);
    mockedCatalogService.resolveSelection.mockResolvedValue({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Bundle",
      code: "PKG-1",
      currency: "USD",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      grossAmount: 100,
      itemDiscountAmount: 0,
      additionalDiscountAmount: 0,
      finalAmount: 100,
      templateKinds: [],
      templateBindings: [
        {
          templateKind: "INPATIENT_SCHEDULE",
          templateId: "tmpl_schedule_1",
          templateVersion: 3,
        },
        {
          templateKind: "TASK_ASSIGNMENT",
          templateId: "tmpl_task_1",
          templateVersion: 1,
        },
      ],
      billingItems: [],
      includedItems: [],
    } as never);

    await CaseEncounterService.createEncounter(
      {
        caseId: "case_1",
        appointmentId: "appt_pkg",
        organisationId: "org_1",
        patientId: "comp_1",
        status: "planned",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
      },
      "org_1",
    );

    expect(mockedPrisma.workspaceTreatmentItem.create).not.toHaveBeenCalled();
    expect(mockedPrisma.clinicalArtifact.create).not.toHaveBeenCalled();
    expect(mockedPrisma.prescription.create).not.toHaveBeenCalled();
    expect(mockedPrisma.templateInstance.create).not.toHaveBeenCalled();
  });

  it("rejects encounter creation when appointment belongs to another companion", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      patient: { id: "comp_2" },
    } as never);

    await expect(
      CaseEncounterService.createEncounter(
        {
          caseId: "case_1",
          appointmentId: "appt_1",
          organisationId: "org_1",
          patientId: "comp_1",
          status: "planned",
          encounterClass: "IMP",
          appointmentKind: "INPATIENT",
        },
        "org_1",
      ),
    ).rejects.toMatchObject({
      message: "Encounter appointment companion mismatch.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("updates an encounter and re-links the appointment", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt_old",
      caseId: "case_1",
      encounterId: "enc_1",
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_new",
      caseId: "case_1",
      encounterId: null,
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "arrived",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_new", encounterId: "enc_1" },
    ] as never);

    const result = await CaseEncounterService.updateEncounter(
      "enc_1",
      "org_1",
      {
        appointmentId: "appt_new",
        status: "arrived",
      },
    );

    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(1, {
      where: { id: "appt_old" },
      data: { encounterId: null },
    });
    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(2, {
      where: { id: "appt_new" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(result.status).toBe("arrived");
    expect(result.appointmentId).toBe("appt_new");
  });

  it("gets an encounter with its linked appointment id", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        bedUnitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.getEncounterById(
      "enc_1",
      "org_1",
    );

    expect(result.id).toBe("enc_1");
    expect(result.appointmentId).toBe("appt_1");
    expect(result.admission?.encounterId).toBe("enc_1");
  });

  it("lists encounters with linked appointment ids", async () => {
    mockedPrisma.encounter.findMany.mockResolvedValue([
      baseEncounterRow,
      { ...baseEncounterRow, id: "enc_2", caseId: "case_2" },
    ] as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
      { id: "appt_2", encounterId: "enc_2" },
    ] as never);

    const results = await CaseEncounterService.listEncounters({
      organisationId: "org_1",
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.appointmentId).toBe("appt_1");
    expect(results[1]?.appointmentId).toBe("appt_2");
  });

  it("returns an empty list without loading appointments when no encounters exist", async () => {
    mockedPrisma.encounter.findMany.mockResolvedValue([] as never);

    const results = await CaseEncounterService.listEncounters({
      organisationId: "org_1",
    });

    expect(results).toEqual([]);
    expect(mockedPrisma.appointment.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.admission.findMany).not.toHaveBeenCalled();
  });

  it("discharges an inpatient encounter and closes admission", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      bedUnitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue({
      id: "assign_1",
      encounterId: "enc_1",
      admissionId: "enc_1",
      unitId: "unit_1",
      assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      releasedAt: null,
      assignedBy: "user_1",
      reason: "Monitoring",
      createdAt: new Date("2026-06-11T11:00:00.000Z"),
      updatedAt: new Date("2026-06-11T11:00:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.update.mockResolvedValue({
      id: "assign_1",
    } as never);
    mockedPrisma.admission.update.mockResolvedValue({
      encounterId: "enc_1",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "finished",
      periodEnd: new Date("2026-06-11T12:00:00.000Z"),
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        bedUnitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.dischargeEncounter(
      "enc_1",
      "org_1",
      {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    );

    expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      data: {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        unitId: null,
      },
    });
    expect(mockedPrisma.roomUnitAssignment.update).toHaveBeenCalledWith({
      where: { id: "assign_1" },
      data: {
        releasedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "finished",
        periodEnd: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(result.status).toBe("finished");
    expect(result.admission?.dischargedAt?.toISOString()).toBe(
      "2026-06-11T12:00:00.000Z",
    );
  });

  it("blocks discharge when the finalization gate is disabled and no override reason is provided", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
    } as never);
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedWorkspaceService.getEncounterFinalizationGate.mockResolvedValueOnce({
      enabled: false,
      disabledReason: "Required forms are still pending.",
      requiredSoapOrDischargeComplete: true,
      requiredFormsSigned: false,
      pendingLabsResolved: true,
      billingReady: true,
      pendingDispenseRequestsResolved: true,
      inpatientRoomAdmissionReady: true,
      requiredTasksComplete: true,
    });

    await expect(
      CaseEncounterService.dischargeEncounter("enc_1", "org_1", {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message: "Required forms are still pending.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("allows discharge with an override reason and records the audit trail", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
    } as never);
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedWorkspaceService.getEncounterFinalizationGate.mockResolvedValueOnce({
      enabled: false,
      disabledReason: "Pending labs still block finalization.",
      requiredSoapOrDischargeComplete: true,
      requiredFormsSigned: false,
      pendingLabsResolved: false,
      billingReady: true,
      pendingDispenseRequestsResolved: true,
      inpatientRoomAdmissionReady: true,
      requiredTasksComplete: true,
    });
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null);
    mockedPrisma.admission.update.mockResolvedValue({
      encounterId: "enc_1",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "finished",
      periodEnd: new Date("2026-06-11T12:00:00.000Z"),
    } as never);
    mockedAuditTrailService.recordSafely.mockResolvedValue(undefined);

    const result = await CaseEncounterService.dischargeEncounter(
      "enc_1",
      "org_1",
      {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        overrideReason: "Clinical lead approved override.",
        actorUserId: "user_1",
      },
    );

    expect(
      mockedWorkspaceService.getEncounterFinalizationGate,
    ).toHaveBeenCalledWith({
      organisationId: "org_1",
      encounterId: "enc_1",
    });
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ENCOUNTER_DISCHARGE_OVERRIDDEN",
        actorType: "PMS_USER",
        actorId: "user_1",
        entityType: "ENCOUNTER",
        entityId: "enc_1",
        metadata: expect.objectContaining({
          overrideReason: "Clinical lead approved override.",
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ENCOUNTER_DISCHARGED",
        actorType: "PMS_USER",
        actorId: "user_1",
        entityType: "ENCOUNTER",
        entityId: "enc_1",
      }),
    );
    expect(result.status).toBe("finished");
  });

  it("rejects closing a finished encounter when marking ready for discharge", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "finished",
    } as never);

    await expect(
      CaseEncounterService.markEncounterReadyForDischarge("enc_1", "org_1"),
    ).rejects.toMatchObject({
      message: "Cannot mark ready for discharge a closed encounter.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("assigns a unit to an active admission", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null as never);
    mockedPrisma.roomUnitAssignment.create.mockResolvedValue({
      id: "assign_1",
    } as never);
    mockedPrisma.admission.update.mockResolvedValue({
      encounterId: "enc_1",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.assignUnit("enc_1", "org_1", {
      unitId: "unit_1",
      assignedBy: "user_1",
      reason: "Post-op monitoring",
      assignedAt: new Date("2026-06-11T11:00:00.000Z"),
    });

    expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalledWith({
      data: {
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        assignedBy: "user_1",
        reason: "Post-op monitoring",
      },
    });
    expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      data: {
        unitId: "unit_1",
      },
    });
    expect(result.admission?.unitId).toBe("unit_1");
  });

  it("rejects assignment when the unit species constraints do not match", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["cat"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);

    await expect(
      CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message: "Room unit is not compatible with this companion's species.",
      statusCode: 409,
    });
  });

  it("rejects assignment when the unit group species constraints do not match", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: "group_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
      id: "group_1",
      organisationId: "org_1",
      roomId: "room_1",
      name: "Cat ward",
      size: "M",
      unitCount: 2,
      speciesConstraints: ["cat"],
      capabilities: [],
      isActive: true,
    } as never);
    mockedPrisma.patient.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);

    await expect(
      CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message:
        "Room unit group is not compatible with this companion's species.",
      statusCode: 409,
    });
  });

  it("rejects assignment when the unit is already occupied by another admission", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue({
      id: "assign_other",
      encounterId: "enc_other",
      admissionId: "enc_other",
      unitId: "unit_1",
      assignedAt: new Date("2026-06-11T10:45:00.000Z"),
      releasedAt: null,
      assignedBy: "user_2",
      reason: "Occupied",
      createdAt: new Date("2026-06-11T10:45:00.000Z"),
      updatedAt: new Date("2026-06-11T10:45:00.000Z"),
    } as never);

    await expect(
      CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message: "Room unit is already occupied.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("lists unit assignment history for an encounter", async () => {
    mockedPrisma.roomUnitAssignment.findMany.mockResolvedValue([
      {
        id: "assign_1",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        releasedAt: new Date("2026-06-11T12:00:00.000Z"),
        assignedBy: "user_1",
        reason: "Transfer",
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
      {
        id: "assign_2",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_2",
        assignedAt: new Date("2026-06-11T12:15:00.000Z"),
        releasedAt: null,
        assignedBy: "user_1",
        reason: null,
        createdAt: new Date("2026-06-11T12:15:00.000Z"),
        updatedAt: new Date("2026-06-11T12:15:00.000Z"),
      },
    ] as never);

    mockedPrisma.encounter.findFirst.mockResolvedValue({
      id: "enc_1",
    } as never);

    const result = await CaseEncounterService.listUnitAssignments({
      organisationId: "org_1",
      encounterId: "enc_1",
    });

    expect(mockedPrisma.roomUnitAssignment.findMany).toHaveBeenCalledWith({
      where: {
        encounterId: "enc_1",
        admissionId: undefined,
        unitId: undefined,
        releasedAt: undefined,
        admission: { organisationId: "org_1" },
      },
      orderBy: { assignedAt: "asc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.unitId).toBe("unit_1");
    expect(result[1]?.releasedAt).toBeUndefined();
  });

  it("lists unit assignment history for an admission", async () => {
    mockedPrisma.admission.findFirst.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: "unit_1",
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.findMany.mockResolvedValue([
      {
        id: "assign_1",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        releasedAt: null,
        assignedBy: "user_1",
        reason: "Transfer",
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.listAdmissionUnitAssignments(
      "enc_1",
      "org_1",
    );

    expect(mockedPrisma.admission.findFirst).toHaveBeenCalledWith({
      where: { encounterId: "enc_1", organisationId: "org_1" },
    });
    expect(mockedPrisma.roomUnitAssignment.findMany).toHaveBeenCalledWith({
      where: {
        admissionId: "enc_1",
      },
      orderBy: { assignedAt: "asc" },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.admissionId).toBe("enc_1");
  });

  it("stamps the real actual-start when a not-yet-started encounter begins", async () => {
    // `periodStart` was seeded at check-in with the booked slot (10:30), which is
    // not a real start. Starting the encounter must record the actual-start
    // (12:00) so the visit timer runs instead of showing "Not started".
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "arrived",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
      periodStart: new Date("2026-06-11T12:00:00.000Z"),
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.startEncounter("enc_1", "org_1", {
      startedAt: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "in-progress",
        periodStart: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(result.status).toBe("in-progress");
  });

  it("preserves the recorded start when an already-started encounter re-starts", async () => {
    // Once genuinely started (in-progress/onleave), `periodStart` is a real start
    // and must survive a repeat transition so the visit timer never resets.
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
      periodStart: new Date("2026-06-11T09:15:00.000Z"),
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
      periodStart: new Date("2026-06-11T09:15:00.000Z"),
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([] as never);

    await CaseEncounterService.startEncounter("enc_1", "org_1", {
      startedAt: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "in-progress",
        periodStart: new Date("2026-06-11T09:15:00.000Z"),
      },
    });
  });

  it("falls back to startedAt when an already-started encounter has no recorded start", async () => {
    // An in-progress/onleave encounter normally keeps its recorded start, but
    // when none was ever stamped the transition time is the best real start.
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
      periodStart: null,
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
      periodStart: new Date("2026-06-11T12:00:00.000Z"),
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([] as never);

    await CaseEncounterService.startEncounter("enc_1", "org_1", {
      startedAt: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "in-progress",
        periodStart: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
  });

  it("marks an encounter ready for discharge", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.markEncounterReadyForDischarge(
      "enc_1",
      "org_1",
    );

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "onleave",
      },
    });
    expect(result.status).toBe("onleave");
  });

  it("reverts ready for discharge back to in-progress", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);

    const result = await CaseEncounterService.markEncounterNotReadyForDischarge(
      "enc_1",
      "org_1",
    );

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "in-progress",
      },
    });
    expect(result.status).toBe("in-progress");
  });

  it("rejects undo ready for discharge when encounter is not onleave", async () => {
    mockedPrisma.encounter.findFirst.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);

    await expect(
      CaseEncounterService.markEncounterNotReadyForDischarge("enc_1", "org_1"),
    ).rejects.toMatchObject({
      message:
        "Cannot undo ready for discharge unless the encounter is ready for discharge.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("lists active inpatient encounters for an organisation", async () => {
    mockedPrisma.admission.findMany.mockResolvedValueOnce([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
      {
        encounterId: "enc_2",
        organisationId: "org_1",
        patientId: "comp_2",
        unitId: "unit_2",
        expectedStayDays: 3,
        admittedAt: new Date("2026-06-11T11:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);
    mockedPrisma.encounter.findMany.mockResolvedValue([
      {
        ...baseEncounterRow,
        id: "enc_1",
        status: "arrived",
        periodStart: new Date("2026-06-11T10:30:00.000Z"),
      },
      {
        ...baseEncounterRow,
        id: "enc_2",
        status: "in-progress",
        periodStart: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
      { id: "appt_2", encounterId: "enc_2" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValueOnce([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
      {
        encounterId: "enc_2",
        organisationId: "org_1",
        patientId: "comp_2",
        unitId: "unit_2",
        expectedStayDays: 3,
        admittedAt: new Date("2026-06-11T11:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.listActiveInpatientEncounters({
      organisationId: "org_1",
    });

    expect(mockedPrisma.admission.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        organisationId: "org_1",
        dischargedAt: null,
      },
    });
    expect(mockedPrisma.encounter.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["enc_1", "enc_2"],
        },
        organisationId: "org_1",
        appointmentKind: "INPATIENT",
        status: {
          in: ["arrived", "triaged", "in-progress", "onleave"],
        },
      },
      orderBy: { periodStart: "asc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.appointmentId).toBe("appt_1");
    expect(result[0]?.admission?.unitId).toBe("unit_1");
  });

  describe("organisation scoping", () => {
    it("scopes every single-resource read to the authorized organisation", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(null as never);
      mockedPrisma.case.findFirst.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.getEncounterById("enc_1", "org_2"),
      ).rejects.toMatchObject({
        message: "Encounter not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
      expect(mockedPrisma.encounter.findFirst).toHaveBeenCalledWith({
        where: { id: "enc_1", organisationId: "org_2" },
      });

      await expect(
        CaseEncounterService.getCaseById("case_1", "org_2"),
      ).rejects.toMatchObject({
        message: "Case not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
      expect(mockedPrisma.case.findFirst).toHaveBeenCalledWith({
        where: { id: "case_1", organisationId: "org_2" },
      });
    });

    it("does not mutate an encounter owned by another organisation", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(null as never);

      for (const operation of [
        () => CaseEncounterService.startEncounter("enc_1", "org_2"),
        () =>
          CaseEncounterService.markEncounterReadyForDischarge("enc_1", "org_2"),
        () =>
          CaseEncounterService.markEncounterNotReadyForDischarge(
            "enc_1",
            "org_2",
          ),
        () => CaseEncounterService.dischargeEncounter("enc_1", "org_2"),
        () =>
          CaseEncounterService.assignUnit("enc_1", "org_2", {
            unitId: "unit_1",
          }),
        () => CaseEncounterService.updateEncounter("enc_1", "org_2", {}),
      ]) {
        await expect(operation()).rejects.toMatchObject({
          message: "Encounter not found.",
          statusCode: 404,
        } satisfies Partial<CaseEncounterServiceError>);
      }

      expect(mockedPrisma.encounter.update).not.toHaveBeenCalled();
      expect(mockedPrisma.admission.update).not.toHaveBeenCalled();
      expect(mockedPrisma.roomUnitAssignment.create).not.toHaveBeenCalled();
    });

    it("rejects a payload organisation that differs from the authorized one", async () => {
      await expect(
        CaseEncounterService.createCase(
          {
            organisationId: "org_2",
            patientId: "comp_1",
            status: "active",
            appointmentKind: "INPATIENT",
          } as never,
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "organisationId does not match the authorized organisation.",
        statusCode: 403,
      } satisfies Partial<CaseEncounterServiceError>);

      await expect(
        CaseEncounterService.createEncounter(
          {
            caseId: "case_1",
            organisationId: "org_2",
            patientId: "comp_1",
            status: "planned",
            encounterClass: "IMP",
            appointmentKind: "INPATIENT",
          } as never,
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "organisationId does not match the authorized organisation.",
        statusCode: 403,
      } satisfies Partial<CaseEncounterServiceError>);

      expect(mockedPrisma.case.create).not.toHaveBeenCalled();
      expect(mockedPrisma.encounter.create).not.toHaveBeenCalled();
    });

    it("refuses to assign a unit owned by another organisation", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue({
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      } as never);
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        id: "unit_1",
        organisationId: "org_2",
        roomId: "room_1",
        code: "KEN-01",
        displayName: "Kennel 1",
        size: "M",
        speciesConstraints: ["dog"],
        isActive: true,
        createdAt: new Date("2026-06-11T10:00:00.000Z"),
        updatedAt: new Date("2026-06-11T10:00:00.000Z"),
      } as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", {
          unitId: "unit_1",
        }),
      ).rejects.toMatchObject({
        message: "Unit organisation mismatch.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);

      expect(mockedPrisma.roomUnitAssignment.create).not.toHaveBeenCalled();
    });

    it("never lists assignments for a blank encounterId", async () => {
      for (const encounterId of ["", "   "]) {
        await expect(
          CaseEncounterService.listUnitAssignments({
            organisationId: "org_1",
            encounterId,
          }),
        ).rejects.toMatchObject({
          message: "encounterId is required.",
          statusCode: 400,
        } satisfies Partial<CaseEncounterServiceError>);
      }

      expect(mockedPrisma.roomUnitAssignment.findMany).not.toHaveBeenCalled();
    });

    it("does not list assignments for an encounter in another organisation", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(null as never);
      mockedPrisma.admission.findFirst.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.listUnitAssignments({
          organisationId: "org_2",
          encounterId: "enc_1",
        }),
      ).rejects.toMatchObject({
        message: "Encounter not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);

      await expect(
        CaseEncounterService.listAdmissionUnitAssignments("enc_1", "org_2"),
      ).rejects.toMatchObject({
        message: "Admission not found for encounter.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);

      expect(mockedPrisma.roomUnitAssignment.findMany).not.toHaveBeenCalled();
    });

    it("always constrains list queries to the authorized organisation", async () => {
      mockedPrisma.case.findMany.mockResolvedValue([] as never);
      mockedPrisma.encounter.findMany.mockResolvedValue([] as never);

      await CaseEncounterService.listCases({ organisationId: "org_1" });
      await CaseEncounterService.listEncounters({ organisationId: "org_1" });

      expect(mockedPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org_1" }),
        }),
      );
      expect(mockedPrisma.encounter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org_1" }),
        }),
      );

      for (const listWithBlankOrg of [
        () => CaseEncounterService.listCases({ organisationId: "  " }),
        () => CaseEncounterService.listEncounters({ organisationId: "" }),
        () =>
          CaseEncounterService.listActiveInpatientEncounters({
            organisationId: "",
          }),
      ]) {
        await expect(listWithBlankOrg()).rejects.toMatchObject({
          message: "organisationId is required.",
          statusCode: 400,
        } satisfies Partial<CaseEncounterServiceError>);
      }

      expect(mockedPrisma.case.findMany).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.encounter.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("additional coverage", () => {
    const activeAdmission = {
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    };

    const activeUnit = {
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    };

    const baseEncounterInput = {
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      parentId: "parent_1",
      status: "planned" as const,
      encounterClass: "IMP" as const,
      appointmentKind: "INPATIENT" as const,
      title: "Admission encounter",
      reason: "Observation",
    };

    const buildPackageSelection = (over: Record<string, unknown> = {}) => ({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Bundle",
      code: "PKG-1",
      currency: "USD",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      grossAmount: 100,
      itemDiscountAmount: 0,
      additionalDiscountAmount: 0,
      finalAmount: 100,
      templateKinds: [],
      templateBindings: [],
      billingItems: [],
      includedItems: [],
      ...over,
    });

    // -- createCase optional fallbacks --------------------------------------

    it("creates a case with null fallbacks for absent optional fields", async () => {
      mockedPrisma.case.create.mockResolvedValue({
        ...baseCaseRow,
        parentId: null,
        title: null,
        description: null,
      } as never);

      const result = await CaseEncounterService.createCase(
        {
          organisationId: "org_1",
          patientId: "comp_1",
          status: "planned",
          appointmentKind: "INPATIENT",
        } as never,
        "org_1",
      );

      expect(mockedPrisma.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: null,
          title: null,
          description: null,
        }),
      });
      expect(result.parentId).toBeUndefined();
    });

    // -- updateCase ---------------------------------------------------------

    it("updates a case with all mutable fields", async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.case.update.mockResolvedValue({
        ...baseCaseRow,
        status: "onhold",
        parentId: "parent_2",
        title: "New title",
        description: "New description",
      } as never);

      const result = await CaseEncounterService.updateCase("case_1", "org_1", {
        status: "onhold",
        appointmentKind: "OUTPATIENT",
        parentId: "parent_2",
        title: "New title",
        description: "New description",
      });

      expect(mockedPrisma.case.update).toHaveBeenCalledWith({
        where: { id: "case_1" },
        data: {
          status: "onhold",
          appointmentKind: "OUTPATIENT",
          parentId: "parent_2",
          title: "New title",
          description: "New description",
        },
      });
      expect(result.status).toBe("onhold");
    });

    it("leaves omitted case fields untouched on update", async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.case.update.mockResolvedValue(baseCaseRow as never);

      await CaseEncounterService.updateCase("case_1", "org_1", {});

      expect(mockedPrisma.case.update).toHaveBeenCalledWith({
        where: { id: "case_1" },
        data: {
          status: undefined,
          appointmentKind: undefined,
          parentId: undefined,
          title: undefined,
          description: undefined,
        },
      });
    });

    it("normalizes blank case fields to null on update", async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.case.update.mockResolvedValue(baseCaseRow as never);

      await CaseEncounterService.updateCase("case_1", "org_1", {
        parentId: "   ",
        title: "",
        description: "  ",
      });

      expect(mockedPrisma.case.update).toHaveBeenCalledWith({
        where: { id: "case_1" },
        data: {
          status: undefined,
          appointmentKind: undefined,
          parentId: null,
          title: null,
          description: null,
        },
      });
    });

    it("rejects updating a case that does not exist", async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.updateCase("case_1", "org_1", {
          status: "active",
        }),
      ).rejects.toMatchObject({
        message: "Case not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
      expect(mockedPrisma.case.update).not.toHaveBeenCalled();
    });

    // -- getCaseById success -------------------------------------------------

    it("returns a case scoped to the authorized organisation", async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(baseCaseRow as never);

      const result = await CaseEncounterService.getCaseById("case_1", "org_1");

      expect(mockedPrisma.case.findFirst).toHaveBeenCalledWith({
        where: { id: "case_1", organisationId: "org_1" },
      });
      expect(result.id).toBe("case_1");
      expect(result.title).toBe("Case title");
    });

    // -- createEncounter status / period validation --------------------------

    it("rejects an invalid encounter status", async () => {
      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, status: "bogus" as never },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Invalid encounter status.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects an invalid periodStart", async () => {
      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, periodStart: new Date("not-a-date") },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Invalid encounter periodStart.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects an invalid periodEnd", async () => {
      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, periodEnd: new Date("not-a-date") },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Invalid encounter periodEnd.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects a periodEnd before periodStart", async () => {
      await expect(
        CaseEncounterService.createEncounter(
          {
            ...baseEncounterInput,
            periodStart: new Date("2026-06-11T12:00:00.000Z"),
            periodEnd: new Date("2026-06-11T10:00:00.000Z"),
          },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "periodEnd must be after periodStart.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    // -- createEncounter transaction guards ----------------------------------

    it("rejects encounter creation when the case is missing", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.createEncounter(baseEncounterInput, "org_1"),
      ).rejects.toMatchObject({
        message: "Case not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects encounter creation when the case belongs to another organisation", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        ...baseCaseRow,
        organisationId: "org_other",
      } as never);

      await expect(
        CaseEncounterService.createEncounter(baseEncounterInput, "org_1"),
      ).rejects.toMatchObject({
        message: "Encounter organisationId must match case organisationId.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects encounter creation when the case belongs to another companion", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        ...baseCaseRow,
        patientId: "comp_other",
      } as never);

      await expect(
        CaseEncounterService.createEncounter(baseEncounterInput, "org_1"),
      ).rejects.toMatchObject({
        message: "Encounter patientId must match case patientId.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects encounter creation when the appointment is missing", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.appointment.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, appointmentId: "appt_1" },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects encounter creation when the appointment organisation differs", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: "appt_1",
        caseId: null,
        encounterId: null,
        organisationId: "org_other",
        patient: { id: "comp_1" },
      } as never);

      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, appointmentId: "appt_1" },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Encounter appointment organisation mismatch.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects encounter creation when the appointment is linked to another case", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: "appt_1",
        caseId: "case_other",
        encounterId: null,
        organisationId: "org_1",
        patient: { id: "comp_1" },
      } as never);

      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, appointmentId: "appt_1" },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Appointment is already linked to a different case.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    // -- resolveSelectionSafe -----------------------------------------------

    const primeAppointmentPackageCreate = (productItemId = "pkg_1") => {
      mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: "appt_pkg",
        caseId: null,
        encounterId: null,
        organisationId: "org_1",
        productItemId,
        patient: { id: "comp_1" },
      } as never);
      mockedPrisma.encounter.create.mockResolvedValue({
        ...baseEncounterRow,
        id: "enc_pkg",
      } as never);
      mockedPrisma.appointment.update.mockResolvedValue({
        id: "appt_pkg",
      } as never);
    };

    it("treats a 404 catalog selection as no package to expand", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockRejectedValue(
        new CatalogServiceError("Selection not found.", 404) as never,
      );

      const result = await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      expect(result.appointmentId).toBe("appt_pkg");
      expect(
        mockedPrisma.workspaceTreatmentItem.findMany,
      ).not.toHaveBeenCalled();
      expect(mockedPrisma.workspaceTreatmentItem.create).not.toHaveBeenCalled();
    });

    it("does not expand treatment items for a non-package selection", async () => {
      primeAppointmentPackageCreate("svc_1");
      mockedCatalogService.resolveSelection.mockResolvedValue(
        buildPackageSelection({
          productItemId: "svc_1",
          productKind: "SERVICE",
        }) as never,
      );

      const result = await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      expect(result.appointmentId).toBe("appt_pkg");
      expect(mockedCatalogService.resolveSelection).toHaveBeenCalledWith(
        "svc_1",
        "org_1",
      );
      expect(
        mockedPrisma.workspaceTreatmentItem.findMany,
      ).not.toHaveBeenCalled();
      expect(mockedPrisma.workspaceTreatmentItem.create).not.toHaveBeenCalled();
    });

    it("rethrows a non-404 catalog error while resolving a selection", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockRejectedValue(
        new CatalogServiceError("Catalog exploded.", 500) as never,
      );

      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, appointmentId: "appt_pkg" },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Catalog exploded.",
        statusCode: 500,
      });
    });

    it("rethrows a generic error while resolving a selection", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockRejectedValue(
        new Error("Boom.") as never,
      );

      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, appointmentId: "appt_pkg" },
          "org_1",
        ),
      ).rejects.toThrow("Boom.");
    });

    // -- package expansion edge cases ---------------------------------------

    it("skips template instances that already exist during package expansion", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockResolvedValue(
        buildPackageSelection({
          templateBindings: [
            {
              templateKind: "INPATIENT_SCHEDULE",
              templateId: "tmpl_schedule_1",
              templateVersion: 3,
            },
          ],
        }) as never,
      );
      mockedPrisma.templateInstance.findFirst.mockResolvedValue({
        id: "existing_template_instance",
      } as never);

      await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      expect(mockedPrisma.templateInstance.findFirst).toHaveBeenCalled();
      expect(mockedPrisma.templateInstance.create).not.toHaveBeenCalled();
    });

    it("clamps non-positive package medication quantities to one", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockResolvedValue(
        buildPackageSelection({
          includedItems: [
            {
              productItemId: "med_zero",
              code: "M0",
              name: "Med Zero",
              kind: "MEDICATION",
              quantity: 0,
              currency: "USD",
              unitPrice: 0,
              referenceUnitPrice: null,
              defaultDiscountPercent: null,
              maxDiscountPercent: null,
              discountPercent: 0,
              grossAmount: 0,
              discountAmount: 0,
              finalAmount: 0,
              isPackageComponent: true,
              packageProductItemId: "pkg_1",
            },
            {
              productItemId: "med_fraction",
              code: "M1",
              name: "Med Fraction",
              kind: "MEDICATION",
              quantity: 0.5,
              currency: "USD",
              unitPrice: 0,
              referenceUnitPrice: null,
              defaultDiscountPercent: null,
              maxDiscountPercent: null,
              discountPercent: 0,
              grossAmount: 0,
              discountAmount: 0,
              finalAmount: 0,
              isPackageComponent: true,
              packageProductItemId: "pkg_1",
            },
          ],
        }) as never,
      );

      await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      expect(mockedPrisma.prescription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                medication: "Med Zero",
                quantity: "1",
              }),
              expect.objectContaining({
                medication: "Med Fraction",
                quantity: "1",
              }),
            ],
          },
        }),
      });
    });

    // -- updateEncounter guards ---------------------------------------------

    it("rejects changing immutable encounter identifiers", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );

      await expect(
        CaseEncounterService.updateEncounter("enc_1", "org_1", {
          caseId: "case_other",
        }),
      ).rejects.toMatchObject({
        message:
          "caseId, organisationId and patientId cannot be changed for an encounter.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
      expect(mockedPrisma.encounter.update).not.toHaveBeenCalled();
    });

    it("rejects relinking an encounter to a missing appointment", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.appointment.findFirst.mockResolvedValue(null as never);
      mockedPrisma.appointment.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.updateEncounter("enc_1", "org_1", {
          appointmentId: "appt_missing",
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
      expect(mockedPrisma.encounter.update).not.toHaveBeenCalled();
    });

    // -- dischargeEncounter guards ------------------------------------------

    it("rejects discharge when no admission exists for the encounter", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        status: "onleave",
      } as never);
      mockedPrisma.admission.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.dischargeEncounter("enc_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Admission not found for encounter.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects discharge when the admission is already discharged", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        status: "onleave",
      } as never);
      mockedPrisma.admission.findUnique.mockResolvedValue({
        ...activeAdmission,
        dischargedAt: new Date("2026-06-11T09:00:00.000Z"),
      } as never);

      await expect(
        CaseEncounterService.dischargeEncounter("enc_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Admission is already discharged.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("falls back to the default gate message when discharge is blocked without a reason", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        status: "onleave",
      } as never);
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedWorkspaceService.getEncounterFinalizationGate.mockResolvedValueOnce(
        {
          enabled: false,
          disabledReason: null,
          requiredSoapOrDischargeComplete: true,
          requiredFormsSigned: false,
          pendingLabsResolved: true,
          billingReady: true,
          pendingDispenseRequestsResolved: true,
          inpatientRoomAdmissionReady: true,
          requiredTasksComplete: true,
        },
      );

      await expect(
        CaseEncounterService.dischargeEncounter("enc_1", "org_1"),
      ).rejects.toMatchObject({
        message: "Encounter finalization gate is blocking discharge.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("discharges with default timestamps and records a SYSTEM override audit", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        status: "onleave",
      } as never);
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedWorkspaceService.getEncounterFinalizationGate.mockResolvedValueOnce(
        {
          enabled: false,
          disabledReason: "Labs pending.",
          requiredSoapOrDischargeComplete: true,
          requiredFormsSigned: true,
          pendingLabsResolved: false,
          billingReady: true,
          pendingDispenseRequestsResolved: true,
          inpatientRoomAdmissionReady: true,
          requiredTasksComplete: true,
        },
      );
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(
        null as never,
      );
      mockedPrisma.admission.update.mockResolvedValue({
        encounterId: "enc_1",
      } as never);
      mockedPrisma.encounter.update.mockResolvedValue({
        ...baseEncounterRow,
        status: "finished",
      } as never);

      const result = await CaseEncounterService.dischargeEncounter(
        "enc_1",
        "org_1",
        { overrideReason: "  Approved by lead.  " },
      );

      expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ENCOUNTER_DISCHARGE_OVERRIDDEN",
          actorType: "SYSTEM",
          actorId: null,
          metadata: expect.objectContaining({
            overrideReason: "Approved by lead.",
          }),
        }),
      );
      expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ENCOUNTER_DISCHARGED",
          actorType: "SYSTEM",
          metadata: expect.objectContaining({
            dischargedAt: undefined,
            periodEnd: undefined,
          }),
        }),
      );
      expect(result.status).toBe("finished");
    });

    // -- assignUnit guards ---------------------------------------------------

    it("rejects assignment with an invalid assignedAt", async () => {
      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", {
          unitId: "unit_1",
          assignedAt: new Date("not-a-date"),
        }),
      ).rejects.toMatchObject({
        message: "Invalid assignedAt.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when no admission exists", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Admission not found for encounter.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment to a discharged admission", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue({
        ...activeAdmission,
        dischargedAt: new Date("2026-06-11T09:00:00.000Z"),
      } as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Cannot assign unit to a discharged admission.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when the encounter organisation is inconsistent", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        organisationId: "org_2",
      } as never);
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Encounter organisation mismatch.",
        statusCode: 403,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when the unit does not exist", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Room unit not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when the unit is inactive", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        ...activeUnit,
        isActive: false,
      } as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Selected unit is inactive.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when the companion cannot be found", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit as never);
      mockedPrisma.patient.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Companion not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when the unit group is missing", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        ...activeUnit,
        unitGroupId: "group_1",
      } as never);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "dog",
        speciesCode: "canislf",
      } as never);
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue(null as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Room unit group not found.",
        statusCode: 404,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("rejects assignment when the unit group organisation differs", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        ...activeUnit,
        unitGroupId: "group_1",
      } as never);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "dog",
        speciesCode: "canislf",
      } as never);
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
        id: "group_1",
        organisationId: "org_2",
        roomId: "room_1",
        name: "Ward",
        size: "M",
        unitCount: 2,
        speciesConstraints: ["dog"],
        capabilities: [],
        isActive: true,
      } as never);

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Room unit group organisation mismatch.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("throws 500 when the transaction client is missing the roomUnit delegate", async () => {
      const partialTx = {
        encounter: {
          findFirst: jest.fn(async () => baseEncounterRow),
        },
        admission: {
          findUnique: jest.fn(async () => activeAdmission),
        },
      };
      mockedPrisma.$transaction.mockImplementationOnce(async (callback: any) =>
        callback(partialTx),
      );

      await expect(
        CaseEncounterService.assignUnit("enc_1", "org_1", { unitId: "unit_1" }),
      ).rejects.toMatchObject({
        message: "Transaction client is missing roomUnit delegate.",
        statusCode: 500,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    it("assigns a unit with empty species constraints on the unit and its group", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        ...activeUnit,
        unitGroupId: "group_1",
        speciesConstraints: null,
      } as never);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "dog",
        speciesCode: "canislf",
      } as never);
      mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Ward",
        size: "M",
        unitCount: 2,
        speciesConstraints: null,
        capabilities: [],
        isActive: true,
      } as never);
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(
        null as never,
      );
      mockedPrisma.roomUnitAssignment.create.mockResolvedValue({
        id: "assign_new",
      } as never);
      mockedPrisma.admission.update.mockResolvedValue({
        encounterId: "enc_1",
      } as never);

      const result = await CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
      });

      expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalled();
      expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
        where: { encounterId: "enc_1" },
        data: { unitId: "unit_1" },
      });
      expect(result.id).toBe("enc_1");
    });

    it("releases the previous unit assignment when transferring to a new unit", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit as never);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "dog",
        speciesCode: "canislf",
      } as never);
      mockedPrisma.roomUnitAssignment.findFirst
        .mockReset()
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({
          id: "assign_old",
          encounterId: "enc_1",
          admissionId: "enc_1",
          unitId: "unit_old",
          assignedAt: new Date("2026-06-11T09:00:00.000Z"),
          releasedAt: null,
          assignedBy: "user_1",
          reason: "Initial",
          createdAt: new Date("2026-06-11T09:00:00.000Z"),
          updatedAt: new Date("2026-06-11T09:00:00.000Z"),
        } as never);
      mockedPrisma.roomUnitAssignment.update.mockResolvedValue({
        id: "assign_old",
      } as never);
      mockedPrisma.roomUnitAssignment.create.mockResolvedValue({
        id: "assign_new",
      } as never);
      mockedPrisma.admission.update.mockResolvedValue({
        encounterId: "enc_1",
      } as never);

      await CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      });

      expect(mockedPrisma.roomUnitAssignment.update).toHaveBeenCalledWith({
        where: { id: "assign_old" },
        data: { releasedAt: new Date("2026-06-11T11:00:00.000Z") },
      });
      expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalled();
    });

    it("re-uses the existing assignment when the unit is unchanged", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue(activeUnit as never);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "dog",
        speciesCode: "canislf",
      } as never);
      const sameUnitAssignment = {
        id: "assign_same",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T09:00:00.000Z"),
        releasedAt: null,
        assignedBy: "user_1",
        reason: "Initial",
        createdAt: new Date("2026-06-11T09:00:00.000Z"),
        updatedAt: new Date("2026-06-11T09:00:00.000Z"),
      };
      mockedPrisma.roomUnitAssignment.findFirst
        .mockReset()
        .mockResolvedValueOnce(sameUnitAssignment as never)
        .mockResolvedValueOnce(sameUnitAssignment as never);
      mockedPrisma.admission.update.mockResolvedValue({
        encounterId: "enc_1",
      } as never);

      await CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
      });

      expect(mockedPrisma.roomUnitAssignment.update).not.toHaveBeenCalled();
      expect(mockedPrisma.roomUnitAssignment.create).not.toHaveBeenCalled();
      expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
        where: { encounterId: "enc_1" },
        data: { unitId: "unit_1" },
      });
    });

    // -- startEncounter invalid input ---------------------------------------

    it("rejects starting an encounter with an invalid startedAt", async () => {
      await expect(
        CaseEncounterService.startEncounter("enc_1", "org_1", {
          startedAt: new Date("not-a-date"),
        }),
      ).rejects.toMatchObject({
        message: "Invalid startedAt.",
        statusCode: 400,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    // -- listActiveInpatientEncounters empty --------------------------------

    it("returns an empty list when no active admissions exist", async () => {
      mockedPrisma.admission.findMany.mockResolvedValue([] as never);

      const result = await CaseEncounterService.listActiveInpatientEncounters({
        organisationId: "org_1",
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.encounter.findMany).not.toHaveBeenCalled();
    });

    // -- domain mapping of nullable fields ----------------------------------

    it("maps nullable encounter columns to undefined", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        parentId: null,
        title: null,
        reason: null,
        periodStart: null,
        periodEnd: null,
      } as never);
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      const result = await CaseEncounterService.getEncounterById(
        "enc_1",
        "org_1",
      );

      expect(result.parentId).toBeUndefined();
      expect(result.title).toBeUndefined();
      expect(result.reason).toBeUndefined();
      expect(result.periodStart).toBeUndefined();
      expect(result.periodEnd).toBeUndefined();
    });

    // -- updateEncounter without changing the appointment link ---------------

    it("updates encounter class and metadata without touching the appointment", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.appointment.findFirst.mockResolvedValue(null as never);
      mockedPrisma.encounter.update.mockResolvedValue({
        ...baseEncounterRow,
        status: "arrived",
        encounterClass: "AMB",
      } as never);
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      const result = await CaseEncounterService.updateEncounter(
        "enc_1",
        "org_1",
        {
          status: "arrived",
          encounterClass: "AMB",
          parentId: "parent_2",
          title: "Revised title",
          reason: "Revised reason",
        },
      );

      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
        where: { id: "enc_1" },
        data: expect.objectContaining({
          status: "arrived",
          encounterClass: "AMB",
          parentId: "parent_2",
          title: "Revised title",
          reason: "Revised reason",
        }),
      });
      expect(mockedPrisma.appointment.update).not.toHaveBeenCalled();
      expect(result.encounterClass).toBe("AMB");
    });

    it("clears encounter metadata to null when blank values are supplied", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.appointment.findFirst.mockResolvedValue(null as never);
      mockedPrisma.encounter.update.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      await CaseEncounterService.updateEncounter("enc_1", "org_1", {
        parentId: "   ",
        title: "",
        reason: "  ",
      });

      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
        where: { id: "enc_1" },
        data: expect.objectContaining({
          parentId: null,
          title: null,
          reason: null,
        }),
      });
    });

    it("detaches the current appointment when the update clears the link", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.appointment.findFirst.mockResolvedValue({
        id: "appt_old",
        caseId: "case_1",
        encounterId: "enc_1",
        organisationId: "org_1",
        patient: { id: "comp_1" },
      } as never);
      mockedPrisma.encounter.update.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      await CaseEncounterService.updateEncounter("enc_1", "org_1", {
        appointmentId: "   ",
      });

      expect(mockedPrisma.appointment.update).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "appt_old" },
        data: { encounterId: null },
      });
    });

    // -- discharge metadata with explicit period end ------------------------

    it("records ISO discharge metadata and tolerates a missing periodStart", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        status: "onleave",
        periodStart: null,
      } as never);
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(
        null as never,
      );
      mockedPrisma.admission.update.mockResolvedValue({
        encounterId: "enc_1",
      } as never);
      mockedPrisma.encounter.update.mockResolvedValue({
        ...baseEncounterRow,
        status: "finished",
      } as never);
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      await CaseEncounterService.dischargeEncounter("enc_1", "org_1", {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        periodEnd: new Date("2026-06-11T13:00:00.000Z"),
      });

      expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ENCOUNTER_DISCHARGED",
          metadata: expect.objectContaining({
            dischargedAt: "2026-06-11T12:00:00.000Z",
            periodEnd: "2026-06-11T13:00:00.000Z",
          }),
        }),
      );
    });

    // -- listUnitAssignments active-only + null assignedBy ------------------

    it("filters to open assignments and maps a null assignedBy", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        id: "enc_1",
      } as never);
      mockedPrisma.roomUnitAssignment.findMany.mockResolvedValue([
        {
          id: "assign_open",
          encounterId: "enc_1",
          admissionId: "enc_1",
          unitId: "unit_1",
          assignedAt: new Date("2026-06-11T11:00:00.000Z"),
          releasedAt: null,
          assignedBy: null,
          reason: null,
          createdAt: new Date("2026-06-11T11:00:00.000Z"),
          updatedAt: new Date("2026-06-11T11:00:00.000Z"),
        },
      ] as never);

      const result = await CaseEncounterService.listUnitAssignments({
        organisationId: "org_1",
        encounterId: "enc_1",
        activeOnly: true,
      });

      expect(mockedPrisma.roomUnitAssignment.findMany).toHaveBeenCalledWith({
        where: {
          encounterId: "enc_1",
          admissionId: undefined,
          unitId: undefined,
          releasedAt: null,
          admission: { organisationId: "org_1" },
        },
        orderBy: { assignedAt: "asc" },
      });
      expect(result[0]?.assignedBy).toBeUndefined();
    });

    // -- startEncounter falls back to startedAt for periodStart --------------

    it("uses startedAt as the periodStart when the encounter has none", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue({
        ...baseEncounterRow,
        status: "arrived",
        periodStart: null,
      } as never);
      mockedPrisma.encounter.update.mockResolvedValue({
        ...baseEncounterRow,
        status: "in-progress",
      } as never);
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      await CaseEncounterService.startEncounter("enc_1", "org_1", {
        startedAt: new Date("2026-06-11T12:00:00.000Z"),
      });

      expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
        where: { id: "enc_1" },
        data: {
          status: "in-progress",
          periodStart: new Date("2026-06-11T12:00:00.000Z"),
        },
      });
    });

    // -- species token normalisation edge cases -----------------------------

    it("assigns a unit despite non-string and alias-less species tokens", async () => {
      mockedPrisma.encounter.findFirst.mockResolvedValue(
        baseEncounterRow as never,
      );
      mockedPrisma.admission.findUnique.mockResolvedValue(
        activeAdmission as never,
      );
      mockedPrisma.roomUnit.findUnique.mockResolvedValue({
        ...activeUnit,
        speciesConstraints: ["rabbit", 42],
      } as never);
      mockedPrisma.patient.findUnique.mockResolvedValue({
        id: "comp_1",
        type: "rabbit",
        speciesCode: null,
      } as never);
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(
        null as never,
      );
      mockedPrisma.roomUnitAssignment.create.mockResolvedValue({
        id: "assign_new",
      } as never);
      mockedPrisma.admission.update.mockResolvedValue({
        encounterId: "enc_1",
      } as never);
      mockedPrisma.appointment.findMany.mockResolvedValue([] as never);

      const result = await CaseEncounterService.assignUnit("enc_1", "org_1", {
        unitId: "unit_1",
      });

      expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalled();
      expect(result.id).toBe("enc_1");
    });

    // -- appointment with no companion id -----------------------------------

    it("rejects encounter creation when the appointment carries no companion", async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: "appt_1",
        caseId: null,
        encounterId: null,
        organisationId: "org_1",
        patient: null,
      } as never);

      await expect(
        CaseEncounterService.createEncounter(
          { ...baseEncounterInput, appointmentId: "appt_1" },
          "org_1",
        ),
      ).rejects.toMatchObject({
        message: "Encounter appointment companion mismatch.",
        statusCode: 409,
      } satisfies Partial<CaseEncounterServiceError>);
    });

    // -- package expansion with unrelated existing snapshots -----------------

    it("expands a package when existing treatment snapshots do not match", async () => {
      primeAppointmentPackageCreate();
      mockedPrisma.workspaceTreatmentItem.findMany.mockResolvedValue([
        { productSnapshot: null },
        { productSnapshot: {} },
      ] as never);
      mockedCatalogService.resolveSelection.mockResolvedValue(
        buildPackageSelection({
          billingItems: [
            {
              productItemId: "lab_1",
              code: "LAB-1",
              name: "Lab",
              kind: "LAB_TEST",
              quantity: 1,
              currency: "USD",
              unitPrice: 30,
              referenceUnitPrice: 30,
              defaultDiscountPercent: null,
              maxDiscountPercent: null,
              discountPercent: 0,
              grossAmount: 30,
              discountAmount: 0,
              finalAmount: 30,
              isPackageComponent: true,
              packageProductItemId: "pkg_1",
            },
          ],
        }) as never,
      );

      await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      expect(mockedPrisma.workspaceTreatmentItem.findMany).toHaveBeenCalled();
      expect(mockedPrisma.workspaceTreatmentItem.create).toHaveBeenCalledTimes(
        1,
      );
      expect(mockedPrisma.prescription.create).not.toHaveBeenCalled();
    });

    it("defaults a package template binding without a version to version one", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockResolvedValue(
        buildPackageSelection({
          templateBindings: [
            {
              templateKind: "INPATIENT_SCHEDULE",
              templateId: "tmpl_no_version",
            },
          ],
        }) as never,
      );
      mockedPrisma.templateInstance.findFirst.mockResolvedValue(null as never);

      await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      expect(mockedPrisma.templateInstance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: "tmpl_no_version",
          templateVersion: 1,
        }),
      });
    });

    it("maps package medication rows for component and standalone medications", async () => {
      primeAppointmentPackageCreate();
      mockedCatalogService.resolveSelection.mockResolvedValue(
        buildPackageSelection({
          includedItems: [
            {
              productItemId: "med_comp",
              code: null,
              name: "Component Med",
              kind: "MEDICATION",
              quantity: 1,
              currency: "USD",
              unitPrice: 0,
              referenceUnitPrice: null,
              defaultDiscountPercent: null,
              maxDiscountPercent: null,
              discountPercent: 0,
              grossAmount: 0,
              discountAmount: 0,
              finalAmount: 0,
              isPackageComponent: true,
              packageProductItemId: null,
            },
            {
              productItemId: "med_standalone",
              code: "MED-2",
              name: "Standalone Med",
              kind: "MEDICATION",
              quantity: 1,
              currency: "USD",
              unitPrice: 12,
              referenceUnitPrice: null,
              defaultDiscountPercent: null,
              maxDiscountPercent: null,
              discountPercent: 0,
              grossAmount: 12,
              discountAmount: 0,
              finalAmount: 12,
              isPackageComponent: false,
              packageProductItemId: null,
            },
          ],
        }) as never,
      );

      await CaseEncounterService.createEncounter(
        { ...baseEncounterInput, appointmentId: "appt_pkg" },
        "org_1",
      );

      const rxCall = (
        mockedPrisma.prescription.create.mock.calls as unknown as Array<
          [{ data: { items: { create: Array<Record<string, unknown>> } } }]
        >
      )[0][0];
      const rows = rxCall.data.items.create;

      expect(rows[0]).toMatchObject({
        medication: "Component Med",
        route: "PACKAGE",
        instructions: "Package component from med_comp",
      });
      expect(rows[0].strength).toBeUndefined();
      expect(rows[0].frequency).toBeUndefined();
      expect(rows[1].route).toBeUndefined();
      expect(rows[1].instructions).toBeUndefined();
    });
  });
});
