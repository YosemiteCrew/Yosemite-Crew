import { ClinicalArtifactKind, TemplateKind } from "@prisma/client";
import axios from "axios";
import { prisma } from "src/config/prisma";
import {
  buildDocumentSignature,
  buildRenderedDocumentPdfSnapshot,
  buildRenderedDocumentDraft,
  createRenderedDocumentRecord,
  getPersistedRenderedDocument,
  getPersistedRenderedDocumentPdf,
  isSignableRenderedDocumentKind,
  RenderedDocumentServiceError,
  completePersistedRenderedDocumentSigning,
  rerenderPersistedClinicalRenderedDocumentPdf,
  signPersistedRenderedDocument,
  signRenderedDocument,
} from "../../src/services/rendered-document.service";
import { DocumensoService } from "../../src/services/documenso.service";
import { renderRenderedDocumentPdfWithMetadata } from "../../src/services/rendered-document-renderer.service";
import { uploadBufferAsFile } from "../../src/middlewares/upload";

jest.mock("src/config/prisma", () => ({
  prisma: {
    renderedDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    documentSignature: {
      create: jest.fn(),
    },
  },
}));
jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));
jest.mock("../../src/services/rendered-document-renderer.service", () => ({
  renderRenderedDocumentPdfWithMetadata: jest.fn(),
}));
jest.mock("../../src/middlewares/upload", () => ({
  uploadBufferAsFile: jest.fn(),
}));
jest.mock("axios", () => ({
  get: jest.fn(),
}));

