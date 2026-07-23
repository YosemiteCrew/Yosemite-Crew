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
  getURLForKey: jest.fn((value: string) => value),
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
    ).resolves.toMatchObject({ _id: "doc-3" });

    await expect(
      OrganizationDocumentService.listDocumentsForOrganisation({
        organisationId: "org-1",
      }),
    ).resolves.toEqual([expect.objectContaining({ _id: "doc-4" })]);

    await expect(
      OrganizationDocumentService.listPublicDocumentsForOrganisation({
        organisationId: "org-1",
      }),
    ).resolves.toEqual([expect.objectContaining({ _id: "doc-5" })]);
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
});
