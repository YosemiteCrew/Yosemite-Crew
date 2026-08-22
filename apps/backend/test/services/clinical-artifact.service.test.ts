import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
  hydrateMedications,
} from "../../src/services/clinical-artifact.service";
import { renderRenderedDocumentPdfWithMetadata } from "../../src/services/rendered-document-renderer.service";
import { uploadBufferAsFile } from "../../src/middlewares/upload";
import { InventoryConsumptionService } from "../../src/services/inventory-consumption.service";

jest.mock("../../src/services/inventory-consumption.service", () => ({
  InventoryConsumptionService: {
    approvePrescriptionDispenseRequest: jest.fn(),
    createPrescriptionDispenseRequest: jest.fn(),
    markPrescriptionDispenseRequestNotDispensed: jest.fn(),
    releasePrescription: jest.fn(),
    voidDispensePrescription: jest.fn(),
  },
}));

jest.mock("../../src/services/rendered-document-renderer.service", () => ({
  renderRenderedDocumentPdfWithMetadata: jest.fn(),
}));

jest.mock("../../src/middlewares/upload", () => ({
  uploadBufferAsFile: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    appointment: {
      updateMany: jest.fn(),
    },
    workspaceTreatmentItem: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    clinicalArtifact: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    renderedDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    soapNote: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    prescription: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    prescriptionDispenseRequest: {
      findFirst: jest.fn(),
    },
    dischargeSummary: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    userOrganization: {
      findFirst: jest.fn(),
    },
    vitalRecord: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    immunization: {
      findMany: jest.fn(),
    },
    rabiesTitration: {
      findMany: jest.fn(),
    },
    parasiteTreatment: {
      findMany: jest.fn(),
    },
    clinicalExamination: {
      findMany: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
    },
  },
}));