describe("rendered-document service", () => {
  const originalDocumensoHostUrl = process.env.DOCUMENSO_HOST_URL;
  const mockedPrisma = prisma as unknown as {
    renderedDocument: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    documentSignature: {
      create: jest.Mock;
    };
  };
  const mockedDocumensoService = DocumensoService as unknown as {
    resolveOrganisationApiKey: jest.Mock;
    createDocument: jest.Mock;
    distributeDocument: jest.Mock;
    downloadSignedDocument: jest.Mock;
  };
  const mockedRenderedDocumentRenderer =
    renderRenderedDocumentPdfWithMetadata as jest.Mock;
  const mockedUploadBufferAsFile = uploadBufferAsFile as jest.Mock;
  const mockedAxiosGet = axios.get as jest.Mock;

  beforeEach(() => {
    process.env.DOCUMENSO_HOST_URL = "https://documenso.example";
  });

  afterAll(() => {
    if (originalDocumensoHostUrl === undefined) {
      delete process.env.DOCUMENSO_HOST_URL;
      return;
    }

    process.env.DOCUMENSO_HOST_URL = originalDocumensoHostUrl;
  });

  const buildTemplateSource = (overrides = {}) => ({
    sourceKind: "TEMPLATE_INSTANCE" as const,
    sourceId: "instance-123",
    organisationId: "org-123",
    templateKind: TemplateKind.FORM,
    templateId: "template-123",
    templateVersion: 3,
    ...overrides,
  });

  it("marks clinical and form document kinds as signable and task kinds as non-signable", () => {
    expect(isSignableRenderedDocumentKind("FORM")).toBe(true);
    expect(isSignableRenderedDocumentKind("CONSENT")).toBe(true);
    expect(isSignableRenderedDocumentKind("SOAP_NOTE")).toBe(true);
    expect(isSignableRenderedDocumentKind("PRESCRIPTION")).toBe(true);
    expect(isSignableRenderedDocumentKind("DISCHARGE_SUMMARY")).toBe(true);
    expect(isSignableRenderedDocumentKind("VITAL_RECORD")).toBe(true);
    expect(isSignableRenderedDocumentKind("TASK_ASSIGNMENT")).toBe(false);
    expect(isSignableRenderedDocumentKind("INPATIENT_SCHEDULE")).toBe(false);
  });

  it("builds a rendered document draft from a template source", () => {
    const draft = buildRenderedDocumentDraft({
      title: "  Intake Consent  ",
      source: buildTemplateSource(),
    });

    expect(draft.title).toBe("Intake Consent");
    expect(draft.kind).toBe("FORM");
    expect(draft.signable).toBe(true);
    expect(draft.status).toBe("DRAFT");
    expect(draft.mimeType).toBe("application/pdf");
    expect(draft.source.organisationId).toBe("org-123");
    expect(draft.source.sourceId).toBe("instance-123");
    expect(draft.source.templateKind).toBe(TemplateKind.FORM);
    expect(draft.version).toBe(1);
    expect(draft.signature).toBeNull();
    expect(draft.pdf).toBeNull();
  });

  it("builds a rendered document pdf snapshot", () => {
    const draft = buildRenderedDocumentDraft({
      title: "Intake Consent",
      source: buildTemplateSource(),
    });

    const snapshot = buildRenderedDocumentPdfSnapshot(
      draft,
      new Date("2026-06-13T12:00:00.000Z"),
    );

    expect(snapshot).toEqual({
      version: 1,
      renderer: "rendered-document-renderer.service",
      renderedAt: "2026-06-13T12:00:00.000Z",
      title: "Intake Consent",
      mimeType: "application/pdf",
      documentKind: "FORM",
      source: draft.source,
    });
  });

  it("preserves non-signable task kinds in the draft contract", () => {
    const draft = buildRenderedDocumentDraft({
      title: "Task bundle",
      source: buildTemplateSource({
        templateKind: "TASK_ASSIGNMENT",
      }),
    });

    expect(draft.kind).toBe("TASK_ASSIGNMENT");
    expect(draft.signable).toBe(false);
  });

  it("builds a signature payload with normalization", () => {
    const signature = buildDocumentSignature("  doc-1  ", {
      signerId: "  user-1 ",
      signerType: "PMS_USER",
      signatureText: "  Dr. Jane Doe  ",
      signedAt: new Date("2026-06-13T00:00:00.000Z"),
    });

    expect(signature.documentId).toBe("doc-1");
    expect(signature.signerId).toBe("user-1");
    expect(signature.signatureText).toBe("Dr. Jane Doe");
    expect(signature.signedAt.toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });

  it("treats missing signature text as null", () => {
    const signature = buildDocumentSignature("doc-1", {
      signerId: "user-1",
      signerType: "PARENT",
    });

    expect(signature.signatureText).toBeNull();
  });

  it("rejects blank title, organisation, source and signature text values", () => {
    expect(() =>
      buildRenderedDocumentDraft({
        title: "   ",
        source: buildTemplateSource(),
      }),
    ).toThrow(RenderedDocumentServiceError);

    expect(() =>
      buildRenderedDocumentDraft({
        title: "Draft",
        source: buildTemplateSource({ organisationId: "   " }),
      }),
    ).toThrow("Invalid organisationId");

    expect(() =>
      buildRenderedDocumentDraft({
        title: "Draft",
        source: buildTemplateSource({ sourceId: "   " }),
      }),
    ).toThrow("Invalid sourceId");

    expect(() =>
      buildDocumentSignature("doc-1", {
        signerId: "user-1",
        signerType: "SYSTEM",
        signatureText: "   ",
      }),
    ).toThrow("Invalid signatureText");
  });

  it("signs a draft document and carries the signature metadata", () => {
    const draft = buildRenderedDocumentDraft({
      title: "SOAP note",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-1",
        organisationId: "org-1",
        templateKind: ClinicalArtifactKind.SOAP_NOTE,
        templateVersionId: "template-version-1",
      },
    });

    const signed = signRenderedDocument(draft, {
      signerId: "vet-1",
      signerType: "PMS_USER",
      signedAt: new Date("2026-06-13T10:00:00.000Z"),
      signatureText: "Approved",
    });

    expect(signed.status).toBe("SIGNED");
    expect(signed.signedBy).toBe("vet-1");
    expect(signed.signedAt?.toISOString()).toBe("2026-06-13T10:00:00.000Z");
    expect(signed.signature?.signerId).toBe("vet-1");
    expect(signed.signature?.documentId).toBe(draft.id);
  });

  it("rejects signing unsupported or already signed documents", () => {
    const nonSignable = buildRenderedDocumentDraft({
      title: "Care pathway",
      source: buildTemplateSource({
        templateKind: "INPATIENT_SCHEDULE",
      }),
    });

    expect(() =>
      signRenderedDocument(nonSignable, {
        signerId: "user-1",
        signerType: "SYSTEM",
      }),
    ).toThrow("Document kind is not signable");

    const signed = signRenderedDocument(
      buildRenderedDocumentDraft({
        title: "SOAP note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "artifact-2",
          organisationId: "org-1",
          templateKind: ClinicalArtifactKind.SOAP_NOTE,
        },
      }),
      {
        signerId: "user-1",
        signerType: "SYSTEM",
      },
    );

    expect(() =>
      signRenderedDocument(signed, {
        signerId: "user-2",
        signerType: "SYSTEM",
      }),
    ).toThrow("Document is already signed");
  });

  it("persists a rendered document draft", async () => {
    mockedPrisma.renderedDocument.create.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-06-13T00:00:00.000Z",
        title: "Intake Consent",
        mimeType: "application/pdf",
        documentKind: "FORM",
        source: buildTemplateSource(),
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    const result = await createRenderedDocumentRecord({
      title: "Intake Consent",
      source: buildTemplateSource(),
      templateInstanceId: "instance-123",
    });

    expect(mockedPrisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: "instance-123",
          templateInstanceId: "instance-123",
          title: "Intake Consent",
          kind: "FORM",
          signable: true,
          pdf: expect.objectContaining({
            renderer: "rendered-document-renderer.service",
            documentKind: "FORM",
            title: "Intake Consent",
          }),
        }),
        include: { signature: true },
      }),
    );
    expect(result.id).toBe("doc-1");
  });

  it("loads a persisted rendered document and enforces organisation scope", async () => {
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-2",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    const result = await getPersistedRenderedDocument("doc-2", "org-123");

    expect(mockedPrisma.renderedDocument.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-2" },
        include: { signature: true },
      }),
    );
    expect(result.id).toBe("doc-2");

    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-2",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    await expect(
      getPersistedRenderedDocument("doc-2", "org-456"),
    ).rejects.toThrow("Rendered document does not belong to organisation");
  });

  it("builds a persisted rendered document pdf", async () => {
    mockedRenderedDocumentRenderer.mockResolvedValueOnce({
      pdf: Buffer.from("pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-2",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: "template-version-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP Note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    const result = await getPersistedRenderedDocumentPdf("doc-2", "org-123");

    expect(mockedRenderedDocumentRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "SOAP Note",
        source: expect.objectContaining({
          sourceId: "instance-123",
          organisationId: "org-123",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        contentType: "application/pdf",
        filename: "soap-note-doc-2.pdf",
        pdf: Buffer.from("pdf"),
      }),
    );
  });

  it("uses the stored pdfUrl for clinical documents", async () => {
    mockedRenderedDocumentRenderer.mockClear();
    mockedAxiosGet.mockClear();
    mockedAxiosGet.mockResolvedValueOnce({
      data: Buffer.from("stored-pdf"),
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-3",
      organisationId: "org-123",
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: "artifact-123",
      templateInstanceId: null,
      clinicalArtifactId: "artifact-123",
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: "template-version-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP Note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/stored.pdf",
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-06-13T00:00:00.000Z",
        title: "SOAP Note",
        mimeType: "application/pdf",
        documentKind: "SOAP_NOTE",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "artifact-123",
          organisationId: "org-123",
          templateKind: "SOAP_NOTE",
          templateId: "template-123",
          templateVersion: 3,
          templateVersionId: "template-version-1",
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    const result = await getPersistedRenderedDocumentPdf("doc-3", "org-123");

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      "https://cdn.example/stored.pdf",
      expect.objectContaining({
        responseType: "arraybuffer",
      }),
    );
    expect(mockedRenderedDocumentRenderer).not.toHaveBeenCalled();
    expect(result.pdf).toEqual(Buffer.from("stored-pdf"));
  });

  it("rerenders and persists a clinical rendered document", async () => {
    mockedRenderedDocumentRenderer.mockResolvedValueOnce({
      pdf: Buffer.from("rerendered-pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedUploadBufferAsFile.mockResolvedValueOnce({
      url: "https://cdn.example/rerendered.pdf",
      key: "rendered-documents/org-123/doc-4.pdf",
      originalname: "soap-note-doc-4.pdf",
      mimetype: "application/pdf",
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-4",
      organisationId: "org-123",
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: "artifact-4",
      templateInstanceId: null,
      clinicalArtifactId: "artifact-4",
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: "template-version-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP Note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-4",
      organisationId: "org-123",
      sourceKind: "CLINICAL_ARTIFACT",
      sourceId: "artifact-4",
      templateInstanceId: null,
      clinicalArtifactId: "artifact-4",
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: "template-version-1",
      kind: "SOAP_NOTE",
      version: 1,
      title: "SOAP Note",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: "https://cdn.example/rerendered.pdf",
      pdf: {
        version: 1,
        renderer: "rendered-document-renderer.service",
        renderedAt: "2026-06-13T00:00:00.000Z",
        title: "SOAP Note",
        mimeType: "application/pdf",
        documentKind: "SOAP_NOTE",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "artifact-4",
          organisationId: "org-123",
          templateKind: "SOAP_NOTE",
          templateId: "template-123",
          templateVersion: 3,
          templateVersionId: "template-version-1",
        },
        signaturePlacement: {
          pageNumber: 1,
          pageX: 340,
          pageY: 710,
          width: 220,
          height: 96,
        },
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });

    const result = await rerenderPersistedClinicalRenderedDocumentPdf(
      "doc-4",
      "org-123",
    );

    expect(mockedRenderedDocumentRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "SOAP Note",
        source: expect.objectContaining({
          sourceId: "artifact-4",
          organisationId: "org-123",
        }),
      }),
    );
    expect(mockedUploadBufferAsFile).toHaveBeenCalledWith(
      Buffer.from("rerendered-pdf"),
      expect.objectContaining({
        folderName: "rendered-documents/org-123",
        mimeType: "application/pdf",
      }),
    );
    expect(mockedPrisma.renderedDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-4" },
        data: expect.objectContaining({
          pdfUrl: "https://cdn.example/rerendered.pdf",
        }),
      }),
    );
    expect(result.pdf).toEqual(Buffer.from("rerendered-pdf"));
  });

  it("persists a rendered document signature and updates the document", async () => {
    mockedRenderedDocumentRenderer.mockResolvedValueOnce({
      pdf: Buffer.from("pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValueOnce(
      "api-key-1",
    );
    mockedDocumensoService.createDocument.mockResolvedValueOnce({
      id: 42,
      recipients: [{ token: "token-123" }],
    });
    mockedDocumensoService.distributeDocument.mockResolvedValueOnce({
      success: true,
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: null,
      signedAt: null,
      signing: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "SIGNED",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signedBy: "user-1",
      signedAt: new Date("2026-06-13T11:00:00.000Z"),
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "IN_PROGRESS",
        documentId: "42",
        signerId: "user-1",
        signerEmail: "user@example.com",
        signerName: "User One",
        signingUrl: "https://documenso.example/sign/token-123",
      },
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T11:00:00.000Z"),
      signature: null,
    });

    const result = await signPersistedRenderedDocument({
      renderedDocumentId: "doc-1",
      signerId: "user-1",
      signerType: "PMS_USER",
      signerEmail: "user@example.com",
      signerName: "User One",
      signatureText: "Signed",
      signedAt: new Date("2026-06-13T11:00:00.000Z"),
    });

    expect(
      mockedDocumensoService.resolveOrganisationApiKey,
    ).toHaveBeenCalledWith("org-123");
    expect(mockedRenderedDocumentRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake Consent",
        source: expect.objectContaining({
          sourceId: "instance-123",
          organisationId: "org-123",
        }),
      }),
    );
    expect(mockedDocumensoService.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        signerEmail: "user@example.com",
        signerName: "User One",
        apiKey: "api-key-1",
        signaturePlacement: expect.objectContaining({
          pageNumber: 1,
          pageX: 340,
          pageY: 710,
        }),
      }),
    );
    expect(mockedDocumensoService.distributeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 42, apiKey: "api-key-1" }),
    );
    expect(mockedPrisma.renderedDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({
          pdf: expect.objectContaining({
            renderer: "rendered-document-renderer.service",
            title: "Intake Consent",
            documentKind: "FORM",
          }),
          signing: expect.objectContaining({
            status: "IN_PROGRESS",
            documentId: "42",
            signingUrl: "https://documenso.example/sign/token-123",
          }),
        }),
      }),
    );
    expect(result.signing).toEqual(
      expect.objectContaining({
        status: "IN_PROGRESS",
        documentId: "42",
      }),
    );
  });

  it("throws when signing a missing persisted rendered document", async () => {
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce(null);

    await expect(
      signPersistedRenderedDocument({
        renderedDocumentId: "missing-doc",
        signerId: "user-1",
        signerType: "SYSTEM",
        signerEmail: "user@example.com",
        signerName: "User One",
      }),
    ).rejects.toThrow("Rendered document not found");
  });

  it("completes a rendered document signing from Documenso", async () => {
    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValueOnce(
      "api-key-1",
    );
    mockedDocumensoService.downloadSignedDocument.mockResolvedValueOnce({
      downloadUrl: "https://signed.example/doc.pdf",
      filename: "doc.pdf",
      contentType: "application/pdf",
    });
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "IN_PROGRESS",
        documentId: "42",
        signerId: "user-1",
        signerType: "PMS_USER",
        signerEmail: "user@example.com",
        signerName: "User One",
        signingUrl: "https://documenso.example/sign/token-123",
      },
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });
    mockedPrisma.documentSignature.create.mockResolvedValueOnce({
      id: "sig-1",
    });
    mockedPrisma.renderedDocument.update.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-123",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "instance-123",
      templateInstanceId: "instance-123",
      clinicalArtifactId: null,
      templateId: "template-123",
      templateVersion: 3,
      templateVersionId: null,
      kind: "FORM",
      version: 1,
      title: "Intake Consent",
      mimeType: "application/pdf",
      status: "SIGNED",
      signable: true,
      pdfUrl: null,
      pdf: null,
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "SIGNED",
        documentId: "42",
        signerId: "user-1",
        signerType: "PMS_USER",
        signerEmail: "user@example.com",
        signerName: "User One",
        signingUrl: "https://documenso.example/sign/token-123",
        pdf: { url: "https://signed.example/doc.pdf" },
      },
      signedBy: "user-1",
      signedAt: new Date("2026-06-13T11:00:00.000Z"),
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T11:00:00.000Z"),
      signature: {
        id: "sig-1",
        renderedDocumentId: "doc-1",
        signerId: "user-1",
        signerType: "PMS_USER",
        signatureText: null,
        signedAt: new Date("2026-06-13T11:00:00.000Z"),
        createdAt: new Date("2026-06-13T11:00:00.000Z"),
        updatedAt: new Date("2026-06-13T11:00:00.000Z"),
      },
    });

    const result = await completePersistedRenderedDocumentSigning("doc-1");

    expect(mockedDocumensoService.downloadSignedDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 42, apiKey: "api-key-1" }),
    );
    expect(mockedPrisma.documentSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          renderedDocumentId: "doc-1",
          signerId: "user-1",
        }),
      }),
    );
    expect(mockedPrisma.renderedDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({
          status: "SIGNED",
          pdfUrl: "https://signed.example/doc.pdf",
          signing: expect.objectContaining({
            status: "SIGNED",
            pdf: expect.objectContaining({
              url: "https://signed.example/doc.pdf",
            }),
          }),
        }),
      }),
    );
    expect(result.status).toBe("SIGNED");
  });
});
