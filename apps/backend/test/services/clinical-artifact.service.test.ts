import { prisma } from "src/config/prisma";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
  hydrateMedications,
} from "../../src/services/clinical-artifact.service";
import { renderRenderedDocumentPdfWithMetadata } from "../../src/services/rendered-document-renderer.service";
import { uploadBufferAsFile } from "../../src/middlewares/upload";

jest.mock("../../src/services/inventory-consumption.service", () => ({
  InventoryConsumptionService: {
    approvePrescriptionDispenseRequest: jest.fn(),
    createPrescriptionDispenseRequest: jest.fn(),
    markPrescriptionDispenseRequestNotDispensed: jest.fn(),
    releasePrescription: jest.fn(),
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
    dischargeSummary: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    vitalRecord: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
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
    dischargeSummary: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
    };
    vitalRecord: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
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
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValueOnce({
      id: "treatment-item-1",
      billingStatus: "UNBILLED",
      invoiceRowId: null,
    });
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
    );

    expect(mockedPrisma.workspaceTreatmentItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId,
          prescriptionId: "prescription-1",
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
      ClinicalArtifactService.deletePrescription(artifactId, organisationId),
    ).rejects.toMatchObject({ statusCode: 409 });
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
    expect(mocked.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["item-1"] } } }),
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