describe("ClinicalArtifactService", () => {
  const organisationId = "org-1";
  const artifactId = "artifact-1";
  const soapNoteId = "soap-1";

  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    appointment: {
      updateMany: jest.Mock;
    };
    workspaceTreatmentItem: {
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
    clinicalArtifact: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    renderedDocument: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    soapNote: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    prescription: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    prescriptionDispenseRequest: {
      findFirst: jest.Mock;
    };
    dischargeSummary: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
    };
    userOrganization: {
      findFirst: jest.Mock;
    };
    vitalRecord: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    immunization: {
      findMany: jest.Mock;
    };
    rabiesTitration: {
      findMany: jest.Mock;
    };
    parasiteTreatment: {
      findMany: jest.Mock;
    };
    clinicalExamination: {
      findMany: jest.Mock;
    };
    inventoryItem: {
      findMany: jest.Mock;
    };
  };
  const mockedRenderedDocumentRenderer =
    renderRenderedDocumentPdfWithMetadata as jest.Mock;
  const mockedUploadBufferAsFile = uploadBufferAsFile as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // A vital record's `recordedBy` only resolves to a name when that person is
    // an active member of the artifact's organisation; default to "they are" so
    // only the tests exercising the boundary need to say otherwise.
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({
      id: "membership-1",
    });
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return undefined;
    });
    mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.workspaceTreatmentItem.findFirst.mockReset();
    mockedPrisma.workspaceTreatmentItem.deleteMany.mockReset();
    mockedPrisma.prescription.findFirst.mockReset();
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockReset();
    mockedRenderedDocumentRenderer.mockResolvedValue({
      pdf: Buffer.from("rendered-pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedUploadBufferAsFile.mockResolvedValue({
      url: "https://cdn.example/rendered.pdf",
      key: "rendered-documents/org-1/file.pdf",
      originalname: "rendered.pdf",
      mimetype: "application/pdf",
    });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
  });

  const mockClinicalRenderedDocumentPersistence = (params: {
    id: string;
    kind: "SOAP_NOTE" | "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "VITAL_RECORD";
    title: string;
    sourceId?: string;
    templateId?: string | null;
    templateVersion?: number | null;
    templateVersionId?: string | null;
  }) => {
    const sourceId = params.sourceId ?? artifactId;
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: params.id,
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId,
      templateInstanceId: null,
      clinicalArtifactId: sourceId,
      templateId: params.templateId ?? null,
      templateVersion: params.templateVersion ?? null,
      templateVersionId: params.templateVersionId ?? null,
      kind: params.kind,
      version: 1,
      title: params.title,
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: params.title,
        mimeType: "application/pdf",
        documentKind: params.kind,
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId,
          organisationId,
          templateKind: params.kind,
          templateId: params.templateId ?? null,
          templateVersion: params.templateVersion ?? null,
          templateVersionId: params.templateVersionId ?? null,
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: params.id,
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId,
      templateInstanceId: null,
      clinicalArtifactId: sourceId,
      templateId: params.templateId ?? null,
      templateVersion: params.templateVersion ?? null,
      templateVersionId: params.templateVersionId ?? null,
      kind: params.kind,
      version: 1,
      title: params.title,
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/rendered.pdf",
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: params.title,
        mimeType: "application/pdf",
        documentKind: params.kind,
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId,
          organisationId,
          templateKind: params.kind,
          templateId: params.templateId ?? null,
          templateVersion: params.templateVersion ?? null,
          templateVersionId: params.templateVersionId ?? null,
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
  };

  const D1 = new Date("2026-01-01T00:00:00.000Z");
  const D2 = new Date("2026-01-02T00:00:00.000Z");

  /**
   * `jest.clearAllMocks()` only clears recorded calls — a `...Once` value queued
   * by an earlier suite survives it. The lifecycle suites below drive the same
   * prisma delegates, so they start from a hard reset plus the handful of
   * defaults the service assumes.
   */
  const resetClinicalPrismaMocks = () => {
    [
      mockedPrisma.appointment.updateMany,
      mockedPrisma.workspaceTreatmentItem.findFirst,
      mockedPrisma.workspaceTreatmentItem.deleteMany,
      mockedPrisma.clinicalArtifact.create,
      mockedPrisma.clinicalArtifact.update,
      mockedPrisma.clinicalArtifact.findUnique,
      mockedPrisma.renderedDocument.create,
      mockedPrisma.renderedDocument.findUnique,
      mockedPrisma.renderedDocument.update,
      mockedPrisma.soapNote.create,
      mockedPrisma.soapNote.update,
      mockedPrisma.soapNote.findUnique,
      mockedPrisma.soapNote.findMany,
      mockedPrisma.prescription.create,
      mockedPrisma.prescription.update,
      mockedPrisma.prescription.findFirst,
      mockedPrisma.prescription.findUnique,
      mockedPrisma.prescription.findMany,
      mockedPrisma.prescriptionDispenseRequest.findFirst,
      mockedPrisma.dischargeSummary.create,
      mockedPrisma.dischargeSummary.update,
      mockedPrisma.dischargeSummary.findUnique,
      mockedPrisma.dischargeSummary.findMany,
      mockedPrisma.user.findFirst,
      mockedPrisma.vitalRecord.create,
      mockedPrisma.vitalRecord.update,
      mockedPrisma.vitalRecord.findUnique,
      mockedPrisma.vitalRecord.findMany,
      mockedPrisma.inventoryItem.findMany,
    ].forEach((mock) => mock.mockReset());

    mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([]);
    mockedPrisma.renderedDocument.create.mockResolvedValue({ id: "doc-new" });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValue(null);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValue(null);
  };

  const artifactRow = (overrides: Record<string, unknown> = {}) => ({
    id: artifactId,
    organisationId,
    appointmentId: null,
    caseId: null,
    encounterId: null,
    kind: "SOAP_NOTE",
    status: "DRAFT",
    templateId: null,
    templateVersion: null,
    templateVersionId: null,
    authorId: null,
    signedBy: null,
    signedAt: null,
    summary: null,
    createdAt: D1,
    updatedAt: D1,
    ...overrides,
  });

  const soapRow = (overrides: Record<string, unknown> = {}) => ({
    id: soapNoteId,
    artifactId,
    subjective: { chiefComplaint: "S" },
    objective: { findings: "O" },
    assessment: { diagnosis: "A" },
    plan: { instructions: "P" },
    diagnoses: [{ code: "A1" }],
    metadata: { source: "manual" },
    createdAt: D1,
    updatedAt: D1,
    artifact: artifactRow(),
    ...overrides,
  });

  const dischargeRow = (overrides: Record<string, unknown> = {}) => ({
    id: "discharge-1",
    artifactId,
    summary: { text: "Recovered" },
    diagnoses: [{ code: "A1" }],
    medications: [{ medication: "Amox" }],
    followUp: { afterDays: 7 },
    instructions: { text: "Rest" },
    metadata: { source: "template" },
    createdAt: D1,
    updatedAt: D1,
    artifact: artifactRow({ kind: "DISCHARGE_SUMMARY" }),
    ...overrides,
  });

  const vitalRow = (overrides: Record<string, unknown> = {}) => ({
    id: "vital-1",
    artifactId,
    measuredAt: D1,
    recordedBy: null,
    vitals: { temperature: 38.2 },
    notes: null,
    metadata: null,
    createdAt: D1,
    updatedAt: D1,
    artifact: artifactRow({ kind: "VITAL_RECORD" }),
    ...overrides,
  });

  const prescriptionItemRow = (overrides: Record<string, unknown> = {}) => ({
    id: "item-row-1",
    prescriptionId: "prescription-1",
    sourceLineKey: "line-1",
    medication: "Amoxicillin",
    strength: null,
    dosage: null,
    route: null,
    frequency: null,
    duration: null,
    quantity: null,
    instructions: null,
    refill: null,
    inventoryItemId: null,
    inventoryItemSku: null,
    batchId: null,
    batchNumber: null,
    lotNumber: null,
    expiryDate: null,
    metadata: null,
    sortOrder: 0,
    ...overrides,
  });

  const prescriptionRow = (overrides: Record<string, unknown> = {}) => ({
    id: "prescription-1",
    artifactId,
    items: [],
    medications: null,
    instructions: null,
    notes: null,
    metadata: null,
    createdAt: D1,
    updatedAt: D1,
    artifact: artifactRow({ kind: "PRESCRIPTION" }),
    ...overrides,
  });

  it("creates a dispense request when a prescription is signed", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "SIGNED",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: "author-1",
      signedAt: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.prescription.create.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [
        { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
      ],
      instructions: { text: "Take daily" },
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: "Prescription",
        mimeType: "application/pdf",
        documentKind: "PRESCRIPTION",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          organisationId,
          templateKind: "PRESCRIPTION",
          templateId: "tmpl-2",
          templateVersion: 4,
          templateVersionId: "tmpl-ver-2",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-1",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/rendered.pdf",
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: "Prescription",
        mimeType: "application/pdf",
        documentKind: "PRESCRIPTION",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          organisationId,
          templateKind: "PRESCRIPTION",
          templateId: "tmpl-2",
          templateVersion: 4,
          templateVersionId: "tmpl-ver-2",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });

    await ClinicalArtifactService.createPrescription({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      status: "SIGNED",
      medications: [
        { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
      ],
      instructions: { text: "Take daily" },
      notes: null,
      metadata: null,
    });

    const { InventoryConsumptionService } =
      await import("../../src/services/inventory-consumption.service");
    expect(
      InventoryConsumptionService.createPrescriptionDispenseRequest,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId,
        prescriptionId: "prescription-1",
        context: {
          appointmentId: "appt-1",
          encounterId: "enc-1",
        },
      }),
    );
  });

  it("creates a SOAP note artifact with structured payload", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "SOAP_NOTE",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Follow-up",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.soapNote.create.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Vomiting" },
      objective: { temperature: 39.2 },
      assessment: { diagnosis: "Gastritis" },
      plan: { instructions: "Supportive care" },
      diagnoses: [{ code: "A1", text: "Gastritis" }],
      metadata: { confidence: "high" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: "SOAP note",
        mimeType: "application/pdf",
        documentKind: "SOAP_NOTE",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          organisationId,
          templateKind: "SOAP_NOTE",
          templateId: "tmpl-1",
          templateVersion: 3,
          templateVersionId: "tmpl-ver-1",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-1",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/rendered.pdf",
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: "SOAP note",
        mimeType: "application/pdf",
        documentKind: "SOAP_NOTE",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          organisationId,
          templateKind: "SOAP_NOTE",
          templateId: "tmpl-1",
          templateVersion: 3,
          templateVersionId: "tmpl-ver-1",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-1",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });

    const result = await ClinicalArtifactService.createSoapNote({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-1",
      templateVersion: 3,
      templateVersionId: "tmpl-ver-1",
      authorId: "author-1",
      summary: "Follow-up",
      subjective: { chiefComplaint: "Vomiting" },
      objective: { temperature: 39.2 },
      assessment: { diagnosis: "Gastritis" },
      plan: { instructions: "Supportive care" },
      diagnoses: [{ code: "A1", text: "Gastritis" }],
      metadata: { confidence: "high" },
    });

    expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId,
          kind: "SOAP_NOTE",
          appointmentId: "appt-1",
          encounterId: "enc-1",
          templateId: "tmpl-1",
          templateVersion: 3,
        }),
      }),
    );
    expect(mockedPrisma.soapNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifactId,
        }),
      }),
    );
    expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "appt-1",
          organisationId,
          // Bound to the artifact's own encounter: these routes run on
          // clinical-artifact permissions, so without it a throwaway artifact
          // could advance any colleague's checked-in appointment.
          encounterId: "enc-1",
          status: "CHECKED_IN",
        },
        data: {
          status: "IN_PROGRESS",
        },
      }),
    );
    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicalArtifactId: artifactId,
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          kind: "SOAP_NOTE",
          title: "SOAP note",
        }),
      }),
    );
    expect(result.artifact.id).toBe(artifactId);
    expect(result.soapNote.id).toBe(soapNoteId);
  });

  it("returns a SOAP note by id", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const result = await ClinicalArtifactService.getSoapNote(soapNoteId);

    expect(result.artifact.id).toBe(artifactId);
    expect(result.soapNote.id).toBe(soapNoteId);
  });

  it("creates a prescription artifact and document draft", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.prescription.create.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [{ drug: "Drug A" }],
      instructions: { text: "Take daily" },
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-2",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: "Prescription",
        mimeType: "application/pdf",
        documentKind: "PRESCRIPTION",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          organisationId,
          templateKind: "PRESCRIPTION",
          templateId: "tmpl-2",
          templateVersion: 4,
          templateVersionId: "tmpl-ver-2",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-2",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/rendered.pdf",
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-01-01T00:00:00.000Z",
        title: "Prescription",
        mimeType: "application/pdf",
        documentKind: "PRESCRIPTION",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: artifactId,
          organisationId,
          templateKind: "PRESCRIPTION",
          templateId: "tmpl-2",
          templateVersion: 4,
          templateVersionId: "tmpl-ver-2",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-2",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });

    const result = await ClinicalArtifactService.createPrescription({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      summary: "Rx summary",
      medications: [
        {
          sourceLineKey: "line-1",
          medication: "Drug A",
          dosage: "250mg",
          route: "oral",
          frequency: "BID",
          quantity: 1,
          inventoryItemId: "item-1",
        },
      ],
      instructions: { text: "Take daily" },
      notes: null,
      metadata: null,
    });

    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "PRESCRIPTION",
          title: "Prescription",
          clinicalArtifactId: artifactId,
        }),
      }),
    );
    expect(mockedPrisma.prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                medication: "Drug A",
                dosage: "250mg",
                route: "oral",
                frequency: "BID",
                quantity: "1",
                sourceLineKey: "line-1",
                inventoryItemId: "item-1",
              }),
            ],
          },
        }),
      }),
    );
    expect(
      (
        mockedPrisma.prescription.create.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data,
    ).not.toHaveProperty("medications");
    expect(result.artifact.kind).toBe("PRESCRIPTION");
  });

  it("stores frontend prescription fields on line items instead of the json column", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.prescription.create.mockResolvedValueOnce({
      id: "prescription-frontend-1",
      artifactId,
      medications: null,
      items: [
        {
          id: "line-frontend-1",
          prescriptionId: "prescription-frontend-1",
          sourceLineKey: "line-frontend",
          medication: "Drug B",
          strength: "250mg",
          dosage: "1 tablet",
          route: "oral",
          frequency: "BID",
          duration: "5 days",
          quantity: "14",
          instructions: "With food",
          refill: "2",
          inventoryItemId: "item-2",
          inventoryItemSku: "sku-2",
          batchId: "batch-2",
          batchNumber: "BN-2",
          lotNumber: "LOT-2",
          expiryDate: new Date("2026-12-31T00:00:00.000Z"),
          metadata: { note: "frontend-shape" },
          sortOrder: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-3",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-3",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/rendered.pdf",
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });

    await ClinicalArtifactService.createPrescription({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      summary: "Rx summary",
      medications: [
        {
          sourceLineKey: "line-frontend",
          medicineName: "Drug B",
          dosage: "1 tablet",
          route: "oral",
          frequency: "BID",
          durationDays: "5 days",
          refill: "2",
          inventoryItemId: "item-2",
          inventoryBatchId: "batch-2",
          quantity: 14,
          instructions: "With food",
          metadata: { note: "frontend-shape" },
        },
      ],
      instructions: null,
      notes: null,
      metadata: null,
    });

    expect(mockedPrisma.prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                sourceLineKey: "line-frontend",
                medication: "Drug B",
                dosage: "1 tablet",
                route: "oral",
                frequency: "BID",
                duration: "5 days",
                quantity: "14",
                instructions: "With food",
                refill: "2",
                inventoryItemId: "item-2",
                batchId: "batch-2",
              }),
            ],
          },
        }),
      }),
    );
    expect(
      (
        mockedPrisma.prescription.create.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data,
    ).not.toHaveProperty("medications");
  });

  it("normalizes primitive prescription entries into medication-only line items", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.prescription.create.mockResolvedValueOnce({
      id: "prescription-primitive-1",
      artifactId,
      medications: null,
      items: [
        {
          id: "line-primitive-1",
          prescriptionId: "prescription-primitive-1",
          sourceLineKey: null,
          medication: "Amoxicillin 250mg",
          strength: null,
          dosage: null,
          route: null,
          frequency: null,
          duration: null,
          quantity: null,
          instructions: null,
          refill: null,
          inventoryItemId: null,
          inventoryItemSku: null,
          batchId: null,
          batchNumber: null,
          lotNumber: null,
          expiryDate: null,
          metadata: null,
          sortOrder: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-5",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      kind: "PRESCRIPTION",
      version: 1,
      title: "Prescription",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-5",
      kind: "PRESCRIPTION",
      title: "Prescription",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
    });

    await ClinicalArtifactService.createPrescription({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      summary: "Rx summary",
      medications: [
        "Amoxicillin 250mg",
        {
          sourceLineKey: "line-record",
          medication: "Drug C",
          dosage: "1 tablet",
        },
      ] as never,
      instructions: null,
      notes: null,
      metadata: null,
    });

    expect(mockedPrisma.prescription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                medication: "Amoxicillin 250mg",
                sortOrder: 0,
              }),
              expect.objectContaining({
                medication: "Drug C",
                sourceLineKey: "line-record",
                dosage: "1 tablet",
                sortOrder: 1,
              }),
            ],
          },
        }),
      }),
    );
  });

  it("marks the dispense request not dispensed when a signed prescription is voided", async () => {
    const signedMedications = [
      { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
    ];
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: signedMedications,
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "original" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "tmpl-2",
        templateVersion: 4,
        templateVersionId: "tmpl-ver-2",
        authorId: "author-1",
        signedBy: "author-1",
        signedAt: new Date("2026-01-01T00:00:00.000Z"),
        summary: "Rx summary",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "VOID",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: "author-1",
      signedAt: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.prescription.update.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: signedMedications,
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "original" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await ClinicalArtifactService.updatePrescription(
      "prescription-1",
      { status: "VOID" },
      organisationId,
      { actorId: "actor-1", canEditAny: true },
    );

    const { InventoryConsumptionService } =
      await import("../../src/services/inventory-consumption.service");
    expect(
      InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId,
        prescriptionId: "prescription-1",
      }),
    );
    expect(
      InventoryConsumptionService.releasePrescription,
    ).not.toHaveBeenCalled();
  });

  it("marks the dispense request not dispensed when a signed prescription is reopened", async () => {
    mockedPrisma.clinicalArtifact.update.mockReset();
    mockedPrisma.prescription.update.mockReset();
    const originalMedications = [
      { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
    ];
    const revisedMedications = [
      { inventoryItemId: "item-1", quantity: 3, sourceLineKey: "line-1" },
    ];
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-2",
      artifactId,
      medications: originalMedications,
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "original" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "tmpl-2",
        templateVersion: 4,
        templateVersionId: "tmpl-ver-2",
        authorId: "author-1",
        signedBy: "author-1",
        signedAt: new Date("2026-01-01T00:00:00.000Z"),
        summary: "Rx summary",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "IN_PROGRESS",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: "author-1",
      signedAt: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.prescription.update.mockResolvedValueOnce({
      id: "prescription-2",
      artifactId,
      medications: revisedMedications,
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "revision" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await ClinicalArtifactService.updatePrescription(
      "prescription-2",
      {
        status: "IN_PROGRESS",
        medications: revisedMedications,
        metadata: { source: "revision" },
      },
      organisationId,
      { actorId: "actor-1", canEditAny: true },
    );

    const { InventoryConsumptionService } =
      await import("../../src/services/inventory-consumption.service");
    expect(
      InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId,
        prescriptionId: "prescription-2",
      }),
    );
    expect(
      InventoryConsumptionService.createPrescriptionDispenseRequest,
    ).not.toHaveBeenCalled();
    expect(
      InventoryConsumptionService.releasePrescription,
    ).not.toHaveBeenCalled();
    expect(
      (
        mockedPrisma.prescription.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data,
    ).toMatchObject({
      items: {
        deleteMany: {},
        create: [
          expect.objectContaining({
            inventoryItemId: "item-1",
            sourceLineKey: "line-1",
            quantity: "3",
          }),
        ],
      },
    });
    expect(
      (
        mockedPrisma.prescription.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data,
    ).not.toHaveProperty("medications");
  });

  it("rejects reopening a final prescription to draft and leaves its items intact", async () => {
    const signedMedications = [
      { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
    ];
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-3",
      artifactId,
      medications: signedMedications,
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "original" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "COMPLETED",
        templateId: "tmpl-2",
        templateVersion: 4,
        templateVersionId: "tmpl-ver-2",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Rx summary",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    // Mock the write path as if it would succeed, so this test fails loudly on
    // the silent reopen + item wipe rather than on an incidental mock crash.
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.prescription.update.mockResolvedValueOnce({
      id: "prescription-3",
      artifactId,
      medications: [],
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "original" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    // The web client hardcodes status 'draft' on every plain save, which maps to
    // DRAFT. Against a COMPLETED prescription that must not silently reopen the
    // artifact and wipe its dispensed items.
    await expect(
      ClinicalArtifactService.updatePrescription(
        "prescription-3",
        {
          status: "DRAFT",
          medications: [
            {
              inventoryItemId: "item-9",
              quantity: 99,
              sourceLineKey: "line-9",
            },
          ],
        },
        organisationId,
        { actorId: "actor-1", canEditAny: true },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
    expect(mockedPrisma.prescription.update).not.toHaveBeenCalled();
    expect(
      InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed,
    ).not.toHaveBeenCalled();
  });

  it("updates a draft prescription normally", async () => {
    mockedPrisma.clinicalArtifact.update.mockReset();
    mockedPrisma.prescription.update.mockReset();
    const revisedMedications = [
      { inventoryItemId: "item-1", quantity: 5, sourceLineKey: "line-1" },
    ];
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-4",
      artifactId,
      medications: [
        { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
      ],
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "original" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "DRAFT",
        templateId: "tmpl-2",
        templateVersion: 4,
        templateVersionId: "tmpl-ver-2",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Rx summary",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-2",
      templateVersion: 4,
      templateVersionId: "tmpl-ver-2",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Rx summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.prescription.update.mockResolvedValueOnce({
      id: "prescription-4",
      artifactId,
      medications: revisedMedications,
      instructions: { text: "Take daily" },
      notes: null,
      metadata: { source: "revision" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await ClinicalArtifactService.updatePrescription(
      "prescription-4",
      { status: "DRAFT", medications: revisedMedications },
      organisationId,
      { actorId: "actor-1", canEditAny: true },
    );

    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
    expect(
      (
        mockedPrisma.prescription.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data,
    ).toMatchObject({
      items: {
        deleteMany: {},
        create: [
          expect.objectContaining({
            inventoryItemId: "item-1",
            sourceLineKey: "line-1",
            quantity: "5",
          }),
        ],
      },
    });
  });

  it("creates a discharge summary artifact and document draft", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "DISCHARGE_SUMMARY",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Discharge summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.dischargeSummary.create.mockResolvedValueOnce({
      id: "discharge-1",
      artifactId,
      summary: { text: "Recovered" },
      diagnoses: [],
      medications: [],
      followUp: null,
      instructions: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-3",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
      kind: "DISCHARGE_SUMMARY",
      version: 1,
      title: "Discharge summary",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-3",
      kind: "DISCHARGE_SUMMARY",
      title: "Discharge summary",
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
    });

    const result = await ClinicalArtifactService.createDischargeSummary({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
      authorId: "author-1",
      summary: "Discharge summary",
      summaryContent: { text: "Recovered" },
      diagnoses: [],
      medications: [],
      followUp: null,
      instructions: null,
      metadata: null,
    });

    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "DISCHARGE_SUMMARY",
          title: "Discharge summary",
          clinicalArtifactId: artifactId,
        }),
      }),
    );
    expect(result.artifact.kind).toBe("DISCHARGE_SUMMARY");
  });

  it("creates a vital record artifact and document draft", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "VITAL_RECORD",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Vitals summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.vitalRecord.create.mockResolvedValueOnce({
      id: "vital-1",
      artifactId,
      measuredAt: new Date("2026-01-01T00:00:00.000Z"),
      recordedBy: "author-1",
      vitals: { temperature: 39.1 },
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-4",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
      kind: "VITAL_RECORD",
      version: 1,
      title: "Vital record",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-4",
      kind: "VITAL_RECORD",
      title: "Vital record",
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
    });

    const result = await ClinicalArtifactService.createVitalRecord({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
      authorId: "author-1",
      summary: "Vitals summary",
      measuredAt: "2026-01-01T00:00:00.000Z",
      recordedBy: "author-1",
      vitals: { temperature: 39.1 },
      notes: null,
      metadata: null,
    });

    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "VITAL_RECORD",
          title: "Vital record",
          clinicalArtifactId: artifactId,
        }),
      }),
    );
    expect(result.artifact.kind).toBe("VITAL_RECORD");
  });

  it("defaults vital record vitals to an empty object when none are provided", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "VITAL_RECORD",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Vitals summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.vitalRecord.create.mockResolvedValueOnce({
      id: "vital-2",
      artifactId,
      measuredAt: new Date("2026-01-01T00:00:00.000Z"),
      recordedBy: "author-1",
      vitals: {},
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-6",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: artifactId,
      templateInstanceId: null,
      clinicalArtifactId: artifactId,
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
      kind: "VITAL_RECORD",
      version: 1,
      title: "Vital record",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      signature: null,
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-6",
      kind: "VITAL_RECORD",
      title: "Vital record",
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
    });

    const result = await ClinicalArtifactService.createVitalRecord({
      organisationId,
      appointmentId: "appt-1",
      encounterId: "enc-1",
      templateId: "tmpl-4",
      templateVersion: 6,
      templateVersionId: "tmpl-ver-4",
      authorId: "author-1",
      summary: "Vitals summary",
      measuredAt: "2026-01-01T00:00:00.000Z",
      recordedBy: "author-1",
      vitals: null,
      notes: null,
      metadata: null,
    });

    expect(mockedPrisma.vitalRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vitals: {},
        }),
      }),
    );
    expect(result.artifact.kind).toBe("VITAL_RECORD");
  });

  it("updates a SOAP note and the shared artifact", async () => {
    mockedPrisma.clinicalArtifact.update.mockReset();
    mockedPrisma.soapNote.update.mockReset();
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "SOAP_NOTE",
      status: "IN_PROGRESS",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: null,
      signedBy: null,
      signedAt: null,
      summary: "Updated summary",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.soapNote.update.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Updated subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Updated plan" },
      diagnoses: [{ code: "B2" }],
      metadata: { source: "manual" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-1",
      kind: "SOAP_NOTE",
      title: "SOAP note",
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
    });

    const result = await ClinicalArtifactService.updateSoapNote(
      soapNoteId,
      {
        status: "IN_PROGRESS",
        summary: "Updated summary",
        subjective: { chiefComplaint: "Updated subjective" },
        plan: { instructions: "Updated plan" },
        diagnoses: [{ code: "B2" }],
        metadata: { source: "manual" },
      },
      organisationId,
    );

    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: artifactId },
      }),
    );
    expect(mockedPrisma.soapNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: soapNoteId },
      }),
    );
    expect(result.artifact.status).toBe("IN_PROGRESS");
    expect(result.soapNote.subjective).toEqual({
      chiefComplaint: "Updated subjective",
    });
  });

  it("rejects direct edits to final SOAP notes", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "COMPLETED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await expect(
      ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        { summary: "edited while final" },
        organisationId,
      ),
    ).rejects.toThrow("Artifact is final. Reopen or amend it before editing.");
    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  // The FHIR status mapper defaults an omitted or unrecognised
  // `Composition.status` to DRAFT, so a plain PATCH arrives carrying DRAFT
  // rather than undefined. Without DRAFT in the guard, one request both edited a
  // finalised record and silently reopened it.
  it("refuses to reopen a final SOAP note by editing it as a DRAFT", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      diagnoses: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        kind: "SOAP_NOTE",
        status: "SIGNED",
        appointmentId: null,
        caseId: null,
        encounterId: null,
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await expect(
      ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        { summary: "edited while signed", status: "DRAFT" },
        organisationId,
      ),
    ).rejects.toThrow("Artifact is final. Reopen or amend it before editing.");
    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("finalizes and reopens SOAP notes through explicit lifecycle helpers", async () => {
    mockedPrisma.clinicalArtifact.update.mockReset();
    mockedPrisma.soapNote.update.mockReset();
    mockedPrisma.soapNote.findUnique.mockResolvedValue({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "IN_PROGRESS",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "SOAP_NOTE",
      status: "COMPLETED",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: null,
      signedBy: null,
      signedAt: null,
      summary: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.soapNote.update.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-1",
      kind: "SOAP_NOTE",
      title: "SOAP note",
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
    });

    await ClinicalArtifactService.finalizeSoapNote(soapNoteId, organisationId);

    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );

    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "COMPLETED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "SOAP_NOTE",
      status: "IN_PROGRESS",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: null,
      signedBy: null,
      signedAt: null,
      summary: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    mockedPrisma.soapNote.update.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-1",
      kind: "SOAP_NOTE",
      title: "SOAP note",
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
    });

    await ClinicalArtifactService.reopenSoapNote(soapNoteId, organisationId);

    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      }),
    );
  });

  it("loads prescriptions by prescription id or clinical artifact id", async () => {
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [],
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);

    const result = await ClinicalArtifactService.getPrescription(
      artifactId,
      organisationId,
    );

    expect(mockedPrisma.prescription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: artifactId }, { artifactId }],
        },
      }),
    );
    expect(result.prescription.id).toBe("prescription-1");
  });

  it("voids draft prescriptions and removes their workspace treatment items", async () => {
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [],
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "PRESCRIPTION",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);
    // The guard now asks directly for a BILLED row rather than loading one row
    // and inspecting it, so "nothing billed" is null. The old shape - one
    // unbilled row - was the bug: the delete below removes EVERY row for the
    // prescription, and package expansion routinely creates several.
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValue(null);
    mockedPrisma.workspaceTreatmentItem.deleteMany.mockResolvedValueOnce({
      count: 1,
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "VOID",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: null,
      signedBy: null,
      signedAt: null,
      summary: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await ClinicalArtifactService.deletePrescription(
      artifactId,
      organisationId,
      { actorId: "actor-1", canEditAny: true },
    );

    // The guard asks the database for a BILLED row rather than loading one row
    // and inspecting it. That difference is the fix: `deleteMany` below removes
    // EVERY row for the prescription, so a check that only saw one of several
    // could pass while a billed, invoice-linked row was deleted with the rest.
    expect(mockedPrisma.workspaceTreatmentItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId,
          prescriptionId: "prescription-1",
          OR: [
            { billingStatus: { not: "UNBILLED" } },
            { invoiceRowId: { not: null } },
          ],
        },
      }),
    );
    expect(mockedPrisma.workspaceTreatmentItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId,
          prescriptionId: "prescription-1",
        },
      }),
    );
    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "VOID" },
      }),
    );
  });

  it("rejects deleting non-draft prescriptions", async () => {
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [],
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);

    await expect(
      ClinicalArtifactService.deletePrescription(artifactId, organisationId, {
        actorId: "actor-1",
        canEditAny: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("cancels an unbilled dispensed prescription and reverses inventory", async () => {
    const prescription = {
      id: "prescription-1",
      artifactId,
      medications: [
        { inventoryItemId: "item-1", quantity: 2, sourceLineKey: "line-1" },
      ],
      instructions: null,
      notes: null,
      metadata: { dispenseStockSource: "NORMAL" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [],
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "COMPLETED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    };
    const voidedArtifact = {
      ...prescription.artifact,
      status: "VOID",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
      prescription as never,
    );
    // The guard now asks directly for a BILLED row rather than loading one row
    // and inspecting it, so "nothing billed" is null. The old shape - one
    // unbilled row - was the bug: the delete below removes EVERY row for the
    // prescription, and package expansion routinely creates several.
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValue(null);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "dispense-1",
      status: "DISPENSED",
    });
    mockedPrisma.workspaceTreatmentItem.deleteMany.mockResolvedValueOnce({
      count: 1,
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(voidedArtifact);

    const result = await ClinicalArtifactService.cancelPrescription(
      artifactId,
      organisationId,
      { actorId: "actor-1", canEditAny: true },
    );

    expect(
      InventoryConsumptionService.voidDispensePrescription,
    ).toHaveBeenCalledWith({
      organisationId,
      prescriptionId: "prescription-1",
      medications: prescription.medications,
      metadata: prescription.metadata,
    });
    expect(mockedPrisma.workspaceTreatmentItem.deleteMany).toHaveBeenCalledWith(
      {
        where: {
          organisationId,
          prescriptionId: "prescription-1",
        },
      },
    );
    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
      where: { id: artifactId },
      data: { status: "VOID" },
    });
    expect(result.artifact.status).toBe("VOID");
  });

  it("marks a pending dispense request not dispensed when cancelling", async () => {
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [],
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: null,
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValueOnce({
      id: "dispense-1",
      status: "PENDING",
    });
    mockedPrisma.workspaceTreatmentItem.deleteMany.mockResolvedValueOnce({
      count: 0,
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      id: artifactId,
      organisationId,
      kind: "PRESCRIPTION",
      status: "VOID",
    });

    await ClinicalArtifactService.cancelPrescription(
      artifactId,
      organisationId,
      { actorId: "actor-1", canEditAny: true },
    );

    expect(
      InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed,
    ).toHaveBeenCalledWith({
      organisationId,
      prescriptionId: "prescription-1",
      metadata: null,
    });
    expect(
      InventoryConsumptionService.voidDispensePrescription,
    ).not.toHaveBeenCalled();
  });

  it("rejects cancelling a billed prescription without changing inventory", async () => {
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "prescription-1",
      artifactId,
      medications: [],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      items: [],
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "COMPLETED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValueOnce({
      id: "treatment-item-1",
      billingStatus: "BILLED",
      invoiceRowId: "invoice-row-1",
    });

    await expect(
      ClinicalArtifactService.cancelPrescription(artifactId, organisationId, {
        actorId: "actor-1",
        canEditAny: true,
      }),
    ).rejects.toMatchObject({
      message: "Prescription has already been billed or paid.",
      statusCode: 409,
    });
    expect(
      InventoryConsumptionService.voidDispensePrescription,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("amends a discharge summary into a fresh draft record", async () => {
    mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
      id: "discharge-1",
      artifactId,
      summary: { text: "Recovered" },
      diagnoses: [{ code: "A1" }],
      medications: [],
      followUp: { afterDays: 7 },
      instructions: { text: "Rest" },
      metadata: { source: "template" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId,
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "DISCHARGE_SUMMARY",
        status: "COMPLETED",
        templateId: "tmpl-3",
        templateVersion: 5,
        templateVersionId: "tmpl-ver-3",
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Discharge summary",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce({
      id: "artifact-amend-1",
      organisationId,
      kind: "DISCHARGE_SUMMARY",
      status: "DRAFT",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Discharge summary",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.dischargeSummary.create.mockResolvedValueOnce({
      id: "discharge-amend-1",
      artifactId: "artifact-amend-1",
      summary: { text: "Recovered" },
      diagnoses: [{ code: "A1" }],
      medications: [],
      followUp: { afterDays: 7 },
      instructions: { text: "Rest" },
      metadata: { source: "template" },
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-amend-1",
      organisationId,
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: "artifact-amend-1",
      templateInstanceId: null,
      clinicalArtifactId: "artifact-amend-1",
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
      kind: "DISCHARGE_SUMMARY",
      version: 1,
      title: "Discharge summary",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      signature: null,
    });
    mockClinicalRenderedDocumentPersistence({
      id: "doc-amend-1",
      kind: "DISCHARGE_SUMMARY",
      title: "Discharge summary",
      sourceId: "artifact-amend-1",
      templateId: "tmpl-3",
      templateVersion: 5,
      templateVersionId: "tmpl-ver-3",
    });

    const amended = await ClinicalArtifactService.amendDischargeSummary(
      "discharge-1",
      organisationId,
    );

    expect(amended.artifact.status).toBe("DRAFT");
    expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          templateId: "tmpl-3",
        }),
      }),
    );
  });

  it("rejects updates for the wrong organisation", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: soapNoteId,
      artifactId,
      subjective: { chiefComplaint: "Subjective" },
      objective: { findings: "Objective" },
      assessment: { diagnosis: "Assessment" },
      plan: { instructions: "Plan" },
      diagnoses: [],
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact: {
        id: artifactId,
        organisationId: "other-org",
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: null,
        signedBy: null,
        signedAt: null,
        summary: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await expect(
      ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        { summary: "Nope" },
        organisationId,
      ),
    ).rejects.toBeInstanceOf(ClinicalArtifactServiceError);
  });

  describe("encounter and appointment list queries", () => {
    beforeEach(resetClinicalPrismaMocks);

    it("lists SOAP notes for an encounter newest first", async () => {
      mockedPrisma.soapNote.findMany.mockResolvedValueOnce([
        soapRow({ artifact: artifactRow({ encounterId: "enc-1" }) }),
      ]);

      const records = await ClinicalArtifactService.listSoapNotesForEncounter(
        `  ${organisationId}  `,
        " enc-1 ",
      );

      expect(mockedPrisma.soapNote.findMany).toHaveBeenCalledWith({
        where: {
          artifact: {
            organisationId,
            encounterId: "enc-1",
            kind: "SOAP_NOTE",
          },
        },
        include: { artifact: true },
        orderBy: { createdAt: "desc" },
      });
      expect(records).toHaveLength(1);
      expect(records[0].artifact.encounterId).toBe("enc-1");
      expect(records[0].soapNote.id).toBe(soapNoteId);
    });

    it("lists SOAP notes for an appointment newest first", async () => {
      mockedPrisma.soapNote.findMany.mockResolvedValueOnce([
        soapRow({ artifact: artifactRow({ appointmentId: "appt-1" }) }),
      ]);

      const records = await ClinicalArtifactService.listSoapNotesForAppointment(
        organisationId,
        "appt-1",
      );

      expect(mockedPrisma.soapNote.findMany).toHaveBeenCalledWith({
        where: {
          artifact: {
            organisationId,
            appointmentId: "appt-1",
            kind: "SOAP_NOTE",
          },
        },
        include: { artifact: true },
        orderBy: { createdAt: "desc" },
      });
      expect(records[0].artifact.appointmentId).toBe("appt-1");
      expect(records[0].soapNote.plan).toEqual({ instructions: "P" });
    });

    it.each([
      [
        "a blank organisation",
        () => ClinicalArtifactService.listSoapNotesForEncounter("   ", "enc-1"),
        "Invalid organisationId",
      ],
      [
        "a blank encounter",
        () =>
          ClinicalArtifactService.listSoapNotesForEncounter(organisationId, ""),
        "Invalid encounterId",
      ],
      [
        "a blank appointment",
        () =>
          ClinicalArtifactService.listSoapNotesForAppointment(
            organisationId,
            "  ",
          ),
        "Invalid appointmentId",
      ],
      [
        "a non-string organisation",
        () =>
          ClinicalArtifactService.listSoapNotesForAppointment(
            undefined as unknown as string,
            "appt-1",
          ),
        "Invalid organisationId",
      ],
    ])("rejects %s before touching the database", async (_l, call, message) => {
      await expect(call()).rejects.toMatchObject({ statusCode: 400, message });
      expect(mockedPrisma.soapNote.findMany).not.toHaveBeenCalled();
    });

    it("lists non-void prescriptions for an appointment and hydrates both line items and json medications", async () => {
      mockedPrisma.prescription.findMany.mockResolvedValueOnce([
        prescriptionRow({
          items: [
            prescriptionItemRow({
              inventoryItemId: "inv-1",
              quantity: "2",
              expiryDate: D2,
            }),
          ],
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            appointmentId: "appt-1",
          }),
        }),
        prescriptionRow({
          id: "prescription-2",
          items: null,
          medications: [{ inventoryItemId: "inv-1", quantity: 5 }],
          artifact: artifactRow({
            id: "artifact-2",
            kind: "PRESCRIPTION",
            appointmentId: "appt-1",
          }),
        }),
      ]);
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          name: "Amoxicillin 500mg",
          genericName: "Amoxicillin",
          strength: "500mg",
          dosageForm: "Capsule",
          controlledItem: true,
        },
      ]);

      const records =
        await ClinicalArtifactService.listPrescriptionsForAppointment(
          organisationId,
          "appt-1",
        );

      expect(mockedPrisma.prescription.findMany).toHaveBeenCalledWith({
        where: {
          artifact: {
            organisationId,
            appointmentId: "appt-1",
            kind: "PRESCRIPTION",
            status: { not: "VOID" },
          },
        },
        include: { artifact: true, items: true },
        orderBy: { createdAt: "desc" },
      });
      expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ["inv-1"] },
            organisationId: { in: ["org-1"] },
          },
        }),
      );

      const fromItems = records[0].prescription.medications as Array<
        Record<string, unknown>
      >;
      expect(fromItems).toEqual([
        expect.objectContaining({
          medication: "Amoxicillin",
          quantity: 2,
          inventoryItemId: "inv-1",
          expiryDate: D2.toISOString(),
        }),
      ]);

      const fromJson = records[1].prescription.medications as Array<
        Record<string, unknown>
      >;
      expect(fromJson).toEqual([
        expect.objectContaining({
          medication: "Amoxicillin 500mg",
          genericName: "Amoxicillin",
          strength: "500mg",
          dosageForm: "Capsule",
          controlledItem: true,
          quantity: 5,
        }),
      ]);
      expect(records[1].prescription.items).toEqual([]);
    });

    it("skips non-record medication entries when collecting inventory references", async () => {
      mockedPrisma.prescription.findMany.mockResolvedValueOnce([
        prescriptionRow({
          items: [],
          medications: ["free-text line", { inventoryItemId: "inv-1" }],
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            encounterId: "enc-1",
          }),
        }),
      ]);
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          name: "Amoxicillin 500mg",
          genericName: null,
          strength: null,
          dosageForm: null,
          controlledItem: false,
        },
      ]);

      const records =
        await ClinicalArtifactService.listPrescriptionsForEncounter(
          organisationId,
          "enc-1",
        );

      expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ["inv-1"] },
            organisationId: { in: ["org-1"] },
          },
        }),
      );
      const meds = records[0].prescription.medications as unknown[];
      expect(meds[0]).toBe("free-text line");
      expect(meds[1]).toEqual({
        inventoryItemId: "inv-1",
        medication: "Amoxicillin 500mg",
        strength: undefined,
        genericName: undefined,
        dosageForm: undefined,
        controlledItem: false,
      });
    });

    it("emits an undefined metadata column for a line item that carries none", async () => {
      const { metadata: _metadata, ...itemWithoutMetadata } =
        prescriptionItemRow({ inventoryItemId: "inv-1" });
      mockedPrisma.prescription.findMany.mockResolvedValueOnce([
        prescriptionRow({
          items: [itemWithoutMetadata],
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            encounterId: "enc-1",
          }),
        }),
      ]);

      const records =
        await ClinicalArtifactService.listPrescriptionsForEncounter(
          organisationId,
          "enc-1",
        );

      const meds = records[0].prescription.medications as Array<
        Record<string, unknown>
      >;
      expect(meds).toHaveLength(1);
      expect(Object.hasOwn(meds[0], "metadata")).toBe(true);
      expect(meds[0].metadata).toBeUndefined();
    });

    it.each([
      [
        "encounter",
        () =>
          ClinicalArtifactService.listDischargeSummariesForEncounter(
            organisationId,
            "enc-1",
          ),
        { encounterId: "enc-1" },
      ],
      [
        "appointment",
        () =>
          ClinicalArtifactService.listDischargeSummariesForAppointment(
            organisationId,
            "appt-1",
          ),
        { appointmentId: "appt-1" },
      ],
    ])(
      "lists discharge summaries for an %s",
      async (_label, call, scopeFilter) => {
        mockedPrisma.dischargeSummary.findMany.mockResolvedValueOnce([
          dischargeRow(),
        ]);

        const records = await call();

        expect(mockedPrisma.dischargeSummary.findMany).toHaveBeenCalledWith({
          where: {
            artifact: {
              organisationId,
              ...scopeFilter,
              kind: "DISCHARGE_SUMMARY",
            },
          },
          include: { artifact: true },
          orderBy: { createdAt: "desc" },
        });
        expect(records).toHaveLength(1);
        expect(records[0].artifact.kind).toBe("DISCHARGE_SUMMARY");
        expect(records[0].dischargeSummary).toEqual({
          id: "discharge-1",
          artifactId,
          summary: { text: "Recovered" },
          diagnoses: [{ code: "A1" }],
          medications: [{ medication: "Amox" }],
          followUp: { afterDays: 7 },
          instructions: { text: "Rest" },
          metadata: { source: "template" },
          createdAt: D1,
          updatedAt: D1,
        });
      },
    );

    it.each([
      [
        "encounter",
        () =>
          ClinicalArtifactService.listVitalRecordsForEncounter(
            organisationId,
            "enc-1",
          ),
        { encounterId: "enc-1" },
      ],
      [
        "appointment",
        () =>
          ClinicalArtifactService.listVitalRecordsForAppointment(
            organisationId,
            "appt-1",
          ),
        { appointmentId: "appt-1" },
      ],
    ])(
      "lists vital records for an %s ordered by measurement time and resolves the recorder",
      async (_label, call, scopeFilter) => {
        mockedPrisma.vitalRecord.findMany.mockResolvedValueOnce([
          vitalRow({ metadata: { recordedByDisplay: "Nurse Joy" } }),
          vitalRow({ id: "vital-2", recordedBy: "Practitioner/user-9" }),
        ]);
        mockedPrisma.user.findFirst.mockResolvedValueOnce({
          firstName: "Ada",
          lastName: "Byron",
        });

        const records = await call();

        expect(mockedPrisma.vitalRecord.findMany).toHaveBeenCalledWith({
          where: {
            artifact: {
              organisationId,
              ...scopeFilter,
              kind: "VITAL_RECORD",
            },
          },
          include: { artifact: true },
          orderBy: { measuredAt: "desc" },
        });
        expect(records.map((r) => r.vitalRecord.recordedByDisplay)).toEqual([
          "Nurse Joy",
          "Ada Byron",
        ]);
        expect(mockedPrisma.user.findFirst).toHaveBeenCalledTimes(1);
        expect(records[0].artifact.kind).toBe("VITAL_RECORD");
      },
    );
  });

  describe("vital record recorder resolution", () => {
    beforeEach(resetClinicalPrismaMocks);

    it.each<
      [
        string,
        Record<string, unknown>,
        Record<string, unknown> | null,
        string | null,
      ]
    >([
      [
        "prefers a trimmed metadata display over the user lookup",
        {
          metadata: { recordedByDisplay: " Nurse Joy " },
          recordedBy: "Practitioner/user-9",
        },
        { firstName: "Ada", lastName: "Byron" },
        "Nurse Joy",
      ],
      [
        "ignores a non-string metadata display",
        {
          metadata: { recordedByDisplay: 42 },
          recordedBy: "Practitioner/user-9",
        },
        { firstName: "Ada", lastName: "Byron" },
        "Ada Byron",
      ],
      [
        "ignores a blank metadata display",
        { metadata: { recordedByDisplay: "   " }, recordedBy: "user-9" },
        { firstName: "Ada", lastName: null },
        "Ada",
      ],
      [
        "ignores metadata that is not an object",
        { metadata: ["nope"], recordedBy: "user-9" },
        { firstName: null, lastName: "Byron" },
        "Byron",
      ],
      [
        "returns null when there is no recorder at all",
        { metadata: null, recordedBy: null },
        null,
        null,
      ],
      [
        "returns null for a bare Practitioner reference",
        { metadata: null, recordedBy: "Practitioner/" },
        null,
        null,
      ],
      [
        "returns null when the referenced user is missing",
        { metadata: null, recordedBy: "user-9" },
        null,
        null,
      ],
      [
        "returns null when the referenced user has no name",
        { metadata: null, recordedBy: "user-9" },
        { firstName: "", lastName: null },
        null,
      ],
    ])("%s", async (_label, overrides, userRow, expected) => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow(overrides),
      );
      mockedPrisma.user.findFirst.mockResolvedValueOnce(userRow);

      const record = await ClinicalArtifactService.getVitalRecord(
        "vital-1",
        organisationId,
      );

      expect(record.vitalRecord.recordedByDisplay).toBe(expected);
      expect(record.artifact.kind).toBe("VITAL_RECORD");
      expect(record.vitalRecord.vitals).toEqual({ temperature: 38.2 });
    });

    it("does not query the user directory when metadata already names the recorder", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({
          metadata: { recordedByDisplay: "Nurse Joy" },
          recordedBy: "Practitioner/user-9",
        }),
      );

      await ClinicalArtifactService.getVitalRecord("vital-1", organisationId);

      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("looks the recorder up by the reference-stripped user id", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({ recordedBy: "Practitioner/user-9" }),
      );
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Ada",
        lastName: "Byron",
      });

      await ClinicalArtifactService.getVitalRecord("vital-1", organisationId);

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-9" },
        select: { firstName: true, lastName: true },
      });
    });
  });

  describe("vital record lifecycle", () => {
    beforeEach(resetClinicalPrismaMocks);

    const stubVitalUpdate = (
      artifactOverrides: Record<string, unknown> = {},
      vitalOverrides: Record<string, unknown> = {},
    ) => {
      mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
        artifactRow({ kind: "VITAL_RECORD", ...artifactOverrides }),
      );
      const { artifact: _artifact, ...vitalWithoutArtifact } = vitalRow(
        vitalOverrides,
      ) as Record<string, unknown>;
      mockedPrisma.vitalRecord.update.mockResolvedValueOnce(
        vitalWithoutArtifact,
      );
      mockClinicalRenderedDocumentPersistence({
        id: "doc-vital",
        kind: "VITAL_RECORD",
        title: "Vital record",
      });
    };

    it("applies every supplied field and folds the display name into metadata", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({
          recordedBy: "old-user",
          metadata: { recordedByDisplay: "Old Nurse", origin: "device" },
        }),
      );
      stubVitalUpdate(
        { status: "IN_PROGRESS", summary: "Updated" },
        {
          recordedBy: "new-user",
          metadata: { origin: "manual", recordedByDisplay: "New Nurse" },
          measuredAt: D2,
        },
      );

      const result = await ClinicalArtifactService.updateVitalRecord(
        "vital-1",
        {
          status: "IN_PROGRESS",
          summary: "  Updated  ",
          measuredAt: "2026-01-02T00:00:00.000Z",
          recordedBy: "  new-user  ",
          recordedByDisplay: "New Nurse",
          vitals: { temperature: 39 },
          notes: { text: "watch overnight" },
          metadata: { origin: "manual" },
        },
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
        where: { id: artifactId },
        data: { status: "IN_PROGRESS", summary: "Updated" },
      });
      expect(mockedPrisma.vitalRecord.update).toHaveBeenCalledWith({
        where: { id: "vital-1" },
        data: {
          measuredAt: D2,
          recordedBy: "new-user",
          vitals: { temperature: 39 },
          notes: { text: "watch overnight" },
          metadata: { origin: "manual", recordedByDisplay: "New Nurse" },
        },
      });
      expect(result.vitalRecord.recordedByDisplay).toBe("New Nurse");
      expect(result.artifact.status).toBe("IN_PROGRESS");
      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("keeps the stored values for every field the caller omits", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({
          recordedBy: "old-user",
          notes: { text: "existing" },
          metadata: { recordedByDisplay: "Old Nurse" },
        }),
      );
      stubVitalUpdate(
        {},
        {
          recordedBy: "old-user",
          notes: { text: "existing" },
          metadata: { recordedByDisplay: "Old Nurse" },
        },
      );

      const result = await ClinicalArtifactService.updateVitalRecord(
        "vital-1",
        {},
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
        where: { id: artifactId },
        data: { status: "DRAFT", summary: null },
      });
      expect(mockedPrisma.vitalRecord.update).toHaveBeenCalledWith({
        where: { id: "vital-1" },
        data: {
          measuredAt: D1,
          recordedBy: "old-user",
          vitals: { temperature: 38.2 },
          notes: { text: "existing" },
          metadata: { recordedByDisplay: "Old Nurse" },
        },
      });
      expect(result.vitalRecord.recordedByDisplay).toBe("Old Nurse");
    });

    it("clears the recorded display name when an empty display is supplied", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({ metadata: null }),
      );
      stubVitalUpdate({}, { metadata: null });

      const result = await ClinicalArtifactService.updateVitalRecord(
        "vital-1",
        { recordedByDisplay: "   " },
        organisationId,
      );

      const [{ data }] = mockedPrisma.vitalRecord.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.metadata).toBe(Prisma.JsonNull);
      expect(result.vitalRecord.recordedByDisplay).toBeNull();
    });

    it("seeds a metadata object when there is none and a display name arrives", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({ metadata: null }),
      );
      stubVitalUpdate({}, { metadata: { recordedByDisplay: "Nurse Joy" } });

      await ClinicalArtifactService.updateVitalRecord(
        "vital-1",
        { recordedByDisplay: "Nurse Joy" },
        organisationId,
      );

      const [{ data }] = mockedPrisma.vitalRecord.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.metadata).toEqual({ recordedByDisplay: "Nurse Joy" });
    });

    it("leaves non-object metadata untouched rather than grafting a display onto it", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({ metadata: ["legacy"] }),
      );
      stubVitalUpdate({}, { metadata: ["legacy"] });

      const result = await ClinicalArtifactService.updateVitalRecord(
        "vital-1",
        { recordedByDisplay: "Nurse Joy" },
        organisationId,
      );

      const [{ data }] = mockedPrisma.vitalRecord.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.metadata).toEqual(["legacy"]);
      expect(result.vitalRecord.recordedByDisplay).toBe("Nurse Joy");
    });

    it.each([
      [
        "an unparsable measurement time",
        { measuredAt: "not-a-date" },
        "Invalid measuredAt",
      ],
    ])("rejects %s", async (_label, input, message) => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(vitalRow());

      await expect(
        ClinicalArtifactService.updateVitalRecord(
          "vital-1",
          input,
          organisationId,
        ),
      ).rejects.toMatchObject({ statusCode: 400, message });
      expect(mockedPrisma.vitalRecord.update).not.toHaveBeenCalled();
    });

    it("refuses to edit a final vital record", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({
          artifact: artifactRow({ kind: "VITAL_RECORD", status: "SIGNED" }),
        }),
      );

      await expect(
        ClinicalArtifactService.updateVitalRecord(
          "vital-1",
          { summary: "late edit" },
          organisationId,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Artifact is final. Reopen or amend it before editing.",
      });
      expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
    });

    it("allows a final vital record to be moved back to a non-final status", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({
          artifact: artifactRow({ kind: "VITAL_RECORD", status: "COMPLETED" }),
        }),
      );
      stubVitalUpdate({ status: "IN_PROGRESS" });

      const result = await ClinicalArtifactService.reopenVitalRecord(
        "vital-1",
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
        where: { id: artifactId },
        data: { status: "IN_PROGRESS", summary: null },
      });
      expect(result.artifact.status).toBe("IN_PROGRESS");
    });

    it("finalizes a vital record through the lifecycle helper", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(vitalRow());
      stubVitalUpdate({ status: "COMPLETED" });

      const result = await ClinicalArtifactService.finalizeVitalRecord(
        "vital-1",
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
        where: { id: artifactId },
        data: { status: "COMPLETED", summary: null },
      });
      expect(result.artifact.status).toBe("COMPLETED");
    });

    it.each([
      ["a missing vital record", null, 404, "Vital record not found"],
      [
        "an artifact of the wrong kind",
        () => vitalRow({ artifact: artifactRow({ kind: "SOAP_NOTE" }) }),
        409,
        "Artifact is not a vital record",
      ],
      [
        "an artifact owned by another organisation",
        () =>
          vitalRow({
            artifact: artifactRow({
              kind: "VITAL_RECORD",
              organisationId: "other-org",
            }),
          }),
        403,
        "Artifact does not belong to organisation",
      ],
    ])("rejects %s", async (_label, row, statusCode, message) => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        typeof row === "function" ? row() : row,
      );

      await expect(
        ClinicalArtifactService.getVitalRecord("vital-1", organisationId),
      ).rejects.toMatchObject({ statusCode, message });
    });

    it("rejects a blank vital record id before querying", async () => {
      await expect(
        ClinicalArtifactService.getVitalRecord("   ", organisationId),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid vitalRecordId",
      });
      expect(mockedPrisma.vitalRecord.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ["an unparsable measurement time", "not-a-date", "Invalid measuredAt"],
      ["a missing measurement time", undefined, "Invalid measuredAt"],
    ])(
      "refuses to create a vital record with %s",
      async (_l, measuredAt, message) => {
        await expect(
          ClinicalArtifactService.createVitalRecord({
            organisationId,
            measuredAt: measuredAt as unknown as string,
            vitals: {},
          }),
        ).rejects.toMatchObject({ statusCode: 400, message });
        expect(mockedPrisma.clinicalArtifact.create).not.toHaveBeenCalled();
      },
    );

    it("amends a vital record into a fresh draft carrying the whole clinical context", async () => {
      const sourceArtifact = artifactRow({
        kind: "VITAL_RECORD",
        status: "COMPLETED",
        appointmentId: "appt-1",
        caseId: "case-1",
        encounterId: "enc-1",
        templateId: "tmpl-1",
        templateVersion: 3,
        templateVersionId: "tmpl-ver-1",
        authorId: "author-1",
        summary: "Vitals",
      });
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(
        vitalRow({
          artifact: sourceArtifact,
          recordedBy: "Practitioner/user-9",
          metadata: { recordedByDisplay: "Nurse Joy" },
        }),
      );
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({
          id: "artifact-amend",
          kind: "VITAL_RECORD",
          status: "DRAFT",
          appointmentId: "appt-1",
          encounterId: "enc-1",
          summary: "Vitals",
        }),
      );
      const { artifact: _artifact, ...createdVital } = vitalRow({
        id: "vital-amend",
      }) as Record<string, unknown>;
      mockedPrisma.vitalRecord.create.mockResolvedValueOnce(createdVital);
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-vital",
        kind: "VITAL_RECORD",
        title: "Vital record",
        sourceId: "artifact-amend",
      });

      const amended = await ClinicalArtifactService.amendVitalRecord(
        "vital-1",
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
        data: {
          organisationId,
          appointmentId: "appt-1",
          caseId: "case-1",
          encounterId: "enc-1",
          kind: "VITAL_RECORD",
          status: "DRAFT",
          templateId: "tmpl-1",
          templateVersion: 3,
          templateVersionId: "tmpl-ver-1",
          authorId: "author-1",
          summary: "Vitals",
        },
      });
      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: "appt-1",
          organisationId,
          // Bound to the artifact's own encounter: these routes run on
          // clinical-artifact permissions, so without it a throwaway artifact
          // could advance any colleague's checked-in appointment.
          encounterId: "enc-1",
          status: "CHECKED_IN",
        },
        data: { status: "IN_PROGRESS" },
      });
      expect(amended.artifact.status).toBe("DRAFT");
      expect(amended.vitalRecord.id).toBe("vital-amend");
    });

    it("amends a context-free vital record without advancing any appointment", async () => {
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(vitalRow());
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({ id: "artifact-amend", kind: "VITAL_RECORD" }),
      );
      const { artifact: _artifact, ...createdVital } = vitalRow({
        id: "vital-amend",
      }) as Record<string, unknown>;
      mockedPrisma.vitalRecord.create.mockResolvedValueOnce(createdVital);
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-vital",
        kind: "VITAL_RECORD",
        title: "Vital record",
        sourceId: "artifact-amend",
      });

      await ClinicalArtifactService.amendVitalRecord("vital-1", organisationId);

      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
        data: {
          organisationId,
          appointmentId: undefined,
          caseId: undefined,
          encounterId: undefined,
          kind: "VITAL_RECORD",
          status: "DRAFT",
          templateId: undefined,
          templateVersion: undefined,
          templateVersionId: undefined,
          authorId: undefined,
          summary: null,
        },
      });
      expect(mockedPrisma.appointment.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("discharge summary lifecycle", () => {
    beforeEach(resetClinicalPrismaMocks);

    const stubDischargeUpdate = (
      artifactOverrides: Record<string, unknown> = {},
      dischargeOverrides: Record<string, unknown> = {},
    ) => {
      mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
        artifactRow({ kind: "DISCHARGE_SUMMARY", ...artifactOverrides }),
      );
      const { artifact: _artifact, ...dischargeWithoutArtifact } = dischargeRow(
        dischargeOverrides,
      ) as Record<string, unknown>;
      mockedPrisma.dischargeSummary.update.mockResolvedValueOnce(
        dischargeWithoutArtifact,
      );
      mockClinicalRenderedDocumentPersistence({
        id: "doc-discharge",
        kind: "DISCHARGE_SUMMARY",
        title: "Discharge summary",
      });
    };

    it("writes every supplied discharge section", async () => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
        dischargeRow(),
      );
      stubDischargeUpdate({ status: "IN_PROGRESS", summary: "Ready to go" });

      const result = await ClinicalArtifactService.updateDischargeSummary(
        "discharge-1",
        {
          status: "IN_PROGRESS",
          summary: "Ready to go",
          summaryContent: { text: "Discharged well" },
          diagnoses: [{ code: "B2" }],
          medications: [{ medication: "Meloxicam" }],
          followUp: { afterDays: 3 },
          instructions: { text: "Short walks" },
          metadata: { source: "manual" },
        },
        organisationId,
      );

      expect(mockedPrisma.dischargeSummary.update).toHaveBeenCalledWith({
        where: { id: "discharge-1" },
        data: {
          summary: { text: "Discharged well" },
          diagnoses: [{ code: "B2" }],
          medications: [{ medication: "Meloxicam" }],
          followUp: { afterDays: 3 },
          instructions: { text: "Short walks" },
          metadata: { source: "manual" },
        },
      });
      expect(result.artifact.status).toBe("IN_PROGRESS");
      expect(result.artifact.kind).toBe("DISCHARGE_SUMMARY");
    });

    it("keeps the stored discharge sections for every omitted field", async () => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
        dischargeRow(),
      );
      stubDischargeUpdate();

      await ClinicalArtifactService.updateDischargeSummary(
        "discharge-1",
        {},
        organisationId,
      );

      expect(mockedPrisma.dischargeSummary.update).toHaveBeenCalledWith({
        where: { id: "discharge-1" },
        data: {
          summary: { text: "Recovered" },
          diagnoses: [{ code: "A1" }],
          medications: [{ medication: "Amox" }],
          followUp: { afterDays: 7 },
          instructions: { text: "Rest" },
          metadata: { source: "template" },
        },
      });
    });

    it("refuses to edit a final discharge summary", async () => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
        dischargeRow({
          artifact: artifactRow({
            kind: "DISCHARGE_SUMMARY",
            status: "COMPLETED",
          }),
        }),
      );

      await expect(
        ClinicalArtifactService.updateDischargeSummary(
          "discharge-1",
          { status: "SIGNED" },
          organisationId,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Artifact is final. Reopen or amend it before editing.",
      });
      expect(mockedPrisma.dischargeSummary.update).not.toHaveBeenCalled();
    });

    it.each([
      ["finalizeDischargeSummary", "COMPLETED"],
      ["reopenDischargeSummary", "IN_PROGRESS"],
    ] as const)("%s moves the artifact to %s", async (method, status) => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
        dischargeRow({
          artifact: artifactRow({
            kind: "DISCHARGE_SUMMARY",
            status: status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED",
          }),
        }),
      );
      stubDischargeUpdate({ status });

      const result = await ClinicalArtifactService[method](
        "discharge-1",
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
        where: { id: artifactId },
        data: { status, summary: null },
      });
      expect(result.artifact.status).toBe(status);
    });

    it.each([
      ["a missing discharge summary", null, 404, "Discharge summary not found"],
      [
        "an artifact of the wrong kind",
        () => dischargeRow({ artifact: artifactRow({ kind: "SOAP_NOTE" }) }),
        409,
        "Artifact is not a discharge summary",
      ],
    ])("rejects %s", async (_label, row, statusCode, message) => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
        typeof row === "function" ? row() : row,
      );

      await expect(
        ClinicalArtifactService.getDischargeSummary(
          "discharge-1",
          organisationId,
        ),
      ).rejects.toMatchObject({ statusCode, message });
    });

    it("amends a context-free discharge summary into a draft with no inherited template", async () => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
        dischargeRow({
          artifact: artifactRow({
            kind: "DISCHARGE_SUMMARY",
            status: "COMPLETED",
          }),
        }),
      );
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({ id: "artifact-amend", kind: "DISCHARGE_SUMMARY" }),
      );
      const { artifact: _artifact, ...createdDischarge } = dischargeRow({
        id: "discharge-amend",
      }) as Record<string, unknown>;
      mockedPrisma.dischargeSummary.create.mockResolvedValueOnce(
        createdDischarge,
      );
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-discharge",
        kind: "DISCHARGE_SUMMARY",
        title: "Discharge summary",
        sourceId: "artifact-amend",
      });

      const amended = await ClinicalArtifactService.amendDischargeSummary(
        "discharge-1",
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
        data: {
          organisationId,
          appointmentId: undefined,
          caseId: undefined,
          encounterId: undefined,
          kind: "DISCHARGE_SUMMARY",
          status: "DRAFT",
          templateId: undefined,
          templateVersion: undefined,
          templateVersionId: undefined,
          authorId: undefined,
          summary: null,
        },
      });
      expect(mockedPrisma.dischargeSummary.create).toHaveBeenCalledWith({
        data: {
          artifactId: "artifact-amend",
          summary: { text: "Recovered" },
          diagnoses: [{ code: "A1" }],
          medications: [{ medication: "Amox" }],
          followUp: { afterDays: 7 },
          instructions: { text: "Rest" },
          metadata: { source: "template" },
        },
      });
      expect(amended.dischargeSummary.id).toBe("discharge-amend");
    });
  });

  describe("SOAP note lifecycle gaps", () => {
    beforeEach(resetClinicalPrismaMocks);

    it("reports a missing SOAP note as 404", async () => {
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(null);

      await expect(
        ClinicalArtifactService.getSoapNote(soapNoteId, organisationId),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "SOAP note not found",
      });
    });

    it("rejects an artifact that is not a SOAP note", async () => {
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(
        soapRow({ artifact: artifactRow({ kind: "PRESCRIPTION" }) }),
      );

      await expect(
        ClinicalArtifactService.getSoapNote(soapNoteId, organisationId),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Artifact is not a SOAP note",
      });
    });

    it("writes every supplied SOAP section", async () => {
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());
      mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
        artifactRow({ status: "IN_PROGRESS", summary: "Updated" }),
      );
      const { artifact: _artifact, ...updatedNote } = soapRow() as Record<
        string,
        unknown
      >;
      mockedPrisma.soapNote.update.mockResolvedValueOnce(updatedNote);
      mockClinicalRenderedDocumentPersistence({
        id: "doc-soap",
        kind: "SOAP_NOTE",
        title: "SOAP note",
      });

      await ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        {
          status: "IN_PROGRESS",
          summary: "Updated",
          subjective: { chiefComplaint: "S2" },
          objective: { findings: "O2" },
          assessment: { diagnosis: "A2" },
          plan: { instructions: "P2" },
          diagnoses: [{ code: "B2" }],
          metadata: { source: "device" },
        },
        organisationId,
      );

      expect(mockedPrisma.soapNote.update).toHaveBeenCalledWith({
        where: { id: soapNoteId },
        data: {
          subjective: { chiefComplaint: "S2" },
          objective: { findings: "O2" },
          assessment: { diagnosis: "A2" },
          plan: { instructions: "P2" },
          diagnoses: [{ code: "B2" }],
          metadata: { source: "device" },
        },
      });
    });

    it("keeps the stored SOAP sections for every omitted field", async () => {
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());
      mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(artifactRow());
      const { artifact: _artifact, ...updatedNote } = soapRow() as Record<
        string,
        unknown
      >;
      mockedPrisma.soapNote.update.mockResolvedValueOnce(updatedNote);
      mockClinicalRenderedDocumentPersistence({
        id: "doc-soap",
        kind: "SOAP_NOTE",
        title: "SOAP note",
      });

      await ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        {},
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith({
        where: { id: artifactId },
        data: { status: "DRAFT", summary: null },
      });
      expect(mockedPrisma.soapNote.update).toHaveBeenCalledWith({
        where: { id: soapNoteId },
        data: {
          subjective: { chiefComplaint: "S" },
          objective: { findings: "O" },
          assessment: { diagnosis: "A" },
          plan: { instructions: "P" },
          diagnoses: [{ code: "A1" }],
          metadata: { source: "manual" },
        },
      });
    });

    it("amends a SOAP note into a fresh draft carrying the whole clinical context", async () => {
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(
        soapRow({
          artifact: artifactRow({
            status: "COMPLETED",
            appointmentId: "appt-1",
            caseId: "case-1",
            encounterId: "enc-1",
            templateId: "tmpl-1",
            templateVersion: 3,
            templateVersionId: "tmpl-ver-1",
            authorId: "author-1",
            summary: "SOAP",
          }),
        }),
      );
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({
          id: "artifact-amend",
          appointmentId: "appt-1",
          summary: "SOAP",
        }),
      );
      const { artifact: _artifact, ...createdNote } = soapRow({
        id: "soap-amend",
      }) as Record<string, unknown>;
      mockedPrisma.soapNote.create.mockResolvedValueOnce(createdNote);
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-soap",
        kind: "SOAP_NOTE",
        title: "SOAP note",
        sourceId: "artifact-amend",
      });

      const amended = await ClinicalArtifactService.amendSoapNote(
        soapNoteId,
        organisationId,
      );

      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
        data: {
          organisationId,
          appointmentId: "appt-1",
          caseId: "case-1",
          encounterId: "enc-1",
          kind: "SOAP_NOTE",
          status: "DRAFT",
          templateId: "tmpl-1",
          templateVersion: 3,
          templateVersionId: "tmpl-ver-1",
          authorId: "author-1",
          summary: "SOAP",
        },
      });
      expect(mockedPrisma.soapNote.create).toHaveBeenCalledWith({
        data: {
          artifactId: "artifact-amend",
          subjective: { chiefComplaint: "S" },
          objective: { findings: "O" },
          assessment: { diagnosis: "A" },
          plan: { instructions: "P" },
          diagnoses: [{ code: "A1" }],
          metadata: { source: "manual" },
        },
      });
      expect(amended.artifact.status).toBe("DRAFT");
      expect(amended.soapNote.id).toBe("soap-amend");
    });

    it("amends a context-free SOAP note without advancing any appointment", async () => {
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({ id: "artifact-amend" }),
      );
      const { artifact: _artifact, ...createdNote } = soapRow({
        id: "soap-amend",
      }) as Record<string, unknown>;
      mockedPrisma.soapNote.create.mockResolvedValueOnce(createdNote);
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-soap",
        kind: "SOAP_NOTE",
        title: "SOAP note",
        sourceId: "artifact-amend",
      });

      await ClinicalArtifactService.amendSoapNote(soapNoteId, organisationId);

      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
        data: {
          organisationId,
          appointmentId: undefined,
          caseId: undefined,
          encounterId: undefined,
          kind: "SOAP_NOTE",
          status: "DRAFT",
          templateId: undefined,
          templateVersion: undefined,
          templateVersionId: undefined,
          authorId: undefined,
          summary: null,
        },
      });
      expect(mockedPrisma.appointment.updateMany).not.toHaveBeenCalled();
    });

    it("skips rendered-document work for an artifact kind that is not document backed", async () => {
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({ kind: "ATTACHMENT" }),
      );
      const { artifact: _artifact, ...createdNote } = soapRow() as Record<
        string,
        unknown
      >;
      mockedPrisma.soapNote.create.mockResolvedValueOnce(createdNote);

      const result = await ClinicalArtifactService.createSoapNote({
        organisationId,
      });

      expect(mockedPrisma.renderedDocument.create).not.toHaveBeenCalled();
      expect(mockedPrisma.renderedDocument.findUnique).not.toHaveBeenCalled();
      expect(result.artifact.kind).toBe("ATTACHMENT");
    });
  });

  describe("prescription lifecycle gaps", () => {
    beforeEach(resetClinicalPrismaMocks);

    it("raises a dispense request when a draft prescription is finalized", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        prescriptionRow({
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            status: "DRAFT",
            authorId: "author-1",
            appointmentId: "appt-1",
            encounterId: "enc-1",
          }),
        }),
      );
      mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
        artifactRow({
          kind: "PRESCRIPTION",
          status: "COMPLETED",
          authorId: "author-1",
          appointmentId: "appt-1",
          encounterId: "enc-1",
        }),
      );
      mockedPrisma.prescription.update.mockResolvedValueOnce({
        id: "prescription-1",
        artifactId,
        items: [prescriptionItemRow({ inventoryItemId: "inv-1" })],
        medications: null,
        instructions: null,
        notes: null,
        metadata: { source: "workspace" },
        createdAt: D1,
        updatedAt: D2,
      });
      mockClinicalRenderedDocumentPersistence({
        id: "doc-rx",
        kind: "PRESCRIPTION",
        title: "Prescription",
      });

      const result = await ClinicalArtifactService.finalizePrescription(
        "prescription-1",
        organisationId,
        { actorId: "author-1", canEditAny: false },
      );

      expect(result.artifact.status).toBe("COMPLETED");
      expect(
        InventoryConsumptionService.createPrescriptionDispenseRequest,
      ).toHaveBeenCalledWith({
        organisationId,
        prescriptionId: "prescription-1",
        medications: expect.arrayContaining([
          expect.objectContaining({ inventoryItemId: "inv-1" }),
        ]),
        metadata: { source: "workspace" },
        requestedBy: "author-1",
        context: { appointmentId: "appt-1", encounterId: "enc-1" },
      });
      expect(
        InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed,
      ).not.toHaveBeenCalled();
    });

    it("writes every supplied prescription field and leaves the line items untouched", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        prescriptionRow({
          instructions: { text: "old" },
          notes: { text: "old note" },
          metadata: { source: "old" },
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            status: "DRAFT",
            authorId: "author-1",
          }),
        }),
      );
      mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
        artifactRow({
          kind: "PRESCRIPTION",
          status: "IN_PROGRESS",
          authorId: "author-1",
        }),
      );
      mockedPrisma.prescription.update.mockResolvedValueOnce({
        id: "prescription-1",
        artifactId,
        items: [],
        medications: [{ medication: "Amoxicillin" }],
        instructions: { text: "new" },
        notes: { text: "new note" },
        metadata: { source: "new" },
        createdAt: D1,
        updatedAt: D2,
      });
      mockClinicalRenderedDocumentPersistence({
        id: "doc-rx",
        kind: "PRESCRIPTION",
        title: "Prescription",
      });

      const result = await ClinicalArtifactService.updatePrescription(
        "prescription-1",
        {
          status: "IN_PROGRESS",
          instructions: { text: "new" },
          notes: { text: "new note" },
          metadata: { source: "new" },
        },
        organisationId,
        { actorId: "author-1", canEditAny: false },
      );

      expect(mockedPrisma.prescription.update).toHaveBeenCalledWith({
        where: { id: "prescription-1" },
        data: {
          items: undefined,
          instructions: { text: "new" },
          notes: { text: "new note" },
          metadata: { source: "new" },
        },
        include: { items: true },
      });
      expect(result.artifact.status).toBe("IN_PROGRESS");
      expect(result.prescription.medications).toEqual([
        { medication: "Amoxicillin" },
      ]);
      expect(
        InventoryConsumptionService.createPrescriptionDispenseRequest,
      ).not.toHaveBeenCalled();
      expect(
        InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ["already billed", { billingStatus: "BILLED", invoiceRowId: null }],
      [
        "attached to an invoice row",
        { billingStatus: "UNBILLED", invoiceRowId: "row-1" },
      ],
    ])(
      "refuses to delete a draft prescription that is %s",
      async (_label, treatmentItem) => {
        mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
          prescriptionRow({
            artifact: artifactRow({ kind: "PRESCRIPTION", status: "DRAFT" }),
          }),
        );
        mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValueOnce({
          id: "treatment-1",
          ...treatmentItem,
        });

        await expect(
          ClinicalArtifactService.deletePrescription(
            "prescription-1",
            organisationId,
            { actorId: "anyone", canEditAny: true },
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          message: "Prescription has already been billed.",
        });
        expect(
          mockedPrisma.workspaceTreatmentItem.deleteMany,
        ).not.toHaveBeenCalled();
        expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
      },
    );

    it("returns an already-void prescription from cancel without touching inventory", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        prescriptionRow({
          artifact: artifactRow({ kind: "PRESCRIPTION", status: "VOID" }),
        }),
      );

      const result = await ClinicalArtifactService.cancelPrescription(
        "prescription-1",
        organisationId,
        { actorId: "anyone", canEditAny: true },
      );

      expect(result.artifact.status).toBe("VOID");
      expect(
        mockedPrisma.workspaceTreatmentItem.findFirst,
      ).not.toHaveBeenCalled();
      expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
      expect(
        InventoryConsumptionService.voidDispensePrescription,
      ).not.toHaveBeenCalled();
    });

    it("refuses to cancel a prescription that was never finalized", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        prescriptionRow({
          artifact: artifactRow({ kind: "PRESCRIPTION", status: "DRAFT" }),
        }),
      );

      await expect(
        ClinicalArtifactService.cancelPrescription(
          "prescription-1",
          organisationId,
          { actorId: "anyone", canEditAny: true },
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Only finalized prescriptions can be cancelled.",
      });
      expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
    });

    it.each([
      ["a missing prescription", null],
      [
        "a voided prescription on a normal read",
        () =>
          prescriptionRow({
            artifact: artifactRow({ kind: "PRESCRIPTION", status: "VOID" }),
          }),
      ],
    ])("reports %s as 404", async (_label, row) => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        typeof row === "function" ? row() : row,
      );

      await expect(
        ClinicalArtifactService.getPrescription(
          "prescription-1",
          organisationId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Prescription not found",
      });
    });

    it("rejects an artifact that is not a prescription", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        prescriptionRow({ artifact: artifactRow({ kind: "SOAP_NOTE" }) }),
      );

      await expect(
        ClinicalArtifactService.getPrescription(
          "prescription-1",
          organisationId,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Artifact is not a prescription",
      });
    });

    it("skips the ownership pre-check on amend when the caller holds org-wide edit", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValue(
        prescriptionRow({
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            status: "COMPLETED",
            authorId: null,
            appointmentId: "appt-1",
            caseId: "case-1",
            encounterId: "enc-1",
            templateId: "tmpl-1",
            templateVersion: 3,
            templateVersionId: "tmpl-ver-1",
            summary: "Rx",
          }),
          medications: [{ medication: "Amoxicillin", quantity: 2 }],
          instructions: { text: "Take daily" },
          notes: { text: "n" },
          metadata: { source: "workspace" },
        }),
      );
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({
          id: "artifact-amend",
          kind: "PRESCRIPTION",
          appointmentId: "appt-1",
        }),
      );
      mockedPrisma.prescription.create.mockResolvedValueOnce({
        id: "prescription-amend",
        artifactId: "artifact-amend",
        items: [],
        medications: null,
        instructions: { text: "Take daily" },
        notes: { text: "n" },
        metadata: { source: "workspace" },
        createdAt: D2,
        updatedAt: D2,
      });
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-rx",
        kind: "PRESCRIPTION",
        title: "Prescription",
        sourceId: "artifact-amend",
      });

      const amended = await ClinicalArtifactService.amendPrescription(
        "prescription-1",
        organisationId,
        { actorId: "supervisor", canEditAny: true },
      );

      // the ownership pre-check is skipped, so the record is loaded once by the read
      expect(mockedPrisma.prescription.findFirst).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith({
        data: {
          organisationId,
          appointmentId: "appt-1",
          caseId: "case-1",
          encounterId: "enc-1",
          kind: "PRESCRIPTION",
          status: "DRAFT",
          templateId: "tmpl-1",
          templateVersion: 3,
          templateVersionId: "tmpl-ver-1",
          // The amendment is a new draft authored by whoever amended it - the
          // duplication helper copies the SOURCE artifact's authorId, so without
          // this override a colleague's name went out on a record they did not
          // write.
          authorId: "supervisor",
          summary: "Rx",
        },
      });
      expect(mockedPrisma.prescription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            artifactId: "artifact-amend",
            instructions: { text: "Take daily" },
          }),
        }),
      );
      expect(amended.prescription.id).toBe("prescription-amend");
      expect(
        InventoryConsumptionService.createPrescriptionDispenseRequest,
      ).not.toHaveBeenCalled();
    });

    it("re-reads the prescription for the ownership pre-check when the caller only holds own-scope edit", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValue(
        prescriptionRow({
          artifact: artifactRow({
            kind: "PRESCRIPTION",
            status: "COMPLETED",
            authorId: "author-1",
          }),
        }),
      );
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({ id: "artifact-amend", kind: "PRESCRIPTION" }),
      );
      mockedPrisma.prescription.create.mockResolvedValueOnce({
        id: "prescription-amend",
        artifactId: "artifact-amend",
        items: [],
        medications: null,
        instructions: null,
        notes: null,
        metadata: null,
        createdAt: D2,
        updatedAt: D2,
      });
      mockClinicalRenderedDocumentPersistence({
        id: "doc-amend-rx",
        kind: "PRESCRIPTION",
        title: "Prescription",
        sourceId: "artifact-amend",
      });

      await ClinicalArtifactService.amendPrescription(
        "prescription-1",
        organisationId,
        { actorId: "author-1", canEditAny: false },
      );

      expect(mockedPrisma.prescription.findFirst).toHaveBeenCalledTimes(2);
      expect(mockedPrisma.clinicalArtifact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId: "author-1",
            status: "DRAFT",
          }),
        }),
      );
    });

    it("normalizes loosely shaped medication lines into prescription item rows", async () => {
      mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
        artifactRow({ kind: "PRESCRIPTION" }),
      );
      mockedPrisma.prescription.create.mockResolvedValueOnce({
        id: "prescription-1",
        artifactId,
        items: [],
        medications: null,
        instructions: null,
        notes: null,
        metadata: null,
        createdAt: D1,
        updatedAt: D1,
      });
      mockClinicalRenderedDocumentPersistence({
        id: "doc-rx",
        kind: "PRESCRIPTION",
        title: "Prescription",
      });

      await ClinicalArtifactService.createPrescription({
        organisationId,
        medications: [
          {
            id: "line-1",
            medicineName: "Amoxicillin",
            doseStrength: "500mg",
            dose: "1 tab",
            routeOfAdministration: "PO",
            freq: "BID",
            durationDays: "7",
            refill: "1",
            qty: "3",
            sig: "with food",
            inventoryItemId: "inv-1",
            sku: "SKU-1",
            inventoryBatchId: "batch-1",
            batchNumber: "B1",
            lotNumber: "L1",
            expiryDate: "2027-05-01T00:00:00.000Z",
            metadata: { origin: "catalog" },
          },
          {
            medication: "   ",
            name: "Ivermectin",
            units: 0,
            count: -2,
            dispenseQuantity: 2.9,
            expiryDate: "not-a-date",
          },
          { medication: 5, drug: "Meloxicam", quantity: "abc", qty: "0" },
          {
            product: "Carprofen",
            quantity: 4.7,
            expiryDate: new Date("2027-06-01T00:00:00.000Z"),
          },
          "PlainString",
          null,
        ],
      });

      const [createArgs] = mockedPrisma.prescription.create.mock.calls[0] as [
        { data: { items: { create: unknown[] } } },
      ];
      expect(createArgs.data.items.create).toEqual([
        {
          sourceLineKey: "line-1",
          medication: "Amoxicillin",
          strength: "500mg",
          dosage: "1 tab",
          route: "PO",
          frequency: "BID",
          duration: "7",
          quantity: "3",
          instructions: "with food",
          refill: "1",
          inventoryItemId: "inv-1",
          inventoryItemSku: "SKU-1",
          batchId: "batch-1",
          batchNumber: "B1",
          lotNumber: "L1",
          expiryDate: new Date("2027-05-01T00:00:00.000Z"),
          metadata: { origin: "catalog" },
          sortOrder: 0,
        },
        { medication: "Ivermectin", quantity: "2", sortOrder: 1 },
        { medication: "Meloxicam", sortOrder: 2 },
        {
          medication: "Carprofen",
          quantity: "4",
          expiryDate: new Date("2027-06-01T00:00:00.000Z"),
          sortOrder: 3,
        },
        { medication: "PlainString", sortOrder: 4 },
        { medication: "", sortOrder: 5 },
      ]);
    });
  });
});

