import { prisma } from "src/config/prisma";
import {
  deleteFromS3,
  generatePresignedDownloadUrl,
} from "src/middlewares/upload";
import { assertSafeString } from "src/utils/sanitize";
import { AuditTrailService } from "./audit-trail.service";

export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

const COMPANION_DOCUMENT_CATEGORIES = new Set([
  "ADMIN",
  "HEALTH",
  "HYGIENE_MAINTENANCE",
  "DIETARY_PLANS",
  "OTHERS",
]);

const VALID_CATEGORY_SUBCATEGORIES: Record<string, Set<string>> = {
  ADMIN: new Set(["PASSPORT", "CERTIFICATES", "INSURANCE"]),
  HEALTH: new Set([
    "SURGERY_OR_PROCEDURE",
    "PRESCRIPTION",
    "VACCINATION",
    "DISCHARGE_SUMMARY",
    "LAB_TEST",
    "IMAGING_OR_DIAGNOSTIC",
    "PARASITE_PREVENTION",
    "MEDICAL_CONDITION",
  ]),
  HYGIENE_MAINTENANCE: new Set([
    "BATHING",
    "NAIL_TRIM",
    "GROOMING",
    "EAR_CLEANING",
    "DENTAL_CLEANING",
    "SKIN_CARE",
    "ANAL_GLAND_EXPRESSION",
  ]),
  DIETARY_PLANS: new Set(["NUTRITION_PLANS"]),
  OTHERS: new Set(),
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeStringId = (value: string, fieldName: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new DocumentServiceError(`Invalid ${fieldName}`, 400);
  }
  return normalized;
};

const validateCategoryAndSubcategory = (
  category: string,
  subcategory?: string | null,
): void => {
  const upperCategory = category.toUpperCase();
  if (!COMPANION_DOCUMENT_CATEGORIES.has(upperCategory)) {
    throw new DocumentServiceError(
      `Invalid document category: ${category}`,
      400,
    );
  }

  const allowedSubcategories = VALID_CATEGORY_SUBCATEGORIES[upperCategory];
  if (!subcategory || allowedSubcategories.size === 0) {
    return;
  }

  const upperSubcategory = subcategory.toUpperCase();
  if (!allowedSubcategories.has(upperSubcategory)) {
    throw new DocumentServiceError(
      `Invalid subcategory '${subcategory}' for category '${category}'`,
      400,
    );
  }
};

const isPmsVisibleCategory = (category: string) =>
  COMPANION_DOCUMENT_CATEGORIES.has(category.toUpperCase());

