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
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  getURLForKey: jest.fn((value: string) => `https://cdn.example/${value}`),
}));

const mockedPrisma = prisma as any;
const mockedGetURLForKey = getURLForKey as jest.Mock;

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
});