describe("hydrateMedications", () => {
  const inventory = new Map([
    [
      "item-1",
      {
        id: "item-1",
        name: "Amoxicillin 500mg",
        genericName: "Amoxicillin",
        strength: "500mg",
        dosageForm: "Capsule",
        controlledItem: true,
      },
    ],
  ]);

  it("fills missing medication fields from the inventory item", () => {
    const result = hydrateMedications(
      [
        {
          inventoryItemId: "item-1",
          quantity: 2,
          medication: "",
          strength: null,
        },
      ],
      inventory,
    ) as Array<Record<string, unknown>>;

    expect(result[0].medication).toBe("Amoxicillin 500mg");
    expect(result[0].strength).toBe("500mg");
    expect(result[0].genericName).toBe("Amoxicillin");
    expect(result[0].dosageForm).toBe("Capsule");
    expect(result[0].controlledItem).toBe(true);
    expect(result[0].quantity).toBe(2);
  });

  it("keeps existing fields and ignores unmatched / non-record items", () => {
    const result = hydrateMedications(
      [
        { inventoryItemId: "item-1", medication: "Custom name" },
        { inventoryItemId: "missing", medication: "Kept" },
        "not-a-record",
      ],
      inventory,
    ) as unknown[];

    expect((result[0] as Record<string, unknown>).medication).toBe(
      "Custom name",
    );
    expect((result[1] as Record<string, unknown>).medication).toBe("Kept");
    expect(result[2]).toBe("not-a-record");
  });

  it("returns non-array medications unchanged", () => {
    expect(hydrateMedications(null, inventory)).toBeNull();
    expect(hydrateMedications({ a: 1 } as never, inventory)).toEqual({ a: 1 });
  });

  it("leaves a medication carrying no inventory reference untouched", () => {
    const result = hydrateMedications(
      [{ medication: "Compounded cream", quantity: 1 }],
      inventory,
    ) as Array<Record<string, unknown>>;

    expect(result[0]).toEqual({ medication: "Compounded cream", quantity: 1 });
  });

  it("omits catalogue fields the inventory item does not carry and honours an explicit controlled flag", () => {
    const sparseInventory = new Map([
      [
        "item-2",
        {
          id: "item-2",
          name: "Saline flush",
          genericName: null,
          strength: null,
          dosageForm: null,
          controlledItem: true,
        },
      ],
    ]);

    const result = hydrateMedications(
      [{ inventoryItemId: "item-2", controlledItem: false }],
      sparseInventory,
    ) as Array<Record<string, unknown>>;

    expect(result[0]).toEqual({
      inventoryItemId: "item-2",
      medication: "Saline flush",
      strength: undefined,
      genericName: undefined,
      dosageForm: undefined,
      controlledItem: false,
    });
  });
});

