import { Types } from "mongoose";
import OrganizationDocumentModel, {
  OrganizationDocumentDocument,
  OrganizationDocumentMongo,
  OrgDocumentCategory,
} from "../models/organisation-document";

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

    return doc;
  },

  /**
   * Update metadata and/or file. If file changes, auto-increment version.
   */
  async updateDocument(
    documentId: string,
    updates: UpdateOrgDocumentInput,
  ): Promise<OrganizationDocumentDocument> {
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

    if (updates.fileUrl !== undefined) existing.fileUrl = updates.fileUrl;
    if (updates.fileName !== undefined) existing.fileName = updates.fileName;
    if (updates.fileType !== undefined) existing.fileType = updates.fileType;
    if (updates.fileSize !== undefined) existing.fileSize = updates.fileSize;

    if (fileChanged) {
      existing.version = (existing.version ?? 1) + 1;
    }

    await existing.save();
    return existing;
  },

  /**
   * Delete a document permanently.
   * (Does NOT delete the file from storage – handle that in your file service.)
   */
  async deleteDocument(documentId: string): Promise<void> {
    const _id = ensureObjectId(documentId, "documentId");
    const res = await OrganizationDocumentModel.findByIdAndDelete(_id);
    if (!res) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }
  },

  /**
   * Get a single document by id.
   */
  async getDocumentById(
    documentId: string,
  ): Promise<OrganizationDocumentDocument> {
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

    const query: Partial<OrganizationDocumentMongo> & { organisationId: string } =
      {
        organisationId: input.organisationId,
      };

    if (input.category) {
      query.category = input.category;
    }

    if (input.visibility && input.visibility !== "ALL") {
      query.visibility = input.visibility;
    }

    return OrganizationDocumentModel.find(query)
      .sort({ updatedAt: -1 })
      .exec();
  },

  /**
   * For mobile app: only PUBLIC documents for an org,
   * usually legal docs to show during onboarding / booking.
   */
  async listPublicDocumentsForOrganisation(filter : {
    organisationId: string;
    category?: string;
    visibility?: string;
  }
  ): Promise<OrganizationDocumentDocument[]> {
    if (!filter.organisationId) {
      throw new OrgDocumentServiceError("organisationId is required", 400);
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
  async upsertPolicyDocument(input: CreateOrgDocumentInput): Promise<OrganizationDocumentDocument> {
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