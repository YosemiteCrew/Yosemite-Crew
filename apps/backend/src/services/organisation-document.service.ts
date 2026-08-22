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

export type LegalDocumentType = "terms" | "privacy";

export interface LegalDocumentResponse {
  pdfUrl: string;
  version: string;
  lastUpdated: string;
}

export interface AcknowledgeOrgDocumentInput {
  organisationId: string;
  documentId: string;
  userId: string;
  category: OrgDocumentCategory;
  version: number;
}

export interface DocumentAcknowledgementStatus {
  acknowledged: boolean;
  version: number;
  acknowledgedAt?: Date;
}

const FIXED_LEGAL_DOCUMENTS: Record<
  LegalDocumentType,
  {
    pdfKey: string;
    version: string;
    lastUpdated: string;
  }
> = {
  terms: {
    pdfKey: "legal/terms-v1.pdf",
    version: "v1",
    lastUpdated: "2026-03-01",
  },
  privacy: {
    pdfKey: "legal/privacy-v1.pdf",
    version: "v1",
    lastUpdated: "2026-03-01",
  },
};

const ORG_DOCUMENT_PDF_SLUGS: Record<OrgDocumentCategory, string> = {
  TERMS_AND_CONDITIONS: "terms-and-conditions",
  PRIVACY_POLICY: "privacy-policy",
  CANCELLATION_POLICY: "cancellation-policy",
  FIRE_SAFETY: "fire-safety",
  GENERAL: "general",
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

const toOrganizationDocumentDocument = (doc: {
  id: string;
  organisationId: string;
  title: string;
  description: string | null;
  category: PrismaOrgDocumentCategory;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  pdfUrl: string | null;
  visibility: PrismaOrgDocumentVisibility;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationDocumentDocument => {
  const { id, ...rest } = doc;
  return {
    _id: id,
    organisationId: rest.organisationId,
    title: rest.title,
    description: rest.description ?? undefined,
    category: rest.category,
    fileUrl: rest.fileUrl ?? undefined,
    fileName: rest.fileName ?? undefined,
    fileType: rest.fileType ?? undefined,
    fileSize: rest.fileSize ?? undefined,
    pdfUrl: rest.pdfUrl ?? undefined,
    visibility: rest.visibility,
    version: rest.version,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
};

const buildOrganisationDocumentPdfUrl = (doc: {
  organisationId: string;
  category: PrismaOrgDocumentCategory;
  fileUrl: string | null;
  fileType: string | null;
  version: number;
}): string => {
  if (doc.fileType === "application/pdf" && doc.fileUrl) {
    return doc.fileUrl;
  }

  const slug = ORG_DOCUMENT_PDF_SLUGS[doc.category];
  return getURLForKey(
    `org-docs/${encodeURIComponent(doc.organisationId)}/${slug}-v${doc.version}.pdf`,
  );
};

const toOrganizationDocumentDocumentWithPdfUrl = (doc: {
  id: string;
  organisationId: string;
  title: string;
  description: string | null;
  category: PrismaOrgDocumentCategory;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  visibility: PrismaOrgDocumentVisibility;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationDocumentDocument =>
  toOrganizationDocumentDocument({
    ...doc,
    pdfUrl: buildOrganisationDocumentPdfUrl(doc),
  });

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
        category: input.category,
        fileUrl: input.fileUrl ?? undefined,
        fileName: input.fileName ?? undefined,
        fileType: input.fileType ?? undefined,
        fileSize: input.fileSize ?? undefined,
        visibility: input.visibility ?? "INTERNAL",
        version: 1,
      },
    });
    return toOrganizationDocumentDocumentWithPdfUrl(doc);
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

    return toOrganizationDocumentDocumentWithPdfUrl(updated);
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
    return toOrganizationDocumentDocumentWithPdfUrl(doc);
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
      where.category = input.category;
    }

    if (input.visibility && input.visibility !== "ALL") {
      where.visibility = input.visibility;
    }

    const docs = await prisma.organizationDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return docs.map((doc) => toOrganizationDocumentDocumentWithPdfUrl(doc));
  },

  /**
   * For mobile app: only PUBLIC documents for an org,
   * usually legal docs to show during onboarding / booking.
   */
  /**
   * The documents a practice publishes to pet owners.
   *
   * `visibility` is pinned to PUBLIC and is NOT a caller-supplied filter. It used
   * to be one, and it was optional: a mobile caller who omitted it - or asked for
   * INTERNAL outright - received every document the organisation holds, each with
   * a resolved PDF URL attached. Category stays caller-selectable; it only
   * narrows within what is already public.
   */
  async listPublicDocumentsForOrganisation(filter: {
    organisationId: string;
    category?: string;
  }): Promise<OrganizationDocumentDocument[]> {
    if (!filter.organisationId) {
      throw new OrgDocumentServiceError("organisationId is required", 400);
    }

    const where: {
      organisationId: string;
      category?: PrismaOrgDocumentCategory;
      visibility: PrismaOrgDocumentVisibility;
    } = {
      organisationId: filter.organisationId,
      visibility: "PUBLIC",
    };

    if (filter.category) {
      where.category = filter.category as PrismaOrgDocumentCategory;
    }

    const docs = await prisma.organizationDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return docs.map((doc) => toOrganizationDocumentDocumentWithPdfUrl(doc));
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
        category: input.category,
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
      visibility: input.visibility ?? existing.visibility,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
    });
  },

  /**
   * Fixed YC legal documents are static and pre-rendered as PDFs.
   */
  getFixedLegalDocument(type: LegalDocumentType): LegalDocumentResponse {
    const document = FIXED_LEGAL_DOCUMENTS[type];

    if (!document) {
      throw new OrgDocumentServiceError("Invalid legal document type", 400);
    }

    return {
      pdfUrl: getURLForKey(document.pdfKey),
      version: document.version,
      lastUpdated: document.lastUpdated,
    };
  },

  /**
   * Persist a user acknowledgment for a specific document version.
   */
  async acknowledgeDocument(input: AcknowledgeOrgDocumentInput): Promise<void> {
    const organisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const documentId = requireSafeString(input.documentId, "documentId");
    const userId = requireSafeString(input.userId, "userId");

    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new OrgDocumentServiceError("Invalid version", 400);
    }

    const document = await prisma.organizationDocument.findFirst({
      where: {
        id: documentId,
        organisationId,
      },
    });

    if (!document) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }

    // The acknowledgement records what the user actually saw, so the category and
    // version come from the DOCUMENT, never from the request. Trusting the
    // client's values let a mobile caller pre-acknowledge versions that did not
    // exist yet: when the practice later published that version, the backend
    // reported it as already accepted even though nobody had read it - and an
    // unbounded version number let one caller poison many rows for one document.
    //
    // A client that names a different version is stale rather than malicious, so
    // it gets a 409 telling it to re-fetch, instead of silently acknowledging
    // content the user was never shown.
    if (input.version !== document.version) {
      throw new OrgDocumentServiceError(
        "This document has changed since it was opened. Reload and review the current version.",
        409,
      );
    }

    await prisma.organizationDocumentAcknowledgement.upsert({
      where: {
        userId_organisationId_documentId_category_version: {
          userId,
          organisationId,
          documentId,
          category: document.category,
          version: document.version,
        },
      },
      create: {
        userId,
        organisationId,
        documentId,
        category: document.category,
        version: document.version,
      },
      update: {},
    });
  },

  /**
   * Return whether the current document version has already been acknowledged.
   */
  async getAcknowledgementStatus(input: {
    organisationId: string;
    documentId: string;
    userId: string;
  }): Promise<DocumentAcknowledgementStatus> {
    const organisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const documentId = requireSafeString(input.documentId, "documentId");
    const userId = requireSafeString(input.userId, "userId");

    const document = await prisma.organizationDocument.findFirst({
      where: {
        id: documentId,
        organisationId,
      },
    });

    if (!document) {
      throw new OrgDocumentServiceError("Document not found", 404);
    }

    const acknowledgement =
      await prisma.organizationDocumentAcknowledgement.findFirst({
        where: {
          userId,
          organisationId,
          documentId,
          category: document.category,
          version: document.version,
        },
        orderBy: {
          acknowledgedAt: "desc",
        },
      });

    return {
      acknowledged: Boolean(acknowledgement),
      version: document.version,
      acknowledgedAt: acknowledgement?.acknowledgedAt,
    };
  },
};
