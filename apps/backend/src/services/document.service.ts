import { Types } from "mongoose";
import DocumentModel, {
  type DocumentMongo,
  type DocumentDocument,
} from "../models/document";
import { assertSafeString } from "src/utils/sanitize";
import {
  deleteFromS3,
  generatePresignedDownloadUrl,
} from "src/middlewares/upload";
import escapeStringRegex from "escape-string-regexp"

export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

const PMS_VISIBLE_CATEGORIES = new Set<string>([
  "HEALTH",
  "HYGIENE_MAINTENANCE",
]);

const VALID_CATEGORY_SUBCATEGORIES: Record<string, Set<string>> = {
  ADMIN: new Set(["PASSPORT", "CERTIFICATES", "INSURANCE"]),
  HEALTH: new Set([
    "HOSPITAL_VISITS",
    "PRESCRIPTIONS_AND_TREATMENTS",
    "VACCINATION_AND_PARASITE_PREVENTION",
    "LAB_TESTS",
  ]),
  HYGIENE_MAINTENANCE: new Set([
    "GROOMER_VISIT",
    "BOARDER_VISIT",
    "BREEDER_VISIT",
    "TRAINING_AND_BEHAVIOUR_REPORTS",
  ]),
  DIETARY_PLANS: new Set(["NUTRITION_PLANS"]),
  OTHERS: new Set(),
};

const isPmsVisibleCategory = (category: string): boolean =>
  PMS_VISIBLE_CATEGORIES.has(category);

const validateCategoryAndSubcategory = (
  category: string,
  subcategory?: string | null,
): void => {
  const upperCategory = String(category).toUpperCase();

  if (
    !Object.prototype.hasOwnProperty.call(
      VALID_CATEGORY_SUBCATEGORIES,
      upperCategory,
    )
  ) {
    throw new DocumentServiceError(
      `Invalid document category: ${category}`,
      400,
    );
  }

  const allowedSubcats = VALID_CATEGORY_SUBCATEGORIES[upperCategory];

  if (!subcategory) {
    return;
  }

  if (allowedSubcats.size === 0) {
    return;
  }

  const upperSubcat = String(subcategory).toUpperCase();
  if (!allowedSubcats.has(upperSubcat)) {
    throw new DocumentServiceError(
      `Invalid subcategory '${subcategory}' for category '${category}'`,
      400,
    );
  }
};

