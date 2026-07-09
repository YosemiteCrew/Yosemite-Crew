import {
  OrganizationDocumentDocument,
  OrgDocumentCategory,
} from "../models/organisation-document";
import {
  OrgDocumentCategory as PrismaOrgDocumentCategory,
  OrgDocumentVisibility as PrismaOrgDocumentVisibility,
} from "@prisma/client";
import { getURLForKey } from "src/middlewares/upload";
import { prisma } from "src/config/prisma";

export class OrgDocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "OrgDocumentServiceError";
  }
}

const requireSafeString = (value: string, field: string) => {
  if (!value || typeof value !== "string") {
    throw new OrgDocumentServiceError(`Invalid ${field}`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new OrgDocumentServiceError(`Invalid ${field}`, 400);
  }
  if (trimmed.includes("$")) {
    throw new OrgDocumentServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

type Visibility = "INTERNAL" | "PUBLIC";

export interface CreateOrgDocumentInput {
  organisationId: string;
  title: string;
  description?: string;
  category: OrgDocumentCategory;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  visibility?: Visibility;
}

export interface UpdateOrgDocumentInput {
  title?: string;
  description?: string;
  category?: OrgDocumentCategory;
  visibility?: Visibility;

  // if any of these are present we treat it as a file replacement and bump version
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

export const OrganizationDocumentService = {
  /**
   * Create a new document for an organisation.
   */
  async createDocument(
    input: CreateOrgDocumentInput,
  ): Promise<OrganizationDocumentDocument> {
    if (!input.organisationId) {
      throw new OrgDocumentServiceError("organisationId is required", 400);
    }
    if (!input.title) {
      throw new OrgDocumentServiceError("title is required", 400);
    }

    if (input.fileUrl) input.fileUrl = getURLForKey(input.fileUrl);

    const doc = await prisma.organizationDocument.create({
      data: {
        organisationId: input.organisationId,
        title: input.title,
        description: input.description ?? "",
        category: input.category as PrismaOrgDocumentCategory,
        fileUrl: input.fileUrl ?? undefined,
        fileName: input.fileName ?? undefined,
        fileType: input.fileType ?? undefined,
        fileSize: input.fileSize ?? undefined,
        visibility: (input.visibility ??
          "INTERNAL") as PrismaOrgDocumentVisibility,
        version: 1,
      },
    });
    return doc as unknown as OrganizationDocumentDocument;
  },

  /**
   * Update metadata and/or file. If file changes, auto-increment version.
   */
  async updateDocument(
    documentId: string,
    updates: UpdateOrgDocumentInput,
  ): Promise<OrganizationDocumentDocument> {
    const safeId = requireSafeString(documentId, "documentId");
    const existing = await prisma.organizationDocument.findFirst({
      where: { id: safeId },
    });
    if (!existing) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }

    const fileChanged =
      updates.fileUrl !== undefined ||
      updates.fileName !== undefined ||
      updates.fileType !== undefined ||
      updates.fileSize !== undefined;

    const baseVersion = existing.version ?? 1;
    const nextVersion = fileChanged ? baseVersion + 1 : baseVersion;

    let fileUrl = existing.fileUrl ?? undefined;
    if (updates.fileUrl !== undefined) {
      fileUrl = getURLForKey(updates.fileUrl);
    }

    const updated = await prisma.organizationDocument.update({
      where: { id: safeId },
      data: {
        title: updates.title ?? existing.title,
        description: updates.description ?? existing.description ?? "",
        category: updates.category ?? existing.category,
        visibility: updates.visibility ?? existing.visibility,
        fileUrl,
        fileName: updates.fileName ?? existing.fileName ?? undefined,
        fileType: updates.fileType ?? existing.fileType ?? undefined,
        fileSize: updates.fileSize ?? existing.fileSize ?? undefined,
        version: nextVersion,
      },
    });

    return updated as unknown as OrganizationDocumentDocument;
  },

  /**
   * Delete a document permanently.
   * (Does NOT delete the file from storage – handle that in your file service.)
   */
  async deleteDocument(documentId: string): Promise<void> {
    const safeId = requireSafeString(documentId, "documentId");
    const res = await prisma.organizationDocument.deleteMany({
      where: { id: safeId },
    });
    if (!res.count) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }
  },

  /**
   * Get a single document by id.
   */
  async getDocumentById(
    documentId: string,
  ): Promise<OrganizationDocumentDocument> {
    const safeId = requireSafeString(documentId, "documentId");
    const doc = await prisma.organizationDocument.findFirst({
      where: { id: safeId },
    });
    if (!doc) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }
    return doc as unknown as OrganizationDocumentDocument;
  },

  /**
   * List documents for PMS (admin) with optional filters.
   */
  async listDocumentsForOrganisation(input: {
    organisationId: string;
    category?: OrgDocumentCategory;
    visibility?: Visibility | "ALL";
  }): Promise<OrganizationDocumentDocument[]> {
    if (!input.organisationId) {
      throw new OrgDocumentServiceError("organisationId is required", 400);
    }

    const where: {
      organisationId: string;
      category?: PrismaOrgDocumentCategory;
      visibility?: PrismaOrgDocumentVisibility;
    } = {
      organisationId: input.organisationId,
    };

    if (input.category) {
      where.category = input.category as PrismaOrgDocumentCategory;
    }

    if (input.visibility && input.visibility !== "ALL") {
      where.visibility = input.visibility as PrismaOrgDocumentVisibility;
    }

    const docs = await prisma.organizationDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return docs as unknown as OrganizationDocumentDocument[];
  },

  /**
   * For mobile app: only PUBLIC documents for an org,
   * usually legal docs to show during onboarding / booking.
   */
  async listPublicDocumentsForOrganisation(filter: {
    organisationId: string;
    category?: string;
    visibility?: string;
  }): Promise<OrganizationDocumentDocument[]> {
    if (!filter.organisationId) {
      throw new OrgDocumentServiceError("organisationId is required", 400);
    }

    const where: {
      organisationId: string;
      category?: PrismaOrgDocumentCategory;
      visibility?: PrismaOrgDocumentVisibility;
    } = {
      organisationId: filter.organisationId,
    };

    if (filter.category) {
      where.category = filter.category as PrismaOrgDocumentCategory;
    }

    if (filter.visibility) {
      where.visibility = filter.visibility as PrismaOrgDocumentVisibility;
    }

    const docs = await prisma.organizationDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return docs as unknown as OrganizationDocumentDocument[];
  },

  /**
   * Convenience: ensure exactly one doc per org+category
   * for policy docs (T&C, privacy, cancellation).
   * If exists -> update & bump version when file changes.
   * If not -> create new one.
   */
  async upsertPolicyDocument(
    input: CreateOrgDocumentInput,
  ): Promise<OrganizationDocumentDocument> {
    if (
      ![
        "TERMS_AND_CONDITIONS",
        "PRIVACY_POLICY",
        "CANCELLATION_POLICY",
      ].includes(input.category)
    ) {
      throw new OrgDocumentServiceError(
        "upsertPolicyDocument is only for policy categories",
        400,
      );
    }

    const existing = await prisma.organizationDocument.findFirst({
      where: {
        organisationId: input.organisationId,
        category: input.category as PrismaOrgDocumentCategory,
      },
    });

    if (!existing) {
      return await this.createDocument({
        ...input,
        visibility: input.visibility ?? "PUBLIC",
      });
    }

    return await this.updateDocument(existing.id, {
      title: input.title,
      description: input.description,
      visibility: input.visibility ?? (existing.visibility as Visibility),
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
    });
  },
};