describe("ClinicalArtifactService.listPrescriptionsForEncounter hydration", () => {
  const mocked = prisma as unknown as {
    prescription: { findMany: jest.Mock };
    inventoryItem: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates prescription medications from inventory on read", async () => {
    mocked.prescription.findMany.mockResolvedValue([
      {
        id: "prescription-1",
        artifactId: "artifact-1",
        items: [],
        medications: [{ inventoryItemId: "item-1", quantity: 2 }],
        instructions: null,
        notes: null,
        metadata: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        artifact: {
          id: "artifact-1",
          organisationId: "org-1",
          encounterId: "enc-1",
          kind: "PRESCRIPTION",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    ]);
    mocked.inventoryItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Amoxicillin 500mg",
        genericName: "Amoxicillin",
        strength: "500mg",
        dosageForm: "Capsule",
        controlledItem: false,
      },
    ]);

    const records = await ClinicalArtifactService.listPrescriptionsForEncounter(
      "org-1",
      "enc-1",
    );

    const meds = records[0].prescription.medications as Array<
      Record<string, unknown>
    >;
    expect(meds[0].medication).toBe("Amoxicillin 500mg");
    // Scoped to the prescribing organisation: `inventoryItemId` reaches the
    // medication JSON from a client FHIR extension, so an unscoped lookup
    // hydrated another tenant's item name, strength and controlled flag.
    expect(mocked.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["item-1"] },
          organisationId: { in: ["org-1"] },
        },
      }),
    );
  });

  describe("passport clinical-record FHIR reads", () => {
    const mockedReads = prisma as unknown as {
      immunization: { findMany: jest.Mock };
      rabiesTitration: { findMany: jest.Mock };
      parasiteTreatment: { findMany: jest.Mock };
      clinicalExamination: { findMany: jest.Mock };
    };
    beforeEach(() => {
      jest.clearAllMocks();
    });
    const when = new Date("2026-01-01T00:00:00.000Z");
    const artifactRow = {
      id: "art-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: "enc-1",
      kind: "IMMUNIZATION",
      status: "SIGNED",
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: "vet-1",
      signedBy: "vet-1",
      signedAt: when,
      summary: null,
      createdAt: when,
      updatedAt: when,
    };

    it("lists immunizations by encounter and appointment", async () => {
      mockedReads.immunization.findMany.mockResolvedValue([
        {
          id: "imm-1",
          artifactId: "art-1",
          vaccineType: "RABIES",
          vaccineName: "Nobivac",
          manufacturer: null,
          batchNumber: null,
          lotNumber: null,
          dateAdministered: when,
          validFrom: null,
          validUntil: null,
          nextDueDate: null,
          site: null,
          route: null,
          notes: null,
          metadata: null,
          createdAt: when,
          updatedAt: when,
          artifact: artifactRow,
        },
      ]);

      const byEncounter =
        await ClinicalArtifactService.listImmunizationsForEncounter(
          "org-1",
          "enc-1",
        );
      expect(byEncounter[0].artifact.kind).toBe("IMMUNIZATION");
      expect(byEncounter[0].immunization.vaccineName).toBe("Nobivac");
      expect(mockedReads.immunization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            artifact: expect.objectContaining({
              encounterId: "enc-1",
              kind: "IMMUNIZATION",
            }),
          },
        }),
      );

      await ClinicalArtifactService.listImmunizationsForAppointment(
        "org-1",
        "appt-1",
      );
      expect(mockedReads.immunization.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            artifact: expect.objectContaining({
              appointmentId: "appt-1",
              kind: "IMMUNIZATION",
            }),
          },
        }),
      );
    });

    it("lists rabies titrations by encounter and appointment", async () => {
      mockedReads.rabiesTitration.findMany.mockResolvedValue([
        {
          id: "tit-1",
          artifactId: "art-1",
          approvedLab: "APHA",
          sampleDate: when,
          resultIuMl: 1.5,
          reportUrl: null,
          metadata: null,
          createdAt: when,
          updatedAt: when,
          artifact: artifactRow,
        },
      ]);

      const byEncounter =
        await ClinicalArtifactService.listRabiesTitrationsForEncounter(
          "org-1",
          "enc-1",
        );
      expect(byEncounter[0].artifact.kind).toBe("RABIES_TITRATION");
      expect(byEncounter[0].rabiesTitration.resultIuMl).toBe(1.5);

      await ClinicalArtifactService.listRabiesTitrationsForAppointment(
        "org-1",
        "appt-1",
      );
      expect(mockedReads.rabiesTitration.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            artifact: expect.objectContaining({
              appointmentId: "appt-1",
              kind: "RABIES_TITRATION",
            }),
          },
        }),
      );
    });

    it("lists parasite treatments by encounter and appointment", async () => {
      mockedReads.parasiteTreatment.findMany.mockResolvedValue([
        {
          id: "par-1",
          artifactId: "art-1",
          treatmentType: "FLEA",
          productName: "Bravecto",
          manufacturer: null,
          treatedAt: when,
          notes: null,
          metadata: null,
          createdAt: when,
          updatedAt: when,
          artifact: artifactRow,
        },
      ]);

      const byEncounter =
        await ClinicalArtifactService.listParasiteTreatmentsForEncounter(
          "org-1",
          "enc-1",
        );
      expect(byEncounter[0].artifact.kind).toBe("PARASITE_TREATMENT");
      expect(byEncounter[0].parasiteTreatment.productName).toBe("Bravecto");

      await ClinicalArtifactService.listParasiteTreatmentsForAppointment(
        "org-1",
        "appt-1",
      );
      expect(mockedReads.parasiteTreatment.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            artifact: expect.objectContaining({
              appointmentId: "appt-1",
              kind: "PARASITE_TREATMENT",
            }),
          },
        }),
      );
    });

    it("lists clinical examinations by encounter and appointment", async () => {
      mockedReads.clinicalExamination.findMany.mockResolvedValue([
        {
          id: "exam-1",
          artifactId: "art-1",
          examinedAt: when,
          fitForTravel: true,
          findings: null,
          weightKg: null,
          temperatureC: null,
          metadata: null,
          createdAt: when,
          updatedAt: when,
          artifact: artifactRow,
        },
      ]);

      const byEncounter =
        await ClinicalArtifactService.listClinicalExaminationsForEncounter(
          "org-1",
          "enc-1",
        );
      expect(byEncounter[0].artifact.kind).toBe("CLINICAL_EXAM");
      expect(byEncounter[0].clinicalExamination.fitForTravel).toBe(true);

      await ClinicalArtifactService.listClinicalExaminationsForAppointment(
        "org-1",
        "appt-1",
      );
      expect(mockedReads.clinicalExamination.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            artifact: expect.objectContaining({
              appointmentId: "appt-1",
              kind: "CLINICAL_EXAM",
            }),
          },
        }),
      );
    });
  });

  it("falls back to medications per record, not just for the first record", async () => {
    const artifact = {
      id: "artifact-1",
      organisationId: "org-1",
      encounterId: "enc-1",
      kind: "PRESCRIPTION",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const base = {
      artifactId: "artifact-1",
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifact,
    };
    mocked.prescription.findMany.mockResolvedValue([
      {
        ...base,
        id: "prescription-1",
        items: [{ inventoryItemId: "item-1", quantity: 1 }],
        medications: null,
      },
      {
        ...base,
        id: "prescription-2",
        items: [],
        medications: [{ inventoryItemId: "item-2", quantity: 2 }],
      },
    ]);
    mocked.inventoryItem.findMany.mockResolvedValue([]);

    await ClinicalArtifactService.listPrescriptionsForEncounter(
      "org-1",
      "enc-1",
    );

    // The second record contributes item-2 even though the first already put
    // item-1 into the shared set.
    expect(mocked.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["item-1", "item-2"] },
          organisationId: { in: ["org-1"] },
        },
      }),
    );
  });

  it("filters voided prescriptions out of the encounter list query", async () => {
    mocked.prescription.findMany.mockResolvedValue([]);
    mocked.inventoryItem.findMany.mockResolvedValue([]);

    await ClinicalArtifactService.listPrescriptionsForEncounter(
      "org-1",
      "enc-1",
    );

    expect(mocked.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          artifact: expect.objectContaining({ status: { not: "VOID" } }),
        }),
      }),
    );
  });
});