const ensureObjectId = (
  value: string | Types.ObjectId,
  fieldName: string,
): Types.ObjectId => {
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (!Types.ObjectId.isValid(value)) {
    throw new DocumentServiceError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(value);
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export interface DocumentAttachmentInput {
  key: string; // S3 key (temp or final)
  mimeType: string;
  size?: number;
}

export interface CreateDocumentInput {
  companionId: string | Types.ObjectId;
  appointmentId?: string | Types.ObjectId | null;

  category: string;
  subcategory?: string | null;

  visitType?: string | null;
  title: string;
  issuingBusinessName?: string | null;
  issueDate?: Date | string | null;

  attachments: DocumentAttachmentInput[];
}

export type DocumentCreateContext = {
  parentId?: Types.ObjectId | string;
  pmsUserId?: string;
};

export interface DocumentDto {
  id: string;
  companionId: string;
  appointmentId: string | null;

  category: string;
  subcategory: string | null;
  visitType: string | null;

  title: string;
  issuingBusinessName: string | null;
  issueDate: string | null;

  attachments: {
    key: string;
    mimeType: string;
    size?: number;
  }[];

  pmsVisible: boolean;
  syncedFromPms: boolean;

  uploadedByParentId: string | null;
  uploadedByPmsUserId: string | null;

  createdAt: string;
  updatedAt: string;
}

const mapDocumentToDto = (doc: DocumentDocument): DocumentDto => {
  const obj = doc.toObject() as DocumentMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    companionId: obj.companionId.toString(),
    appointmentId: obj.appointmentId ? obj.appointmentId.toString() : null,

    category: obj.category,
    subcategory: obj.subcategory ?? null,
    visitType: obj.visitType ?? null,

    title: obj.title,
    issuingBusinessName: obj.issuingBusinessName ?? null,
    issueDate: obj.issueDate ? obj.issueDate.toISOString() : null,

    attachments: (obj.attachments ?? []).map((att) => ({
      key: att.key,
      mimeType: att.mimeType,
      size: att.size,
    })),

    pmsVisible: obj.pmsVisible,
    syncedFromPms: obj.syncedFromPms,

    uploadedByParentId: obj.uploadedByParentId
      ? obj.uploadedByParentId.toString()
      : null,
    uploadedByPmsUserId: obj.uploadedByPmsUserId
      ? obj.uploadedByPmsUserId.toString()
      : null,

    createdAt: (obj.createdAt ?? new Date()).toISOString(),
    updatedAt: (obj.updatedAt ?? new Date()).toISOString(),
  };
};

const buildPersistableDocument = (
  input: CreateDocumentInput,
  context: DocumentCreateContext,
): DocumentMongo => {
  let source: string;
  if (context.parentId) source = "parent";
  else source = "pms";

  if (!isNonEmptyString(input.title)) {
    throw new DocumentServiceError("Document title is required.", 400);
  }

  if (!Array.isArray(input.attachments) || input.attachments.length === 0) {
    throw new DocumentServiceError("At least one attachment is required.", 400);
  }

  const companionId = ensureObjectId(input.companionId, "companionId");
  const appointmentId =
    input.appointmentId != null
      ? ensureObjectId(input.appointmentId, "appointmentId")
      : null;

  const category = String(input.category).toUpperCase();
  const subcategory = input.subcategory
    ? String(input.subcategory).toUpperCase()
    : null;

  validateCategoryAndSubcategory(category, subcategory ?? undefined);

  const pmsVisible = isPmsVisibleCategory(category);

  let syncedFromPms = false;
  let uploadedByParentId: Types.ObjectId | null = null;
  let uploadedByPmsUserId: string | undefined;

  if (source === "parent") {
    uploadedByParentId = ensureObjectId(context.parentId!, "parentId");
    syncedFromPms = false;
  } else {
    uploadedByPmsUserId = assertSafeString(
      context.pmsUserId,
      "uploadedByPmsUserId",
    );
    syncedFromPms = true;
  }

  let issueDate: Date | null = null;
  if (input.issueDate instanceof Date) {
    issueDate = input.issueDate;
  } else if (typeof input.issueDate === "string" && input.issueDate.trim()) {
    const parsed = new Date(input.issueDate);
    if (!Number.isNaN(parsed.getTime())) {
      issueDate = parsed;
    }
  }

  const attachments = input.attachments.map((att) => ({
    key: String(att.key),
    mimeType: String(att.mimeType),
    size: typeof att.size === "number" ? att.size : undefined,
  }));

  const persistable: DocumentMongo = {
    companionId,
    appointmentId,

    category,
    subcategory,

    visitType: input.visitType ?? null,
    title: input.title.trim(),
    issuingBusinessName: input.issuingBusinessName?.trim() ?? null,

    issueDate,

    attachments,

    uploadedByParentId,
    uploadedByPmsUserId,

    pmsVisible,
    syncedFromPms,
  };

  return persistable;
};

// Service methods
export const DocumentService = {
  async create(
    input: CreateDocumentInput,
    context: DocumentCreateContext,
  ): Promise<DocumentDto> {
    const persistable = buildPersistableDocument(input, context);
    const doc = await DocumentModel.create(persistable);
    return mapDocumentToDto(doc);
  },

  async listForParent(params: {
    companionId: string | Types.ObjectId;
    category?: string;
    subcategory?: string;
  }): Promise<DocumentDto[]> {
    const companionId = ensureObjectId(params.companionId, "companionId");

    const filter: Record<string, unknown> = {
      companionId,
    };

    if (params.category) {
      filter.category = String(params.category).toUpperCase();
    }

    if (params.subcategory) {
      filter.subcategory = String(params.subcategory).toUpperCase();
    }

    const docs = await DocumentModel.find(filter)
      .sort({ issueDate: -1, createdAt: -1 })
      .exec();

    return docs.map(mapDocumentToDto);
  },

  async listForPms(params: {
    companionId: string | Types.ObjectId;
    category?: string;
    subcategory?: string;
    appointmentId?: string | Types.ObjectId;
  }): Promise<DocumentDto[]> {
    const companionId = ensureObjectId(params.companionId, "companionId");

    const filter: Record<string, unknown> = {
      companionId,
      pmsVisible: true,
    };

    if (params.category) {
      filter.category = String(params.category).toUpperCase();
    }

    if (params.subcategory) {
      filter.subcategory = String(params.subcategory).toUpperCase();
    }

    if (params.appointmentId) {
      filter.appointmentId = ensureObjectId(
        params.appointmentId,
        "appointmentId",
      );
    }

    const docs = await DocumentModel.find(filter)
      .sort({ issueDate: -1, createdAt: -1 })
      .exec();

    return docs.map(mapDocumentToDto);
  },

  async getByIdForParent(
    id: string | Types.ObjectId,
  ): Promise<DocumentDto | null> {
    const _id = ensureObjectId(id, "documentId");
    const doc = await DocumentModel.findById(_id).exec();
    if (!doc) {
      return null;
    }
    return mapDocumentToDto(doc);
  },

  async getByIdForPms(
    id: string | Types.ObjectId,
  ): Promise<DocumentDto | null> {
    const _id = ensureObjectId(id, "documentId");
    const doc = await DocumentModel.findOne({ _id, pmsVisible: true }).exec();
    if (!doc) {
      return null;
    }
    return mapDocumentToDto(doc);
  },

  async deleteForParent(
    id: string | Types.ObjectId,
    parentId: string | Types.ObjectId,
  ): Promise<boolean> {
    const _id = ensureObjectId(id, "documentId");
    const _parentId = ensureObjectId(parentId, "parentId");

    const doc = await DocumentModel.findOne({
      _id,
      uploadedByParentId: _parentId,
    }).exec();

    if (!doc) {
      throw new DocumentServiceError(
        "Document not found or not deletable.",
        404,
      );
    }

    // Delete all files from S3
    for (const attachment of doc.attachments) {
      await deleteFromS3(attachment.key);
    }
    await DocumentModel.deleteOne({ _id }).exec();
    return true;
  },

  // List of Documents of Appointment for PMS
  async listForAppointmentParent(
    appointmentId: string | Types.ObjectId,
  ): Promise<DocumentDto[]> {
    appointmentId = ensureObjectId(appointmentId, "appointmentId");

    const docs = await DocumentModel.find({
      appointmentId,
    })
      .sort({ createdAt: -1 })
      .exec();

    return docs.map(mapDocumentToDto);
  },

  // List of Documents of Appointment for PMS
  async listForAppointmentPms(params: {
    companionId: string | Types.ObjectId;
    appointmentId: string | Types.ObjectId;
  }): Promise<DocumentDto[]> {
    const companionId = ensureObjectId(params.companionId, "companionId");
    const appointmentId = ensureObjectId(params.appointmentId, "appointmentId");

    const docs = await DocumentModel.find({
      companionId,
      appointmentId,
      pmsVisible: true,
    })
      .sort({ createdAt: -1 })
      .exec();

    return docs.map(mapDocumentToDto);
  },

  // Update Document
  async update(
    id: string | Types.ObjectId,
    updates: Partial<CreateDocumentInput>,
    context: DocumentCreateContext,
  ): Promise<DocumentDto> {
    const _id = ensureObjectId(id, "documentId");

    // 1. Load existing document
    const doc = await DocumentModel.findById(_id);
    if (!doc) {
      throw new DocumentServiceError("Document not found.", 404);
    }

    const isParentUpdater = !!context.parentId;
    const isPmsUpdater = !!context.pmsUserId;

    // 2. Permission check
    if (isParentUpdater) {
      if (
        !doc.uploadedByParentId ||
        doc.uploadedByParentId.toString() !== context.parentId!.toString()
      ) {
        throw new DocumentServiceError(
          "Parent is not allowed to update this document.",
          403,
        );
      }
    }

    if (isPmsUpdater) {
      if (!doc.syncedFromPms) {
        throw new DocumentServiceError(
          "PMS cannot update documents uploaded by parent.",
          403,
        );
      }
    }

    // 4. Validate category / subcategory only when changed
    if (updates.category || updates.subcategory) {
      const newCategory = (updates.category ?? doc.category)
        .toString()
        .toUpperCase();
      const newSubcategory = updates.subcategory
        ? updates.subcategory.toString().toUpperCase()
        : doc.subcategory;

      validateCategoryAndSubcategory(newCategory, newSubcategory ?? undefined);

      doc.category = newCategory;
      doc.subcategory = newSubcategory ?? null;

      // pmsVisible may change because category changed
      doc.pmsVisible = isPmsVisibleCategory(newCategory);
    }

    // 5. Handle simple field updates
    if (
      updates.title &&
      typeof updates.title === "string" &&
      updates.title.trim()
    ) {
      doc.title = updates.title.trim();
    }

    if (updates.visitType) {
      doc.visitType = updates.visitType;
    }

    if (updates.issuingBusinessName !== undefined) {
      doc.issuingBusinessName = updates.issuingBusinessName || null;
    }

    if (updates.issueDate) {
      const parsed = new Date(updates.issueDate);
      if (!isNaN(parsed.getTime())) {
        doc.issueDate = parsed;
      }
    }

    // 6. Attachments update (optional)
    if (updates.attachments && Array.isArray(updates.attachments)) {
      // Replace attachments entirely (or merge—your choice)
      doc.attachments = updates.attachments.map((att) => ({
        key: String(att.key),
        mimeType: String(att.mimeType),
        size: att.size,
      }));
    }

    // 7. Save the updated document
    await doc.save();

    return mapDocumentToDto(doc);
  },

  async getAllAttachmentUrls(documentId: string | Types.ObjectId) {
    const _id = ensureObjectId(documentId, "documentId");
    const doc = await DocumentModel.findById(_id).exec();

    if (!doc || !doc.attachments?.length)
      throw new DocumentServiceError("No attachments found.", 404);

    const urls = await Promise.all(
      doc.attachments.map((att) => generatePresignedDownloadUrl(att.key)),
    );

    return urls.map((url, index) => ({
      url,
      mimeType: doc.attachments[index].mimeType,
      key: doc.attachments[index].key,
    }));
  },

  async searchByTitleForParent(params: {
    companionId: string | Types.ObjectId;
    title: string;
  }): Promise<DocumentDto[]> {
    const companionId = ensureObjectId(params.companionId, "companionId");

    if (!params.title || typeof params.title !== "string") {
      throw new DocumentServiceError("Search title is required.", 400);
    }

    const safe = escapeStringRegex(params.title.trim());
    const regex = new RegExp(safe, "i");

    const docs = await DocumentModel.find({
      companionId,
      title: { $regex: regex },
    })
      .sort({ createdAt: -1 })
      .exec();

    return docs.map(mapDocumentToDto);
  }

};
