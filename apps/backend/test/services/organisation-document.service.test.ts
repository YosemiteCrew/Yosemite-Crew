import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { prisma } from "src/config/prisma";
import { OrganizationDocumentService } from "../../src/services/organisation-document.service";
import { getURLForKey } from "../../src/middlewares/upload";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationDocument: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    organizationDocumentAcknowledgement: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  getURLForKey: jest.fn((value: string) => `https://cdn.example/${value}`),
}));

const mockedPrisma = prisma as any;
const mockedGetURLForKey = getURLForKey as jest.Mock;

const buildPrismaDoc = (overrides: Record<string, unknown> = {}) => ({
  id: "doc-100",
  organisationId: "org-1",
  title: "Policy",
  description: null,
  category: "GENERAL",
  fileUrl: null,
  fileName: null,
  fileType: null,
  fileSize: null,
  visibility: "INTERNAL",
  version: 1,
  createdAt: new Date("2026-03-01T00:00:00Z"),
  updatedAt: new Date("2026-03-01T00:00:00Z"),
  ...overrides,
});

describe("OrganizationDocumentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates documents with _id mapped from prisma id", async () => {
    mockedPrisma.organizationDocument.create.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      title: "Terms",
      description: "",
      category: "TERMS_AND_CONDITIONS",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "PUBLIC",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    const result = await OrganizationDocumentService.createDocument({
      organisationId: "org-1",
      title: "Terms",
      category: "TERMS_AND_CONDITIONS",
      visibility: "PUBLIC",
    });

    expect(mockedPrisma.organizationDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org-1",
        title: "Terms",
        visibility: "PUBLIC",
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        _id: "doc-1",
        organisationId: "org-1",
        pdfUrl:
          "https://cdn.example/org-docs/org-1/terms-and-conditions-v1.pdf",
      }),
    );
  });

  it("defaults visibility to INTERNAL when none is provided on create", async () => {
    mockedPrisma.organizationDocument.create.mockResolvedValueOnce({
      id: "doc-10",
      organisationId: "org-1",
      title: "Handbook",
      description: "",
      category: "GENERAL",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "INTERNAL",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    await OrganizationDocumentService.createDocument({
      organisationId: "org-1",
      title: "Handbook",
      category: "GENERAL",
    });

    expect(mockedPrisma.organizationDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        visibility: "INTERNAL",
      }),
    });
  });

  it("applies category and visibility filters when listing for an organisation", async () => {
    mockedPrisma.organizationDocument.findMany.mockResolvedValueOnce([]);

    await OrganizationDocumentService.listDocumentsForOrganisation({
      organisationId: "org-1",
      category: "GENERAL",
      visibility: "INTERNAL",
    });

    expect(mockedPrisma.organizationDocument.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        category: "GENERAL",
        visibility: "INTERNAL",
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("ignores the ALL visibility filter when listing for an organisation", async () => {
    mockedPrisma.organizationDocument.findMany.mockResolvedValueOnce([]);

    await OrganizationDocumentService.listDocumentsForOrganisation({
      organisationId: "org-1",
      visibility: "ALL",
    });

    expect(mockedPrisma.organizationDocument.findMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("upserts a policy document as PUBLIC when none exists", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.organizationDocument.create.mockResolvedValueOnce({
      id: "doc-11",
      organisationId: "org-1",
      title: "Terms",
      description: "",
      category: "TERMS_AND_CONDITIONS",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "PUBLIC",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    await OrganizationDocumentService.upsertPolicyDocument({
      organisationId: "org-1",
      title: "Terms",
      category: "TERMS_AND_CONDITIONS",
    });

    expect(mockedPrisma.organizationDocument.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        category: "TERMS_AND_CONDITIONS",
      },
    });
    expect(mockedPrisma.organizationDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "TERMS_AND_CONDITIONS",
        visibility: "PUBLIC",
      }),
    });
  });

  it("keeps the existing visibility when upserting a policy document without one", async () => {
    const existing = {
      id: "doc-12",
      organisationId: "org-1",
      title: "Privacy",
      description: "old",
      category: "PRIVACY_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "INTERNAL",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    };
    mockedPrisma.organizationDocument.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);
    mockedPrisma.organizationDocument.update.mockResolvedValueOnce({
      ...existing,
      title: "Privacy updated",
    });

    await OrganizationDocumentService.upsertPolicyDocument({
      organisationId: "org-1",
      title: "Privacy updated",
      category: "PRIVACY_POLICY",
    });

    expect(mockedPrisma.organizationDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-12" },
      data: expect.objectContaining({
        title: "Privacy updated",
        visibility: "INTERNAL",
      }),
    });
  });

  it("overrides the existing visibility when upserting a policy document with one", async () => {
    const existing = {
      id: "doc-13",
      organisationId: "org-1",
      title: "Cancellation",
      description: "",
      category: "CANCELLATION_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "INTERNAL",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    };
    mockedPrisma.organizationDocument.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);
    mockedPrisma.organizationDocument.update.mockResolvedValueOnce({
      ...existing,
      visibility: "PUBLIC",
    });

    await OrganizationDocumentService.upsertPolicyDocument({
      organisationId: "org-1",
      title: "Cancellation",
      category: "CANCELLATION_POLICY",
      visibility: "PUBLIC",
    });

    expect(mockedPrisma.organizationDocument.update).toHaveBeenCalledWith({
      where: { id: "doc-13" },
      data: expect.objectContaining({
        visibility: "PUBLIC",
      }),
    });
  });

  it("rejects upserts for non-policy categories", async () => {
    await expect(
      OrganizationDocumentService.upsertPolicyDocument({
        organisationId: "org-1",
        title: "Handbook",
        category: "GENERAL",
      }),
    ).rejects.toThrow("upsertPolicyDocument is only for policy categories");
  });

  it("updates documents with _id mapped from prisma id", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce({
      id: "doc-2",
      organisationId: "org-1",
      title: "Privacy",
      description: "old",
      category: "PRIVACY_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "INTERNAL",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    mockedPrisma.organizationDocument.update.mockResolvedValueOnce({
      id: "doc-2",
      organisationId: "org-1",
      title: "Privacy updated",
      description: "new",
      category: "PRIVACY_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "PUBLIC",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-02T00:00:00Z"),
    });

    const result = await OrganizationDocumentService.updateDocument("doc-2", {
      title: "Privacy updated",
      visibility: "PUBLIC",
    });

    expect(result).toEqual(
      expect.objectContaining({
        _id: "doc-2",
        title: "Privacy updated",
        pdfUrl: "https://cdn.example/org-docs/org-1/privacy-policy-v1.pdf",
      }),
    );
  });

  it("returns _id for document lookups and list responses", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce({
      id: "doc-3",
      organisationId: "org-1",
      title: "Cancellations",
      description: "",
      category: "CANCELLATION_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "PUBLIC",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    mockedPrisma.organizationDocument.findMany.mockResolvedValueOnce([
      {
        id: "doc-4",
        organisationId: "org-1",
        title: "Policy",
        description: "",
        category: "GENERAL",
        fileUrl: null,
        fileName: null,
        fileType: null,
        fileSize: null,
        visibility: "INTERNAL",
        version: 1,
        createdAt: new Date("2026-03-01T00:00:00Z"),
        updatedAt: new Date("2026-03-01T00:00:00Z"),
      },
    ]);
    mockedPrisma.organizationDocument.findMany.mockResolvedValueOnce([
      {
        id: "doc-5",
        organisationId: "org-1",
        title: "Public Policy",
        description: "",
        category: "GENERAL",
        fileUrl: null,
        fileName: null,
        fileType: null,
        fileSize: null,
        visibility: "PUBLIC",
        version: 1,
        createdAt: new Date("2026-03-01T00:00:00Z"),
        updatedAt: new Date("2026-03-01T00:00:00Z"),
      },
    ]);

    await expect(
      OrganizationDocumentService.getDocumentById("doc-3"),
    ).resolves.toMatchObject({
      _id: "doc-3",
      pdfUrl: "https://cdn.example/org-docs/org-1/cancellation-policy-v1.pdf",
    });

    await expect(
      OrganizationDocumentService.listDocumentsForOrganisation({
        organisationId: "org-1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        _id: "doc-4",
        pdfUrl: "https://cdn.example/org-docs/org-1/general-v1.pdf",
      }),
    ]);

    await expect(
      OrganizationDocumentService.listPublicDocumentsForOrganisation({
        organisationId: "org-1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        _id: "doc-5",
        pdfUrl: "https://cdn.example/org-docs/org-1/general-v1.pdf",
      }),
    ]);
  });

  it("uses the upload helper when replacing file urls", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce({
      id: "doc-6",
      organisationId: "org-1",
      title: "Policy",
      description: "",
      category: "GENERAL",
      fileUrl: "key-1",
      fileName: "policy.pdf",
      fileType: "application/pdf",
      fileSize: 10,
      visibility: "PUBLIC",
      version: 1,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    mockedPrisma.organizationDocument.update.mockResolvedValueOnce({
      id: "doc-6",
      organisationId: "org-1",
      title: "Policy",
      description: "",
      category: "GENERAL",
      fileUrl: "signed/key-1",
      fileName: "policy.pdf",
      fileType: "application/pdf",
      fileSize: 10,
      visibility: "PUBLIC",
      version: 2,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-02T00:00:00Z"),
    });

    await OrganizationDocumentService.updateDocument("doc-6", {
      fileUrl: "key-1",
    });

    expect(mockedGetURLForKey).toHaveBeenCalledWith("key-1");
  });

  it("returns fixed legal document metadata with CDN URLs", async () => {
    expect(OrganizationDocumentService.getFixedLegalDocument("terms")).toEqual({
      pdfUrl: "https://cdn.example/legal/terms-v1.pdf",
      version: "v1",
      lastUpdated: "2026-03-01",
    });

    expect(
      OrganizationDocumentService.getFixedLegalDocument("privacy"),
    ).toEqual({
      pdfUrl: "https://cdn.example/legal/privacy-v1.pdf",
      version: "v1",
      lastUpdated: "2026-03-01",
    });
  });

  it("rejects invalid legal document types", async () => {
    expect(() =>
      OrganizationDocumentService.getFixedLegalDocument("unknown" as "terms"),
    ).toThrow("Invalid legal document type");
  });

  const termsDocument = (version: number) => ({
    id: "doc-7",
    organisationId: "org-1",
    title: "Terms",
    description: "",
    category: "TERMS_AND_CONDITIONS",
    fileUrl: null,
    fileName: null,
    fileType: null,
    fileSize: null,
    visibility: "PUBLIC",
    version,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
  });

  it("persists document acknowledgements against the document's own version", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(
      termsDocument(2),
    );
    mockedPrisma.organizationDocumentAcknowledgement.upsert.mockResolvedValueOnce(
      {
        id: "ack-1",
      },
    );

    await expect(
      OrganizationDocumentService.acknowledgeDocument({
        organisationId: "org-1",
        documentId: "doc-7",
        userId: "user-1",
        category: "TERMS_AND_CONDITIONS",
        version: 2,
      }),
    ).resolves.toBeUndefined();

    // Category and version come off the DOCUMENT, not the request body.
    expect(
      mockedPrisma.organizationDocumentAcknowledgement.upsert,
    ).toHaveBeenCalledWith({
      where: {
        userId_organisationId_documentId_category_version: {
          userId: "user-1",
          organisationId: "org-1",
          documentId: "doc-7",
          category: "TERMS_AND_CONDITIONS",
          version: 2,
        },
      },
      create: {
        userId: "user-1",
        organisationId: "org-1",
        documentId: "doc-7",
        category: "TERMS_AND_CONDITIONS",
        version: 2,
      },
      update: {},
    });
  });

  // Trusting the client's version let a caller pre-acknowledge a version that
  // did not exist yet; when the practice later published it, the backend
  // reported it as already accepted even though nobody had read it.
  it("refuses to acknowledge a version other than the document's current one", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(
      termsDocument(2),
    );

    await expect(
      OrganizationDocumentService.acknowledgeDocument({
        organisationId: "org-1",
        documentId: "doc-7",
        userId: "user-1",
        category: "TERMS_AND_CONDITIONS",
        version: 99,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(
      mockedPrisma.organizationDocumentAcknowledgement.upsert,
    ).not.toHaveBeenCalled();
  });

  it("returns the current acknowledgement status for the document version", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce({
      id: "doc-8",
      organisationId: "org-1",
      title: "Privacy",
      description: "",
      category: "PRIVACY_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "PUBLIC",
      version: 3,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    mockedPrisma.organizationDocumentAcknowledgement.findFirst.mockResolvedValueOnce(
      {
        id: "ack-2",
        organisationId: "org-1",
        documentId: "doc-8",
        category: "PRIVACY_POLICY",
        version: 3,
        userId: "user-2",
        acknowledgedAt: new Date("2026-06-01T10:00:00Z"),
      },
    );

    await expect(
      OrganizationDocumentService.getAcknowledgementStatus({
        organisationId: "org-1",
        documentId: "doc-8",
        userId: "user-2",
      }),
    ).resolves.toEqual({
      acknowledged: true,
      version: 3,
      acknowledgedAt: new Date("2026-06-01T10:00:00Z"),
    });
  });

  it("returns false when the stored acknowledgement is for an older version", async () => {
    mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce({
      id: "doc-9",
      organisationId: "org-1",
      title: "Cancellation",
      description: "",
      category: "CANCELLATION_POLICY",
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      visibility: "PUBLIC",
      version: 4,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    mockedPrisma.organizationDocumentAcknowledgement.findFirst.mockResolvedValueOnce(
      null,
    );

    await expect(
      OrganizationDocumentService.getAcknowledgementStatus({
        organisationId: "org-1",
        documentId: "doc-9",
        userId: "user-3",
      }),
    ).resolves.toEqual({
      acknowledged: false,
      version: 4,
      acknowledgedAt: undefined,
    });
  });

  describe("identifier validation", () => {
    // requireSafeString is the mongo-operator guard: anything that could reach a
    // Prisma string filter as an operator object must be refused before the query.
    it.each([
      ["an empty id", ""],
      ["a whitespace-only id", "   "],
      ["an id carrying a mongo operator", "$ne"],
    ])("refuses %s on every id-addressed read/write", async (_label, id) => {
      await expect(
        OrganizationDocumentService.getDocumentById(id),
      ).rejects.toThrow("Invalid documentId");
      await expect(
        OrganizationDocumentService.deleteDocument(id),
      ).rejects.toThrow("Invalid documentId");
      await expect(
        OrganizationDocumentService.updateDocument(id, { title: "x" }),
      ).rejects.toThrow("Invalid documentId");

      expect(
        mockedPrisma.organizationDocument.findFirst,
      ).not.toHaveBeenCalled();
      expect(
        mockedPrisma.organizationDocument.deleteMany,
      ).not.toHaveBeenCalled();
    });

    it("refuses acknowledgement identifiers that carry mongo operators", async () => {
      await expect(
        OrganizationDocumentService.acknowledgeDocument({
          organisationId: "$ne",
          documentId: "doc-1",
          userId: "user-1",
          category: "TERMS_AND_CONDITIONS",
          version: 1,
        }),
      ).rejects.toThrow("Invalid organisationId");

      await expect(
        OrganizationDocumentService.getAcknowledgementStatus({
          organisationId: "org-1",
          documentId: "doc-1",
          userId: "",
        }),
      ).rejects.toThrow("Invalid userId");

      expect(
        mockedPrisma.organizationDocument.findFirst,
      ).not.toHaveBeenCalled();
    });
  });

  describe("createDocument", () => {
    it.each([
      [
        "organisationId is required",
        { organisationId: "", title: "Terms", category: "GENERAL" as const },
      ],
      [
        "title is required",
        { organisationId: "org-1", title: "", category: "GENERAL" as const },
      ],
    ])("rejects a create without %s", async (message, input) => {
      await expect(
        OrganizationDocumentService.createDocument(input),
      ).rejects.toThrow(message);

      expect(mockedPrisma.organizationDocument.create).not.toHaveBeenCalled();
    });

    it("signs the uploaded key and persists every optional field", async () => {
      mockedPrisma.organizationDocument.create.mockResolvedValueOnce(
        buildPrismaDoc({
          id: "doc-20",
          description: "Fire drill",
          category: "FIRE_SAFETY",
          fileUrl: "https://cdn.example/uploads/fire.pdf",
          fileName: "fire.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          visibility: "PUBLIC",
        }),
      );

      const result = await OrganizationDocumentService.createDocument({
        organisationId: "org-1",
        title: "Fire safety",
        description: "Fire drill",
        category: "FIRE_SAFETY",
        fileUrl: "uploads/fire.pdf",
        fileName: "fire.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        visibility: "PUBLIC",
      });

      expect(mockedGetURLForKey).toHaveBeenCalledWith("uploads/fire.pdf");
      expect(mockedPrisma.organizationDocument.create).toHaveBeenCalledWith({
        data: {
          organisationId: "org-1",
          title: "Fire safety",
          description: "Fire drill",
          category: "FIRE_SAFETY",
          fileUrl: "https://cdn.example/uploads/fire.pdf",
          fileName: "fire.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          visibility: "PUBLIC",
          version: 1,
        },
      });
      // A stored PDF is served straight from its own URL, not the generated slug.
      expect(result.pdfUrl).toBe("https://cdn.example/uploads/fire.pdf");
    });

    it("falls back to the generated slug url when the stored file is not a pdf", async () => {
      mockedPrisma.organizationDocument.create.mockResolvedValueOnce(
        buildPrismaDoc({
          id: "doc-21",
          category: "FIRE_SAFETY",
          fileUrl: "https://cdn.example/uploads/plan.png",
          fileType: "image/png",
          version: 1,
        }),
      );

      const result = await OrganizationDocumentService.createDocument({
        organisationId: "org-1",
        title: "Plan",
        category: "FIRE_SAFETY",
      });

      expect(result.pdfUrl).toBe(
        "https://cdn.example/org-docs/org-1/fire-safety-v1.pdf",
      );
    });

    it("generates the slug url when the pdf row has no stored file url", async () => {
      mockedPrisma.organizationDocument.create.mockResolvedValueOnce(
        buildPrismaDoc({
          id: "doc-22",
          category: "PRIVACY_POLICY",
          fileType: "application/pdf",
          fileUrl: null,
          version: 3,
        }),
      );

      const result = await OrganizationDocumentService.createDocument({
        organisationId: "org-1",
        title: "Privacy",
        category: "PRIVACY_POLICY",
      });

      expect(result.pdfUrl).toBe(
        "https://cdn.example/org-docs/org-1/privacy-policy-v3.pdf",
      );
    });
  });

  describe("updateDocument", () => {
    it("throws 404 when the document does not exist", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(null);

      await expect(
        OrganizationDocumentService.updateDocument("doc-404", {
          title: "New",
        }),
      ).rejects.toMatchObject({
        message: "Document not found",
        statusCode: 404,
      });

      expect(mockedPrisma.organizationDocument.update).not.toHaveBeenCalled();
    });

    it.each([
      ["fileUrl", { fileUrl: "uploads/new.pdf" }],
      ["fileName", { fileName: "new.pdf" }],
      ["fileType", { fileType: "application/pdf" }],
      ["fileSize", { fileSize: 99 }],
    ])("bumps the version when %s changes", async (_label, updates) => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(
        buildPrismaDoc({ id: "doc-30", version: 4 }),
      );
      mockedPrisma.organizationDocument.update.mockResolvedValueOnce(
        buildPrismaDoc({ id: "doc-30", version: 5 }),
      );

      await OrganizationDocumentService.updateDocument("doc-30", updates);

      expect(mockedPrisma.organizationDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-30" },
        data: expect.objectContaining({ version: 5 }),
      });
    });

    it("keeps the version and the stored values for a metadata-only edit", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(
        buildPrismaDoc({
          id: "doc-31",
          version: 7,
          description: "old",
          fileUrl: "https://cdn.example/old.pdf",
          fileName: "old.pdf",
          fileType: "application/pdf",
          fileSize: 12,
        }),
      );
      mockedPrisma.organizationDocument.update.mockResolvedValueOnce(
        buildPrismaDoc({ id: "doc-31", version: 7 }),
      );

      await OrganizationDocumentService.updateDocument("doc-31", {});

      expect(mockedPrisma.organizationDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-31" },
        data: {
          title: "Policy",
          description: "old",
          category: "GENERAL",
          visibility: "INTERNAL",
          fileUrl: "https://cdn.example/old.pdf",
          fileName: "old.pdf",
          fileType: "application/pdf",
          fileSize: 12,
          version: 7,
        },
      });
      expect(mockedGetURLForKey).not.toHaveBeenCalledWith(undefined);
    });

    it("treats a missing stored version as 1 and blanks a null description", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(
        buildPrismaDoc({ id: "doc-32", version: null, description: null }),
      );
      mockedPrisma.organizationDocument.update.mockResolvedValueOnce(
        buildPrismaDoc({ id: "doc-32", version: 2 }),
      );

      await OrganizationDocumentService.updateDocument("doc-32", {
        fileName: "next.pdf",
      });

      expect(mockedPrisma.organizationDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-32" },
        data: expect.objectContaining({
          description: "",
          fileUrl: undefined,
          fileName: "next.pdf",
          fileType: undefined,
          fileSize: undefined,
          version: 2,
        }),
      });
    });

    it("overwrites category and visibility when the caller supplies them", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(
        buildPrismaDoc({ id: "doc-33" }),
      );
      mockedPrisma.organizationDocument.update.mockResolvedValueOnce(
        buildPrismaDoc({
          id: "doc-33",
          category: "PRIVACY_POLICY",
          visibility: "PUBLIC",
        }),
      );

      await OrganizationDocumentService.updateDocument("doc-33", {
        title: "Privacy",
        description: "new",
        category: "PRIVACY_POLICY",
        visibility: "PUBLIC",
      });

      expect(mockedPrisma.organizationDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-33" },
        data: expect.objectContaining({
          title: "Privacy",
          description: "new",
          category: "PRIVACY_POLICY",
          visibility: "PUBLIC",
          version: 1,
        }),
      });
    });
  });

  describe("deleteDocument", () => {
    it("deletes the addressed document", async () => {
      mockedPrisma.organizationDocument.deleteMany.mockResolvedValueOnce({
        count: 1,
      });

      await expect(
        OrganizationDocumentService.deleteDocument("  doc-40  "),
      ).resolves.toBeUndefined();

      expect(mockedPrisma.organizationDocument.deleteMany).toHaveBeenCalledWith(
        {
          where: { id: "doc-40" },
        },
      );
    });

    it("throws 404 when nothing was deleted", async () => {
      mockedPrisma.organizationDocument.deleteMany.mockResolvedValueOnce({
        count: 0,
      });

      await expect(
        OrganizationDocumentService.deleteDocument("doc-41"),
      ).rejects.toMatchObject({
        message: "Document not found",
        statusCode: 404,
      });
    });
  });

  describe("reads that address a missing document", () => {
    it("throws 404 from getDocumentById", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(null);

      await expect(
        OrganizationDocumentService.getDocumentById("doc-50"),
      ).rejects.toMatchObject({
        message: "Document not found",
        statusCode: 404,
      });
    });

    it("throws 404 from acknowledgeDocument without writing an acknowledgement", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(null);

      await expect(
        OrganizationDocumentService.acknowledgeDocument({
          organisationId: "org-1",
          documentId: "doc-51",
          userId: "user-1",
          category: "TERMS_AND_CONDITIONS",
          version: 1,
        }),
      ).rejects.toMatchObject({
        message: "Document not found",
        statusCode: 404,
      });

      expect(
        mockedPrisma.organizationDocumentAcknowledgement.upsert,
      ).not.toHaveBeenCalled();
    });

    it("throws 404 from getAcknowledgementStatus", async () => {
      mockedPrisma.organizationDocument.findFirst.mockResolvedValueOnce(null);

      await expect(
        OrganizationDocumentService.getAcknowledgementStatus({
          organisationId: "org-1",
          documentId: "doc-52",
          userId: "user-1",
        }),
      ).rejects.toMatchObject({
        message: "Document not found",
        statusCode: 404,
      });

      expect(
        mockedPrisma.organizationDocumentAcknowledgement.findFirst,
      ).not.toHaveBeenCalled();
    });
  });

  describe("acknowledgeDocument version guard", () => {
    it.each([
      ["zero", 0],
      ["negative", -1],
      ["fractional", 1.5],
      ["not a number", Number.NaN],
    ])("rejects a %s version", async (_label, version) => {
      await expect(
        OrganizationDocumentService.acknowledgeDocument({
          organisationId: "org-1",
          documentId: "doc-60",
          userId: "user-1",
          category: "TERMS_AND_CONDITIONS",
          version,
        }),
      ).rejects.toMatchObject({ message: "Invalid version", statusCode: 400 });

      expect(
        mockedPrisma.organizationDocument.findFirst,
      ).not.toHaveBeenCalled();
    });
  });

  describe("organisation-scoped listings", () => {
    it.each([
      [
        "listDocumentsForOrganisation",
        () =>
          OrganizationDocumentService.listDocumentsForOrganisation({
            organisationId: "",
          }),
      ],
      [
        "listPublicDocumentsForOrganisation",
        () =>
          OrganizationDocumentService.listPublicDocumentsForOrganisation({
            organisationId: "",
          }),
      ],
    ])("refuses an unscoped %s", async (_label, call) => {
      await expect(call()).rejects.toMatchObject({
        message: "organisationId is required",
        statusCode: 400,
      });

      expect(mockedPrisma.organizationDocument.findMany).not.toHaveBeenCalled();
    });

    it("applies the caller's category and pins visibility to PUBLIC", async () => {
      mockedPrisma.organizationDocument.findMany.mockResolvedValueOnce([]);

      await OrganizationDocumentService.listPublicDocumentsForOrganisation({
        organisationId: "org-1",
        category: "PRIVACY_POLICY",
      });

      expect(mockedPrisma.organizationDocument.findMany).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          category: "PRIVACY_POLICY",
          visibility: "PUBLIC",
        },
        orderBy: { updatedAt: "desc" },
      });
    });
  });
});