describe("prescription actor authorization", () => {
  const prescriptionRow = (authorId: string | null) => ({
    id: "rx_1",
    artifactId: "artifact_1",
    artifact: {
      id: "artifact_1",
      kind: "PRESCRIPTION",
      organisationId: "org_1",
      authorId,
    },
    items: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a caller without org-wide edit authority who did not author the prescription", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue(
      prescriptionRow("vet_author") as never,
    );

    await expect(
      ClinicalArtifactService.finalizePrescription("rx_1", "org_1", {
        actorId: "vet_other",
        canEditAny: false,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Prescription was authored by another user",
    });

    expect(prisma.prescription.update).not.toHaveBeenCalled();
  });

  it("rejects an unidentified caller even when the prescription has no author", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue(
      prescriptionRow(null) as never,
    );

    await expect(
      ClinicalArtifactService.reopenPrescription("rx_1", "org_1", {
        actorId: "",
        canEditAny: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects an own-scope caller targeting a prescription in another organisation", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockResolvedValue(
      prescriptionRow("vet_author") as never,
    );

    await expect(
      ClinicalArtifactService.amendPrescription("rx_1", "org_other", {
        actorId: "vet_author",
        canEditAny: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not load the prescription for the ownership check when the caller holds org-wide edit authority", async () => {
    (prisma.prescription.findFirst as jest.Mock).mockRejectedValue(
      new Error("ownership check should be skipped") as never,
    );

    await expect(
      ClinicalArtifactService.finalizePrescription("rx_1", "org_1", {
        actorId: "supervisor_1",
        canEditAny: true,
      }),
    ).rejects.not.toMatchObject({
      message: "Prescription was authored by another user",
    });
  });
});

describe("prescription mutation ownership", () => {
  const prescriptionRow = (authorId: string | null) => ({
    id: "rx_1",
    artifactId: "artifact_1",
    artifact: {
      id: "artifact_1",
      kind: "PRESCRIPTION",
      organisationId: "org_1",
      authorId,
      status: "DRAFT",
    },
    items: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [
      "updatePrescription",
      () =>
        ClinicalArtifactService.updatePrescription(
          "rx_1",
          { summary: "x" },
          "org_1",
          { actorId: "other_vet", canEditAny: false },
        ),
    ],
    [
      "deletePrescription",
      () =>
        ClinicalArtifactService.deletePrescription("rx_1", "org_1", {
          actorId: "other_vet",
          canEditAny: false,
        }),
    ],
    [
      "cancelPrescription",
      () =>
        ClinicalArtifactService.cancelPrescription("rx_1", "org_1", {
          actorId: "other_vet",
          canEditAny: false,
        }),
    ],
  ])(
    "%s refuses an own-scope caller who did not author the prescription",
    async (_name, call) => {
      (prisma.prescription.findFirst as jest.Mock).mockResolvedValue(
        prescriptionRow("author_vet") as never,
      );

      await expect(call()).rejects.toMatchObject({
        statusCode: 403,
        message: "Prescription was authored by another user",
      });

      expect(prisma.prescription.update).not.toHaveBeenCalled();
    },
  );
});
