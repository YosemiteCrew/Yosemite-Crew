import { Types } from "mongoose";
import OrganizationDocumentModel, {
  OrganizationDocumentDocument,
  OrganizationDocumentMongo,
  OrgDocumentCategory,
} from "../models/organisation-document";
import {
  OrgDocumentCategory as PrismaOrgDocumentCategory,
  OrgDocumentVisibility as PrismaOrgDocumentVisibility,
} from "@prisma/client";
import { getURLForKey } from "src/middlewares/upload";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";

export class OrgDocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "OrgDocumentServiceError";
  }
}

const ensureObjectId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new OrgDocumentServiceError(`Invalid ${field}`, 400);
  }
  return new Types.ObjectId(id);
};

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

    if (isReadFromPostgres()) {
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
    }

    const doc = await OrganizationDocumentModel.create({
      organisationId: input.organisationId,
      title: input.title,
      description: input.description ?? "",
      category: input.category,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      visibility: input.visibility ?? "INTERNAL",
      version: 1,
    });

    if (shouldDualWrite) {
      try {
        await prisma.organizationDocument.create({
          data: {
            id: doc._id.toString(),
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
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationDocument", err);
      }
    }

    return doc;
  },

  /**
   * Update metadata and/or file. If file changes, auto-increment version.
   */
  async updateDocument(
    documentId: string,
    updates: UpdateOrgDocumentInput,
  ): Promise<OrganizationDocumentDocument> {
    if (isReadFromPostgres()) {
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

      const nextVersion = fileChanged
        ? (existing.version ?? 1) + 1
        : (existing.version ?? 1);

      const updated = await prisma.organizationDocument.update({
        where: { id: safeId },
        data: {
          title: updates.title ?? existing.title,
          description: updates.description ?? existing.description ?? "",
          category: (updates.category ??
            existing.category) as PrismaOrgDocumentCategory,
          visibility: (updates.visibility ??
            existing.visibility) as PrismaOrgDocumentVisibility,
          fileUrl:
            updates.fileUrl !== undefined
              ? getURLForKey(updates.fileUrl)
              : (existing.fileUrl ?? undefined),
          fileName:
            updates.fileName !== undefined
              ? updates.fileName
              : (existing.fileName ?? undefined),
          fileType:
            updates.fileType !== undefined
              ? updates.fileType
              : (existing.fileType ?? undefined),
          fileSize:
            updates.fileSize !== undefined
              ? updates.fileSize
              : (existing.fileSize ?? undefined),
          version: nextVersion,
        },
      });

      return updated as unknown as OrganizationDocumentDocument;
    }

    const _id = ensureObjectId(documentId, "documentId");

    const existing = await OrganizationDocumentModel.findById(_id);
    if (!existing) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }

    const fileChanged =
      updates.fileUrl !== undefined ||
      updates.fileName !== undefined ||
      updates.fileType !== undefined ||
      updates.fileSize !== undefined;

    if (updates.title !== undefined) existing.title = updates.title;
    if (updates.description !== undefined)
      existing.description = updates.description;
    if (updates.category !== undefined) existing.category = updates.category;
    if (updates.visibility !== undefined)
      existing.visibility = updates.visibility;

    if (updates.fileUrl !== undefined)
      existing.fileUrl = getURLForKey(updates.fileUrl);
    if (updates.fileName !== undefined) existing.fileName = updates.fileName;
    if (updates.fileType !== undefined) existing.fileType = updates.fileType;
    if (updates.fileSize !== undefined) existing.fileSize = updates.fileSize;

    if (fileChanged) {
      existing.version = (existing.version ?? 1) + 1;
    }

    await existing.save();

    if (shouldDualWrite) {
      try {
        await prisma.organizationDocument.updateMany({
          where: { id: existing._id.toString() },
          data: {
            title: existing.title,
            description: existing.description ?? undefined,
            category: existing.category as PrismaOrgDocumentCategory,
            fileUrl: existing.fileUrl ?? undefined,
            fileName: existing.fileName ?? undefined,
            fileType: existing.fileType ?? undefined,
            fileSize: existing.fileSize ?? undefined,
            visibility: existing.visibility as PrismaOrgDocumentVisibility,
            version: existing.version ?? 1,
            updatedAt: existing.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationDocument update", err);
      }
    }

    return existing;
  },

  /**
   * Delete a document permanently.
   * (Does NOT delete the file from storage – handle that in your file service.)
   */
  async deleteDocument(documentId: string): Promise<void> {
    if (isReadFromPostgres()) {
      const safeId = requireSafeString(documentId, "documentId");
      const res = await prisma.organizationDocument.deleteMany({
        where: { id: safeId },
      });
      if (!res.count) {
        throw new OrgDocumentServiceError("Document not found", 404);
      }
      return;
    }

    const _id = ensureObjectId(documentId, "documentId");
    const res = await OrganizationDocumentModel.findByIdAndDelete(_id);
    if (!res) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }

    if (shouldDualWrite) {
      try {
        await prisma.organizationDocument.deleteMany({
          where: { id: documentId },
        });
      } catch (err) {
        handleDualWriteError("OrganizationDocument delete", err);
      }
    }
  },

  /**
   * Get a single document by id.
   */
  async getDocumentById(
    documentId: string,
  ): Promise<OrganizationDocumentDocument> {
    if (isReadFromPostgres()) {
      const safeId = requireSafeString(documentId, "documentId");
      const doc = await prisma.organizationDocument.findFirst({
        where: { id: safeId },
      });
      if (!doc) {
        throw new OrgDocumentServiceError("Document not found", 404);
      }
      return doc as unknown as OrganizationDocumentDocument;
    }

    const _id = ensureObjectId(documentId, "documentId");
    const doc = await OrganizationDocumentModel.findById(_id);
    if (!doc) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }
    return doc;
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

    if (isReadFromPostgres()) {
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
    }

    const query: Partial<OrganizationDocumentMongo> & {
      organisationId: string;
    } = {
      organisationId: input.organisationId,
    };

    if (input.category) {
      query.category = input.category;
    }

    if (input.visibility && input.visibility !== "ALL") {
      query.visibility = input.visibility;
    }

    return OrganizationDocumentModel.find(query).sort({ updatedAt: -1 }).exec();
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

    if (isReadFromPostgres()) {
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
    }

    return OrganizationDocumentModel.find(filter)
      .sort({ updatedAt: -1 })
      .exec();
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

    if (isReadFromPostgres()) {
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
    }

    const existing = await OrganizationDocumentModel.findOne({
      organisationId: input.organisationId,
      category: input.category,
    });

    if (!existing) {
      // create new
      return this.createDocument({
        ...input,
        visibility: input.visibility ?? "PUBLIC",
      });
    }

    // update existing (this will increment version because file fields change)
    return this.updateDocument(existing._id.toString(), {
      title: input.title,
      description: input.description,
      visibility: input.visibility ?? existing.visibility,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
    });
  },
};