const parseIssueDate = (issueDate?: string | Date | null): Date | null => {
  if (!issueDate) {
    return null;
  }
  if (issueDate instanceof Date) {
    return Number.isNaN(issueDate.getTime()) ? null : issueDate;
  }
  const parsed = new Date(issueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getPatientIdFromAppointment = (patient: unknown): string | null => {
  if (!patient) {
    return null;
  }
  if (typeof patient === "string") {
    return patient.trim() || null;
  }
  if (typeof patient === "object" && !Array.isArray(patient)) {
    const candidate = patient as { id?: unknown; patientId?: unknown };
    if (typeof candidate.id === "string" && candidate.id.trim()) {
      return candidate.id.trim();
    }
    if (typeof candidate.patientId === "string" && candidate.patientId.trim()) {
      return candidate.patientId.trim();
    }
  }
  return null;
};

const assertParentCanAccessCompanion = async (
  parentId: string,
  patientId: string,
): Promise<void> => {
  const link = await prisma.parentPatient.findFirst({
    where: {
      parentId: normalizeStringId(parentId, "parentId"),
      patientId: normalizeStringId(patientId, "patientId"),
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { id: true },
  });

  if (!link) {
    throw new DocumentServiceError("Document not found.", 404);
  }
};

const assertPmsCanAccessCompanion = async (
  organisationId: string,
  patientId: string,
): Promise<void> => {
  assertSafeString(organisationId, "organisationId");
  const link = await prisma.patientOrganisation.findFirst({
    where: {
      organisationId,
      patientId: normalizeStringId(patientId, "patientId"),
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { id: true },
  });

  if (!link) {
    throw new DocumentServiceError("Document not found.", 404);
  }
};

const getParentAccessibleCompanionIds = async (
  parentId: string,
): Promise<string[]> => {
  const links = await prisma.parentPatient.findMany({
    where: {
      parentId: normalizeStringId(parentId, "parentId"),
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { patientId: true },
  });

  return links
    .map((link) => normalizeStringId(link.patientId, "patientId"))
    .filter(Boolean);
};

const getOrganisationAccessibleCompanionIds = async (
  organisationId: string,
): Promise<string[]> => {
  assertSafeString(organisationId, "organisationId");
  const links = await prisma.patientOrganisation.findMany({
    where: {
      organisationId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { patientId: true },
  });

  return links
    .map((link) => normalizeStringId(link.patientId, "patientId"))
    .filter(Boolean);
};

type AttachmentInput = {
  key: string;
  mimeType: string;
  size?: number;
};

export interface DocumentAttachmentInput {
  key: string;
  mimeType: string;
  size?: number;
}

export interface CreateDocumentInput {
  patientId: string;
  appointmentId?: string | null;
  category: string;
  subcategory?: string | null;
  visitType?: string | null;
  title: string;
  issuingBusinessName?: string | null;
  issueDate?: Date | string | null;
  attachments: DocumentAttachmentInput[];
}

export type DocumentCreateContext = {
  parentId?: string;
  pmsUserId?: string;
  organisationId?: string;
};

export interface DocumentDto {
  id: string;
  patientId: string;
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
  sourceKind?: string;
  sourceId?: string;
  templateId?: string | null;
  templateVersion?: number | null;
  signingStatus?: string;
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

type PrismaDocumentRow = {
  id: string;
  patientId: string;
  appointmentId: string | null;
  category: string;
  subcategory: string | null;
  visitType: string | null;
  title: string;
  issuingBusinessName: string | null;
  issueDate: Date | null;
  uploadedByParentId: string | null;
  uploadedByPmsUserId: string | null;
  pmsVisible: boolean;
  syncedFromPms: boolean;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Array<{
    key: string;
    mimeType: string;
    size: number | null;
  }>;
};

type RenderedDocumentRow = {
  id: string;
  organisationId: string;
  sourceKind: string;
  sourceId: string;
  templateId: string | null;
  templateVersion: number | null;
  kind: string;
  title: string;
  status: string;
  pdfUrl: string | null;
  signing: unknown;
  createdAt: Date;
  updatedAt: Date;
  templateInstance: {
    appointmentId: string | null;
    encounterId: string | null;
  } | null;
  clinicalArtifact: {
    appointmentId: string | null;
    encounterId: string | null;
  } | null;
};

const mapDocumentToDto = (doc: PrismaDocumentRow): DocumentDto => ({
  id: doc.id,
  patientId: doc.patientId,
  appointmentId: doc.appointmentId,
  category: doc.category,
  subcategory: doc.subcategory,
  visitType: doc.visitType,
  title: doc.title,
  issuingBusinessName: doc.issuingBusinessName,
  issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
  attachments: (doc.attachments ?? []).map((att) => ({
    key: att.key,
    mimeType: att.mimeType,
    size: att.size ?? undefined,
  })),
  pmsVisible: doc.pmsVisible,
  syncedFromPms: doc.syncedFromPms,
  uploadedByParentId: doc.uploadedByParentId,
  uploadedByPmsUserId: doc.uploadedByPmsUserId,
  sourceKind: "DOCUMENT",
  sourceId: doc.id,
  templateId: null,
  templateVersion: null,
  signingStatus: doc.pmsVisible ? "SIGNED" : "NOT_STARTED",
  pdfUrl: null,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

const mapRenderedDocumentToDto = (
  document: RenderedDocumentRow,
): DocumentDto => ({
  id: document.id,
  patientId:
    document.templateInstance?.appointmentId ??
    document.clinicalArtifact?.appointmentId ??
    document.sourceId,
  appointmentId:
    document.templateInstance?.appointmentId ??
    document.clinicalArtifact?.appointmentId ??
    null,
  category: document.kind,
  subcategory: null,
  visitType: null,
  title: document.title,
  issuingBusinessName: null,
  issueDate: null,
  attachments: [],
  pmsVisible: document.status === "SIGNED",
  syncedFromPms: false,
  uploadedByParentId: null,
  uploadedByPmsUserId: null,
  sourceKind: document.sourceKind,
  sourceId: document.sourceId,
  templateId: document.templateId,
  templateVersion: document.templateVersion,
  signingStatus:
    typeof document.signing === "object" &&
    document.signing !== null &&
    !Array.isArray(document.signing) &&
    typeof (document.signing as { status?: unknown }).status === "string"
      ? String((document.signing as { status?: string }).status)
      : document.status === "SIGNED"
        ? "SIGNED"
        : "NOT_STARTED",
  pdfUrl: document.pdfUrl,
  createdAt: document.createdAt.toISOString(),
  updatedAt: document.updatedAt.toISOString(),
});

const loadAppointmentForDocumentLookup = async (appointmentId: string) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      organisationId: true,
      patient: true,
    },
  });

  if (!appointment) {
    return null;
  }

  return {
    organisationId: appointment.organisationId,
    patientId: getPatientIdFromAppointment(appointment.patient),
  };
};

const loadRenderedAppointmentDocuments = async (params: {
  appointmentId: string;
  organisationId: string;
}) => {
  const renderedDocuments = (await prisma.renderedDocument.findMany({
    where: {
      organisationId: params.organisationId,
      OR: [
        {
          templateInstance: {
            is: { appointmentId: params.appointmentId },
          },
        },
        {
          clinicalArtifact: {
            is: { appointmentId: params.appointmentId },
          },
        },
      ],
    },
    include: {
      templateInstance: {
        select: {
          appointmentId: true,
          encounterId: true,
        },
      },
      clinicalArtifact: {
        select: {
          appointmentId: true,
          encounterId: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })) as unknown as RenderedDocumentRow[];

  return renderedDocuments.map(mapRenderedDocumentToDto);
};

const createDocumentRecord = async (
  input: CreateDocumentInput,
  context: DocumentCreateContext,
): Promise<DocumentDto> => {
  if (!isNonEmptyString(input.title)) {
    throw new DocumentServiceError("Document title is required.", 400);
  }

  if (!Array.isArray(input.attachments) || input.attachments.length === 0) {
    throw new DocumentServiceError("At least one attachment is required.", 400);
  }

  const patientId = normalizeStringId(input.patientId, "patientId");
  const appointmentId = input.appointmentId
    ? normalizeStringId(input.appointmentId, "appointmentId")
    : null;

  const category = input.category.toUpperCase();
  const subcategory = input.subcategory
    ? input.subcategory.toUpperCase()
    : null;
  validateCategoryAndSubcategory(category, subcategory);

  const issueDate = parseIssueDate(input.issueDate);
  const attachments: AttachmentInput[] = input.attachments.map((att) => ({
    key: String(att.key),
    mimeType: String(att.mimeType),
    size: typeof att.size === "number" ? att.size : undefined,
  }));

  const created = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        patientId,
        appointmentId: appointmentId ?? undefined,
        category,
        subcategory: subcategory ?? undefined,
        visitType: input.visitType ?? undefined,
        title: input.title.trim(),
        issuingBusinessName: input.issuingBusinessName?.trim() ?? undefined,
        issueDate: issueDate ?? undefined,
        uploadedByParentId: context.parentId ?? undefined,
        uploadedByPmsUserId: context.pmsUserId ?? undefined,
        pmsVisible: isPmsVisibleCategory(category),
        syncedFromPms: Boolean(context.pmsUserId),
      },
    });

    if (attachments.length > 0) {
      await tx.documentAttachment.createMany({
        data: attachments.map((attachment) => ({
          documentId: document.id,
          key: attachment.key,
          mimeType: attachment.mimeType,
          size: attachment.size,
        })),
      });
    }

    return tx.document.findUnique({
      where: { id: document.id },
      include: { attachments: true },
    });
  });

  if (!created) {
    throw new DocumentServiceError("Document not found.", 404);
  }

  if (context.organisationId) {
    await AuditTrailService.recordSafely({
      organisationId: context.organisationId,
      patientId: created.patientId,
      eventType: "DOCUMENT_ADDED",
      actorType: context.pmsUserId ? "PMS_USER" : "SYSTEM",
      actorId: context.pmsUserId ?? null,
      entityType: "DOCUMENT",
      entityId: created.id,
      metadata: {
        category: created.category,
        subcategory: created.subcategory,
        appointmentId: created.appointmentId,
        title: created.title,
      },
    });
  }

  return mapDocumentToDto(created);
};

const loadDocumentById = async (
  documentId: string,
): Promise<PrismaDocumentRow | null> => {
  const doc = (await prisma.document.findUnique({
    where: { id: normalizeStringId(documentId, "documentId") },
    include: { attachments: true },
  })) as unknown as PrismaDocumentRow | null;
  return doc;
};

const loadDocumentForParentAccess = async (
  documentId: string,
  parentId: string,
): Promise<DocumentDto | null> => {
  const doc = await loadDocumentById(documentId);
  if (!doc) {
    return null;
  }

  await assertParentCanAccessCompanion(parentId, doc.patientId);
  return mapDocumentToDto(doc);
};

const loadDocumentForPmsAccess = async (
  documentId: string,
  organisationId: string,
  requirePmsVisible = false,
): Promise<DocumentDto | null> => {
  const doc = await loadDocumentById(documentId);
  if (!doc || (requirePmsVisible && !doc.pmsVisible)) {
    return null;
  }

  await assertPmsCanAccessCompanion(organisationId, doc.patientId);
  return mapDocumentToDto(doc);
};

const syncDocumentAttachmentsToPostgres = async (
  documentId: string,
  attachments: AttachmentInput[],
) => {
  await prisma.documentAttachment.deleteMany({ where: { documentId } });
  if (!attachments.length) {
    return;
  }
  await prisma.documentAttachment.createMany({
    data: attachments.map((attachment) => ({
      documentId,
      key: attachment.key,
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
  });
};

export const DocumentService = {
  async create(
    input: CreateDocumentInput,
    context: DocumentCreateContext,
  ): Promise<DocumentDto> {
    return createDocumentRecord(input, context);
  },

  async listForParent(params: {
    patientId: string;
    parentId: string;
    category?: string;
    subcategory?: string;
  }): Promise<DocumentDto[]> {
    const patientId = normalizeStringId(params.patientId, "patientId");
    await assertParentCanAccessCompanion(params.parentId, patientId);

    const docs = (await prisma.document.findMany({
      where: {
        patientId,
        category: params.category ? params.category.toUpperCase() : undefined,
        subcategory: params.subcategory
          ? params.subcategory.toUpperCase()
          : undefined,
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      include: { attachments: true },
    })) as unknown as PrismaDocumentRow[];

    return docs.map(mapDocumentToDto);
  },

  async listForPms(params: {
    patientId: string;
    organisationId: string;
    category?: string;
    subcategory?: string;
    appointmentId?: string;
  }): Promise<DocumentDto[]> {
    const patientId = normalizeStringId(params.patientId, "patientId");
    await assertPmsCanAccessCompanion(params.organisationId, patientId);

    const docs = (await prisma.document.findMany({
      where: {
        patientId,
        pmsVisible: true,
        category: params.category ? params.category.toUpperCase() : undefined,
        subcategory: params.subcategory
          ? params.subcategory.toUpperCase()
          : undefined,
        appointmentId: params.appointmentId
          ? normalizeStringId(params.appointmentId, "appointmentId")
          : undefined,
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      include: { attachments: true },
    })) as unknown as PrismaDocumentRow[];

    return docs.map(mapDocumentToDto);
  },

  async getByIdForParent(
    id: string,
    parentId: string,
  ): Promise<DocumentDto | null> {
    return loadDocumentForParentAccess(id, parentId);
  },

  async getByIdForPms(
    id: string,
    organisationId: string,
  ): Promise<DocumentDto | null> {
    return loadDocumentForPmsAccess(id, organisationId, true);
  },

  async deleteForParent(id: string, parentId: string): Promise<boolean> {
    const doc = await prisma.document.findFirst({
      where: {
        id: normalizeStringId(id, "documentId"),
        uploadedByParentId: normalizeStringId(parentId, "parentId"),
      },
      select: { id: true, attachments: { select: { key: true } } },
    });

    if (!doc) {
      throw new DocumentServiceError(
        "Document not found or not deletable.",
        404,
      );
    }

    for (const attachment of doc.attachments) {
      await deleteFromS3(attachment.key);
    }

    await prisma.$transaction(async (tx) => {
      await tx.documentAttachment.deleteMany({ where: { documentId: doc.id } });
      await tx.document.deleteMany({ where: { id: doc.id } });
    });

    return true;
  },

  async listForAppointmentParent(params: {
    appointmentId: string;
    parentId: string;
  }): Promise<DocumentDto[]> {
    const appointmentId = normalizeStringId(
      params.appointmentId,
      "appointmentId",
    );
    const companionIds = await getParentAccessibleCompanionIds(params.parentId);
    const appointmentLookup =
      await loadAppointmentForDocumentLookup(appointmentId);

    if (!appointmentLookup) {
      return [];
    }

    if (
      appointmentLookup.patientId &&
      !companionIds.includes(appointmentLookup.patientId)
    ) {
      return [];
    }

    const [docs, renderedDocs] = await Promise.all([
      prisma.document.findMany({
        where: {
          appointmentId,
          patientId: { in: companionIds },
        },
        orderBy: { createdAt: "desc" },
        include: { attachments: true },
      }),
      loadRenderedAppointmentDocuments({
        appointmentId,
        organisationId: appointmentLookup.organisationId,
      }),
    ]);

    return [
      ...(docs as unknown as PrismaDocumentRow[]).map(mapDocumentToDto),
      ...renderedDocs,
    ].sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
  },

  async listForAppointmentPms(params: {
    appointmentId: string;
    organisationId: string;
    patientId?: string;
  }): Promise<DocumentDto[]> {
    const appointmentId = normalizeStringId(
      params.appointmentId,
      "appointmentId",
    );
    const companionIds = params.patientId
      ? [normalizeStringId(params.patientId, "patientId")]
      : await getOrganisationAccessibleCompanionIds(params.organisationId);
    const appointmentLookup =
      await loadAppointmentForDocumentLookup(appointmentId);

    if (params.patientId) {
      await assertPmsCanAccessCompanion(params.organisationId, companionIds[0]);
    }

    if (!appointmentLookup) {
      return [];
    }

    const [docs, renderedDocs] = await Promise.all([
      prisma.document.findMany({
        where: {
          patientId: { in: companionIds },
          appointmentId,
          pmsVisible: true,
        },
        orderBy: { createdAt: "desc" },
        include: { attachments: true },
      }),
      loadRenderedAppointmentDocuments({
        appointmentId,
        organisationId: appointmentLookup.organisationId,
      }),
    ]);

    return [
      ...(docs as unknown as PrismaDocumentRow[]).map(mapDocumentToDto),
      ...renderedDocs,
    ].sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
  },

  async update(
    id: string,
    updates: Partial<CreateDocumentInput>,
    context: DocumentCreateContext,
  ): Promise<DocumentDto> {
    const documentId = normalizeStringId(id, "documentId");
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { attachments: true },
    });

    if (!doc) {
      throw new DocumentServiceError("Document not found.", 404);
    }

    if (context.parentId) {
      await assertParentCanAccessCompanion(context.parentId, doc.patientId);
      if (doc.uploadedByParentId !== context.parentId) {
        throw new DocumentServiceError(
          "Parent is not allowed to update this document.",
          403,
        );
      }
    }

    if (context.pmsUserId) {
      if (!context.organisationId) {
        throw new DocumentServiceError("organisationId is required.", 400);
      }
      await assertPmsCanAccessCompanion(context.organisationId, doc.patientId);
      if (!doc.syncedFromPms) {
        throw new DocumentServiceError(
          "PMS cannot update documents uploaded by parent.",
          403,
        );
      }
    }

    const category = updates.category
      ? updates.category.toUpperCase()
      : doc.category;
    const subcategory =
      updates.subcategory !== undefined
        ? updates.subcategory
          ? updates.subcategory.toUpperCase()
          : null
        : doc.subcategory;

    if (updates.category || updates.subcategory !== undefined) {
      validateCategoryAndSubcategory(category, subcategory);
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        category,
        subcategory: subcategory ?? undefined,
        visitType:
          updates.visitType !== undefined
            ? (updates.visitType ?? null)
            : undefined,
        title: isNonEmptyString(updates.title)
          ? updates.title.trim()
          : undefined,
        issuingBusinessName:
          updates.issuingBusinessName !== undefined
            ? (updates.issuingBusinessName?.trim() ?? null)
            : undefined,
        issueDate:
          updates.issueDate !== undefined
            ? parseIssueDate(updates.issueDate)
            : undefined,
        pmsVisible: isPmsVisibleCategory(category),
      },
      include: { attachments: true },
    });

    if (Array.isArray(updates.attachments)) {
      await syncDocumentAttachmentsToPostgres(
        documentId,
        updates.attachments.map((attachment) => ({
          key: String(attachment.key),
          mimeType: String(attachment.mimeType),
          size: attachment.size,
        })),
      );
    }

    if (context.organisationId) {
      await AuditTrailService.recordSafely({
        organisationId: context.organisationId,
        patientId: updated.patientId,
        eventType: "DOCUMENT_UPDATED",
        actorType: context.pmsUserId ? "PMS_USER" : "SYSTEM",
        actorId: context.pmsUserId ?? null,
        entityType: "DOCUMENT",
        entityId: updated.id,
        metadata: {
          category: updated.category,
          subcategory: updated.subcategory,
          appointmentId: updated.appointmentId,
          title: updated.title,
        },
      });
    }

    return mapDocumentToDto(updated as unknown as PrismaDocumentRow);
  },

  async getAllAttachmentUrls(params: {
    documentId: string;
    parentId?: string;
    organisationId?: string;
  }) {
    const accessDoc = params.parentId
      ? await loadDocumentForParentAccess(params.documentId, params.parentId)
      : params.organisationId
        ? await loadDocumentForPmsAccess(
            params.documentId,
            params.organisationId,
            true,
          )
        : null;

    if (!accessDoc) {
      throw new DocumentServiceError("Document not found.", 404);
    }

    const document = await prisma.document.findUnique({
      where: { id: normalizeStringId(params.documentId, "documentId") },
      select: {
        attachments: {
          select: { key: true, mimeType: true, size: true },
        },
      },
    });

    const attachments = document?.attachments ?? [];
    if (!attachments.length) {
      throw new DocumentServiceError("No attachments found.", 404);
    }

    const urls = await Promise.all(
      attachments.map((attachment) =>
        generatePresignedDownloadUrl(attachment.key),
      ),
    );

    return urls.map((url, index) => ({
      url,
      mimeType: attachments[index].mimeType,
      key: attachments[index].key,
    }));
  },

  async getAttachmentUrlByKey(params: {
    key: string;
    parentId?: string;
    organisationId?: string;
  }): Promise<string> {
    if (!isNonEmptyString(params.key)) {
      throw new DocumentServiceError("Key is required.", 400);
    }

    const attachment = await prisma.documentAttachment.findFirst({
      where: { key: params.key },
      select: { documentId: true },
    });

    if (!attachment) {
      throw new DocumentServiceError("Attachment not found.", 404);
    }

    const accessDoc = params.parentId
      ? await loadDocumentForParentAccess(
          attachment.documentId,
          params.parentId,
        )
      : params.organisationId
        ? await loadDocumentForPmsAccess(
            attachment.documentId,
            params.organisationId,
            true,
          )
        : null;

    if (!accessDoc) {
      throw new DocumentServiceError("Attachment not found.", 404);
    }

    return generatePresignedDownloadUrl(params.key);
  },

  async searchByTitleForParent(params: {
    patientId: string;
    parentId: string;
    title: string;
  }): Promise<DocumentDto[]> {
    if (!isNonEmptyString(params.title)) {
      throw new DocumentServiceError("Search title is required.", 400);
    }

    const patientId = normalizeStringId(params.patientId, "patientId");
    await assertParentCanAccessCompanion(params.parentId, patientId);

    const docs = (await prisma.document.findMany({
      where: {
        patientId,
        title: {
          contains: params.title.trim(),
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
      include: { attachments: true },
    })) as unknown as PrismaDocumentRow[];

    return docs.map(mapDocumentToDto);
  },
};
