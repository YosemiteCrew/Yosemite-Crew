import { Prisma } from "@prisma/client";
import AWS from "aws-sdk";
import { randomUUID } from "node:crypto";
import {
  awaitsClientSignature,
  hasActiveOrCompletedSigning,
  isOpenSigning,
  lockClientRequest,
} from "src/services/client-signature.helpers";
import axios from "axios";
import {
  buildDocumentSignature as buildDocumentSignatureContract,
  buildRenderedDocumentDraft as buildRenderedDocumentDraftContract,
  buildRenderedDocumentPdfSnapshot,
  isSignableRenderedDocumentKind,
  normalizeTemplateKind,
  toLegacyTemplateKind,
  signRenderedDocument as signRenderedDocumentContract,
  type BuildRenderedDocumentInput,
  type PersistRenderedDocumentInput,
  type PersistRenderedDocumentSignatureInput,
  type RenderedDocument,
  type RenderedDocumentKind,
  type RenderedDocumentSignature,
  type RenderedDocumentSigning,
  type RenderedDocumentSource,
  type SignRenderedDocumentInput,
} from "@yosemite-crew/types";
import type { ClinicalPdfSignaturePlacement } from "@yosemite-crew/lib";
import { prisma } from "src/config/prisma";
import { uploadBufferAsFile } from "src/middlewares/upload";
import {
  AuditTrailService,
  type AuditTrailRecordInput,
} from "src/services/audit-trail.service";
import { DocumensoService } from "src/services/documenso.service";
import { renderRenderedDocumentPdfWithMetadata } from "src/services/rendered-document-renderer.service";
import logger from "src/utils/logger";
import type { AuditEventType } from "src/models/audit-trail";
import {
  INVALID_OUTBOUND_DOCUMENT_URL_MESSAGE,
  readValidatedPdfResponse,
  resolveOutboundDocumentUrl,
  UNEXPECTED_DOCUMENT_RESPONSE_MESSAGE,
  type OutboundDocumentRequest,
  type OutboundDocumentResponse,
} from "src/utils/outbound-document-url";

export class RenderedDocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "RenderedDocumentServiceError";
  }
}

export type {
  BuildRenderedDocumentInput,
  DocumentSignatureSignerType,
  PersistRenderedDocumentInput,
  PersistRenderedDocumentSignatureInput,
  RenderedDocument,
  RenderedDocumentKind,
  RenderedDocumentPdfSnapshot,
  RenderedDocumentSignature,
  RenderedDocumentSigning,
  RenderedDocumentSigningProvider,
  RenderedDocumentSigningStatus,
  RenderedDocumentSource,
  RenderedDocumentSourceKind,
  RenderedDocumentStatus,
  SignRenderedDocumentInput,
} from "@yosemite-crew/types";

type RenderedDocumentWriteClient = Pick<
  Prisma.TransactionClient,
  | "renderedDocument"
  | "documentSignature"
  | "templateInstance"
  | "clinicalArtifact"
  | "case"
  | "encounter"
  | "appointment"
>;

type PersistedRenderedDocument = Prisma.RenderedDocumentGetPayload<{
  include: { signature: true };
}>;

export type RenderedDocumentPdfResult = {
  pdf: Buffer;
  filename: string;
  contentType: "application/pdf";
};

const renderedDocumentClient = prisma as unknown as RenderedDocumentWriteClient;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const getBucketName = (): string => {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) {
    throw new RenderedDocumentServiceError(
      "AWS_S3_BUCKET_NAME is not defined",
      500,
    );
  }
  return bucket;
};

const translateRenderedDocumentContractError = (
  error: unknown,
): RenderedDocumentServiceError => {
  if (error instanceof RenderedDocumentServiceError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : "Invalid rendered document input";

  switch (message) {
    case "Document kind is not signable":
    case "Document is already signed":
      return new RenderedDocumentServiceError(message, 409);
    case "Invalid title":
    case "Invalid organisationId":
    case "Invalid sourceId":
    case "Invalid documentId":
    case "Invalid signerId":
    case "Invalid signatureText":
    case "Unsupported rendered document kind":
    default:
      return new RenderedDocumentServiceError(message, 400);
  }
};

const withRenderedDocumentServiceError = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (error) {
    throw translateRenderedDocumentContractError(error);
  }
};

const normalizeRequiredString = (value: string, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new RenderedDocumentServiceError(`Invalid ${fieldName}`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new RenderedDocumentServiceError(`Invalid ${fieldName}`);
  }

  return normalized;
};

/**
 * Read the document from our own bucket when the stored link points at an
 * object we hold. `validatedUrl` must already have been through
 * `resolveOutboundDocumentUrl` — the object key is derived from it, so it can
 * only ever be derived from a checked, normalised URL. Returns `null` when the
 * object is not there, so the caller falls back to the bounded direct fetch.
 */
const readPdfFromBucket = async (
  validatedUrl: string,
): Promise<Buffer | null> => {
  try {
    const key = decodeURIComponent(
      new URL(validatedUrl).pathname.replace(/^\/+/, ""),
    );

    if (!key) {
      return null;
    }

    const response = await s3
      .getObject({
        Bucket: getBucketName(),
        Key: key,
      })
      .promise();

    if (response.Body) {
      if (Buffer.isBuffer(response.Body)) {
        return response.Body;
      }

      if (response.Body instanceof Uint8Array) {
        return Buffer.from(response.Body);
      }

      if (typeof response.Body === "string") {
        return Buffer.from(response.Body);
      }
    }
  } catch {
    // Not an object we hold. This covers public URLs and non-S3 sources.
  }

  return null;
};

/**
 * Confirm the bytes we are about to return are a PDF. An upstream that hands
 * back something else is an upstream fault rather than a bad request from our
 * caller, so this reports 502 while an unusable stored link reports 400.
 */
const toValidatedPdf = (response: OutboundDocumentResponse): Buffer => {
  try {
    return readValidatedPdfResponse(response);
  } catch (error) {
    throw new RenderedDocumentServiceError(
      error instanceof Error
        ? error.message
        : UNEXPECTED_DOCUMENT_RESPONSE_MESSAGE,
      502,
    );
  }
};

const downloadPdfBuffer = async (url: string): Promise<Buffer> => {
  // Resolve and validate the stored link first: nothing - not the bucket key,
  // not the request - is derived from an unchecked URL.
  let outbound: OutboundDocumentRequest;
  try {
    outbound = await resolveOutboundDocumentUrl(url);
  } catch (error) {
    throw new RenderedDocumentServiceError(
      error instanceof Error
        ? error.message
        : INVALID_OUTBOUND_DOCUMENT_URL_MESSAGE,
      400,
    );
  }

  const storedObject = await readPdfFromBucket(outbound.url);
  if (storedObject) {
    // No HTTP headers on this leg, so the leading bytes settle it on their own.
    return toValidatedPdf({ data: storedObject });
  }

  const response = await axios.get<ArrayBuffer>(
    outbound.url,
    outbound.requestOptions,
  );

  return toValidatedPdf(response);
};

type PersistedRenderedDocumentPdfSnapshot = {
  signaturePlacement?: ClinicalPdfSignaturePlacement | null;
};

const extractSignaturePlacement = (
  pdf: Prisma.JsonValue | null | undefined,
): ClinicalPdfSignaturePlacement | null => {
  if (!pdf || typeof pdf !== "object" || Array.isArray(pdf)) {
    return null;
  }

  const snapshot = pdf as PersistedRenderedDocumentPdfSnapshot;
  const placement = snapshot.signaturePlacement;

  if (
    !placement ||
    typeof placement !== "object" ||
    Array.isArray(placement) ||
    typeof placement.pageNumber !== "number" ||
    typeof placement.pageX !== "number" ||
    typeof placement.pageY !== "number" ||
    typeof placement.width !== "number" ||
    typeof placement.height !== "number"
  ) {
    return null;
  }

  return {
    pageNumber: placement.pageNumber,
    pageX: placement.pageX,
    pageY: placement.pageY,
    width: placement.width,
    height: placement.height,
  };
};

const resolvePersistedRenderedDocumentPdf = async (
  document: PersistedRenderedDocument,
): Promise<{
  pdf: Buffer;
  signaturePlacement?: ClinicalPdfSignaturePlacement;
}> => {
  if (document.pdfUrl) {
    const signaturePlacement = extractSignaturePlacement(document.pdf);

    if (
      document.sourceKind === "CLINICAL_ARTIFACT" &&
      signaturePlacement === null
    ) {
      throw new RenderedDocumentServiceError(
        "Rendered clinical document is missing signature placement metadata",
        409,
      );
    }

    return {
      pdf: await downloadPdfBuffer(document.pdfUrl),
      signaturePlacement: signaturePlacement ?? undefined,
    };
  }

  if (document.sourceKind === "CLINICAL_ARTIFACT") {
    throw new RenderedDocumentServiceError(
      "Rendered clinical document PDF is not available yet",
      409,
    );
  }

  const renderedPdf = await renderRenderedDocumentPdfWithMetadata({
    title: document.title,
    source: {
      sourceKind: document.sourceKind,
      sourceId: document.sourceId,
      organisationId: document.organisationId,
      templateKind: document.kind as RenderedDocumentSource["templateKind"],
      templateId: document.templateId,
      templateVersion: document.templateVersion,
      templateVersionId: document.templateVersionId,
    },
  });

  return {
    pdf: renderedPdf.pdf,
    signaturePlacement: renderedPdf.signaturePlacement,
  };
};

// Where a record's own guards (#3633) read it from.
export { hasActiveOrCompletedSigning };

const parseRenderedDocumentSigning = (
  value: unknown,
): RenderedDocumentSigning | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RenderedDocumentSigning)
    : null;

const rerenderAndPersistClinicalRenderedDocumentPdf = async (
  document: PersistedRenderedDocument,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<RenderedDocumentPdfResult> => {
  if (document.sourceKind !== "CLINICAL_ARTIFACT") {
    throw new RenderedDocumentServiceError(
      "Rendered document is not a clinical artifact",
      409,
    );
  }

  // Re-rendering overwrites pdfUrl in place, which would replace the bytes a
  // signature already attests to (or that Documenso is mid-way through signing).
  if (hasActiveOrCompletedSigning(document)) {
    throw new RenderedDocumentServiceError(
      "Rendered document is signed or being signed and cannot be re-rendered",
      409,
    );
  }

  const renderedPdf = await renderRenderedDocumentPdfWithMetadata({
    title: document.title,
    source: {
      sourceKind: document.sourceKind,
      sourceId: document.sourceId,
      organisationId: document.organisationId,
      templateKind: document.kind as RenderedDocumentSource["templateKind"],
      templateId: document.templateId,
      templateVersion: document.templateVersion,
      templateVersionId: document.templateVersionId,
    },
  });

  const upload = await uploadBufferAsFile(renderedPdf.pdf, {
    folderName: `rendered-documents/${document.organisationId}`,
    mimeType: "application/pdf",
    originalName: `${document.kind.toLowerCase().replaceAll("_", "-")}-${document.id}.pdf`,
  });

  const pdfSnapshot = {
    ...buildRenderedDocumentPdfSnapshot({
      title: document.title,
      kind: document.kind as RenderedDocumentKind,
      source: {
        sourceKind: document.sourceKind,
        sourceId: document.sourceId,
        organisationId: document.organisationId,
        templateKind: document.kind as RenderedDocumentSource["templateKind"],
        templateId: document.templateId,
        templateVersion: document.templateVersion,
        templateVersionId: document.templateVersionId,
      },
    }),
    signaturePlacement: renderedPdf.signaturePlacement ?? null,
  };

  await client.renderedDocument.update({
    where: { id: document.id },
    data: {
      pdfUrl: upload.url,
      pdf: pdfSnapshot,
    },
  });

  return {
    pdf: renderedPdf.pdf,
    filename: `${document.kind.toLowerCase().replaceAll("_", "-")}-${document.id}.pdf`,
    contentType: "application/pdf",
  };
};

export {
  buildRenderedDocumentPdfSnapshot,
  isSignableRenderedDocumentKind,
} from "@yosemite-crew/types";

export const buildRenderedDocumentDraft = (
  input: BuildRenderedDocumentInput,
): RenderedDocument =>
  withRenderedDocumentServiceError(() =>
    buildRenderedDocumentDraftContract(input),
  );

export const buildDocumentSignature = (
  documentId: string,
  input: SignRenderedDocumentInput,
): RenderedDocumentSignature =>
  withRenderedDocumentServiceError(() =>
    buildDocumentSignatureContract(documentId, input),
  );

export const signRenderedDocument = (
  document: RenderedDocument,
  input: SignRenderedDocumentInput,
): RenderedDocument =>
  withRenderedDocumentServiceError(() =>
    signRenderedDocumentContract(document, input),
  );

const toRenderedDocumentCreateData = (
  input: PersistRenderedDocumentInput,
  draft: RenderedDocument,
): Prisma.RenderedDocumentUncheckedCreateInput => ({
  id: draft.id,
  organisationId: draft.organisationId,
  sourceKind: draft.source.sourceKind,
  sourceId: draft.source.sourceId,
  templateInstanceId: input.templateInstanceId ?? undefined,
  clinicalArtifactId: input.clinicalArtifactId ?? undefined,
  templateId: draft.source.templateId ?? undefined,
  templateVersion: draft.source.templateVersion ?? undefined,
  templateVersionId: draft.source.templateVersionId ?? undefined,
  kind: draft.kind === "INVOICE" ? "INVOICE" : toLegacyTemplateKind(draft.kind),
  version: draft.version,
  title: draft.title,
  mimeType: draft.mimeType,
  status: draft.status,
  signable: draft.signable,
  pdfUrl: input.pdfUrl ?? undefined,
  pdf:
    input.pdf === undefined
      ? buildRenderedDocumentPdfSnapshot(draft)
      : (input.pdf as Prisma.InputJsonValue),
  signedBy: draft.signedBy ?? undefined,
  signedAt: draft.signedAt ?? undefined,
  signing: draft.signing ?? undefined,
});

const normalizePersistedRenderedDocument = (
  document: PersistedRenderedDocument,
): PersistedRenderedDocument => ({
  ...document,
  kind: normalizeTemplateKind(
    document.kind,
  ) as PersistedRenderedDocument["kind"],
});

export const createRenderedDocumentRecord = async (
  input: PersistRenderedDocumentInput,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const draft = buildRenderedDocumentDraft(input);

  return client.renderedDocument.create({
    data: toRenderedDocumentCreateData(input, draft),
    include: { signature: true },
  });
};

/**
 * `null` selects the unscoped read and is only legitimate for callers that have
 * no organisation context at all (the Documenso completion webhook, which
 * resolves the document from the provider's own reference). It is spelled out
 * rather than defaulted so that omitting the tenant scope cannot happen by
 * accident.
 */
export type RenderedDocumentOrgScope = string | null;

export const getPersistedRenderedDocument = async (
  renderedDocumentId: string,
  organisationId: RenderedDocumentOrgScope,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const document = await client.renderedDocument.findUnique({
    where: {
      id: normalizeRequiredString(renderedDocumentId, "renderedDocumentId"),
    },
    include: { signature: true },
  });

  if (!document) {
    throw new RenderedDocumentServiceError("Rendered document not found", 404);
  }

  if (
    organisationId !== null &&
    document.organisationId !==
      normalizeRequiredString(organisationId, "organisationId")
  ) {
    throw new RenderedDocumentServiceError(
      "Rendered document does not belong to organisation",
      403,
    );
  }

  return normalizePersistedRenderedDocument(document);
};

export type RenderedDocumentReadDto = Omit<
  PersistedRenderedDocument,
  "signing"
> & {
  signing: {
    required: boolean;
    provider: string | null;
    status: string;
    signerName: string | null;
  } | null;
};

/**
 * `signing.signingUrl` embeds the Documenso recipient token — a bearer
 * credential that lets whoever holds it sign the document. Read paths return
 * the signing state without it (and without the signer's address), so a
 * view-only permission never yields the means to sign.
 */
export const toRenderedDocumentReadDto = (
  document: PersistedRenderedDocument,
): RenderedDocumentReadDto => {
  const signing = parseRenderedDocumentSigning(document.signing);

  return {
    ...document,
    signing: signing
      ? {
          required: Boolean(signing.required),
          provider: signing.provider ?? null,
          status: signing.status ?? "NOT_STARTED",
          signerName: signing.signerName ?? null,
        }
      : null,
  };
};

export const getPersistedRenderedDocumentPdf = async (
  renderedDocumentId: string,
  organisationId: RenderedDocumentOrgScope,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<RenderedDocumentPdfResult> => {
  const document = await getPersistedRenderedDocument(
    renderedDocumentId,
    organisationId,
    client,
  );

  if (document.pdfUrl) {
    return {
      pdf: await downloadPdfBuffer(document.pdfUrl),
      filename: `${document.kind.toLowerCase().replaceAll("_", "-")}-${document.id}.pdf`,
      contentType: "application/pdf",
    };
  }

  if (document.sourceKind === "CLINICAL_ARTIFACT") {
    throw new RenderedDocumentServiceError(
      "Rendered clinical document PDF is not available yet",
      409,
    );
  }

  const renderedPdf = await renderRenderedDocumentPdfWithMetadata({
    title: document.title,
    source: {
      sourceKind: document.sourceKind,
      sourceId: document.sourceId,
      organisationId: document.organisationId,
      templateKind: document.kind as RenderedDocumentSource["templateKind"],
      templateId: document.templateId,
      templateVersion: document.templateVersion,
      templateVersionId: document.templateVersionId,
    },
  });

  return {
    pdf: renderedPdf.pdf,
    filename: `${document.kind.toLowerCase().replaceAll("_", "-")}-${document.id}.pdf`,
    contentType: "application/pdf",
  };
};

export const rerenderPersistedClinicalRenderedDocumentPdf = async (
  renderedDocumentId: string,
  organisationId: string,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<RenderedDocumentPdfResult> => {
  const document = await getPersistedRenderedDocument(
    renderedDocumentId,
    organisationId,
    client,
  );

  return rerenderAndPersistClinicalRenderedDocumentPdf(document, client);
};

type ClinicalRecordLinkage = {
  appointmentId: string | null;
  caseId: string | null;
  encounterId: string | null;
};

type LinkedRecord = ClinicalRecordLinkage & {
  status: string;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const LINKED_RECORD_SELECT = {
  status: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  appointmentId: true,
  caseId: true,
  encounterId: true,
} as const;

/**
 * The TemplateInstance or ClinicalArtifact a rendered document was produced
 * from (at most one of the two - the FKs are mutually exclusive by
 * construction). `null` for a document with neither link
 * (FORM_SUBMISSION/TASK_SCHEDULE/INVOICE-sourced).
 */
const findLinkedRecord = async (
  client: RenderedDocumentWriteClient,
  document: Pick<
    PersistedRenderedDocument,
    "templateInstanceId" | "clinicalArtifactId"
  >,
): Promise<LinkedRecord | null> => {
  if (document.templateInstanceId) {
    return client.templateInstance.findUnique({
      where: { id: document.templateInstanceId },
      select: LINKED_RECORD_SELECT,
    });
  }
  if (document.clinicalArtifactId) {
    return client.clinicalArtifact.findUnique({
      where: { id: document.clinicalArtifactId },
      select: LINKED_RECORD_SELECT,
    });
  }
  return null;
};

/**
 * Who wrote the record a rendered document was produced from, so a route can
 * apply the same own-scope rule that record's own routes apply. `null` when the
 * document has no linked record or the record has no author.
 */
export const getRenderedDocumentSourceAuthorId = async (
  document: Pick<
    PersistedRenderedDocument,
    "templateInstanceId" | "clinicalArtifactId"
  >,
): Promise<string | null> =>
  (await findLinkedRecord(renderedDocumentClient, document))?.authorId ?? null;

export const signPersistedRenderedDocument = async (
  input: PersistRenderedDocumentSignatureInput,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  // The shared signature contract still types `organisationId` as optional, but
  // signing is never legitimately unscoped.
  if (!input.organisationId?.trim()) {
    throw new RenderedDocumentServiceError("organisationId is required", 400);
  }

  const existing = await getPersistedRenderedDocument(
    input.renderedDocumentId,
    input.organisationId,
    client,
  );
  const kind = existing.kind as RenderedDocumentKind;

  if (!isSignableRenderedDocumentKind(kind)) {
    throw new RenderedDocumentServiceError(
      "Document kind is not signable",
      409,
    );
  }

  if (existing.status === "SIGNED") {
    throw new RenderedDocumentServiceError("Document is already signed", 409);
  }

  // A consent records the client's agreement, and a form the practice asked
  // the client to sign is theirs to sign, so only the client signs either.
  if (
    input.signerType !== "PARENT" &&
    (await awaitsClientSignature(existing))
  ) {
    throw new RenderedDocumentServiceError(
      "This document is signed by the client",
      409,
    );
  }

  if (isOpenSigning(existing.signing)) {
    throw signingInProgress();
  }

  // Signing attests the record, so it starts from a finalised one: never a
  // draft, a reopened record, one already signed, or a VOID (cancelled or
  // superseded) one. COMPLETED is also the only status completion moves on.
  const linked = await findLinkedRecord(client, existing);
  if (linked && linked.status !== "COMPLETED") {
    throw new RenderedDocumentServiceError(
      "Only a finalised record that is not yet signed can be sent for signing",
      409,
    );
  }

  const apiKey = await DocumensoService.resolveOrganisationApiKey(
    existing.organisationId,
  );

  if (!apiKey) {
    throw new RenderedDocumentServiceError(
      "Documenso API key not configured for organisation",
      400,
    );
  }

  // Claimed before Documenso is called: of two requests that both read the
  // document unsigned, the second matches nothing once the first has claimed
  // it, so one document is sent and one signing link exists.
  const claimId = randomUUID();
  const claimed = await client.renderedDocument.updateMany({
    where: { id: existing.id, updatedAt: existing.updatedAt },
    data: {
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "IN_PROGRESS",
        signerId: input.signerId,
        signerType: input.signerType,
        claimId,
        claimedAt: new Date().toISOString(),
      },
    },
  });
  if (claimed.count === 0) {
    return openSigningFor(existing.id, input.signerId, client);
  }

  try {
    return await sendClaimedDocumentForSigning(
      existing,
      input,
      linked,
      apiKey,
      claimId,
      client,
    );
  } catch (error) {
    // Nothing was sent, or the send did not complete: let it be tried again.
    await client.renderedDocument.updateMany({
      where: {
        id: existing.id,
        signing: { path: ["claimId"], equals: claimId },
      },
      data: {
        signing:
          existing.signing === null
            ? Prisma.DbNull
            : (existing.signing as Prisma.InputJsonValue),
      },
    });
    throw error;
  }
};

const signingInProgress = () =>
  new RenderedDocumentServiceError(
    "Document signing is already in progress",
    409,
  );

/**
 * The request that lost the claim. The signing the winner sent is handed to
 * the same signer; anyone else, or a signing still being sent, is refused.
 */
const openSigningFor = async (
  renderedDocumentId: string,
  signerId: string,
  client: RenderedDocumentWriteClient,
): Promise<PersistedRenderedDocument> => {
  const current = await client.renderedDocument.findUnique({
    where: { id: renderedDocumentId },
    include: { signature: true },
  });
  const signing = parseRenderedDocumentSigning(current?.signing);
  if (
    current &&
    signing?.status === "IN_PROGRESS" &&
    signing.documentId &&
    signing.signerId === signerId
  ) {
    return normalizePersistedRenderedDocument(current);
  }
  throw signingInProgress();
};

const sendClaimedDocumentForSigning = async (
  existing: PersistedRenderedDocument,
  input: PersistRenderedDocumentSignatureInput,
  linked: LinkedRecord | null,
  apiKey: string,
  claimId: string,
  client: RenderedDocumentWriteClient,
): Promise<PersistedRenderedDocument> => {
  const kind = existing.kind as RenderedDocumentKind;
  const renderedPdf = await resolvePersistedRenderedDocumentPdf(existing);
  const renderedPdfSnapshot = {
    ...buildRenderedDocumentPdfSnapshot({
      title: existing.title,
      kind,
      source: {
        sourceKind: existing.sourceKind,
        sourceId: existing.sourceId,
        organisationId: existing.organisationId,
        templateKind: existing.kind as RenderedDocumentKind,
        templateId: existing.templateId,
        templateVersion: existing.templateVersion,
        templateVersionId: existing.templateVersionId,
      },
    }),
    signaturePlacement: renderedPdf.signaturePlacement ?? null,
  };

  const doc = await DocumensoService.createDocument({
    pdf: renderedPdf.pdf,
    signerEmail: input.signerEmail,
    signerName: input.signerName,
    apiKey,
    signaturePlacement: renderedPdf.signaturePlacement,
    title: existing.title,
  });

  if (!doc || typeof doc.id !== "number") {
    throw new RenderedDocumentServiceError(
      "Unable to create Documenso document",
      502,
    );
  }

  const documensoPublicBaseUrl =
    process.env.DOCUMENSO_URL ??
    process.env.DOCUMENSO_HOST_URL ??
    process.env.DOCUMENSO_BASE_URL ??
    "";
  const signingUrl =
    documensoPublicBaseUrl && doc.recipients?.[0]?.token
      ? `${documensoPublicBaseUrl}/sign/${doc.recipients[0].token}`
      : null;

  // Recorded before the document is sent to the signer, and only while this
  // request still holds the claim. A request slow enough for its claim to be
  // taken over stops here: its Documenso document is never sent.
  const recorded = await client.renderedDocument
    .update({
      where: {
        id: existing.id,
        signing: { path: ["claimId"], equals: claimId },
      },
      data: {
        pdf: renderedPdfSnapshot,
        signing: {
          required: true,
          provider: "DOCUMENSO",
          status: "IN_PROGRESS",
          documentId: doc.id.toString(),
          signerId: input.signerId,
          signerType: input.signerType,
          signerEmail: input.signerEmail,
          signerName: input.signerName,
          signingUrl,
          signatureText: input.signatureText ?? null,
          // The revision of the record the signer is shown. Completion only
          // marks the record signed while it still stands at this revision.
          sourceRevision: linked ? linked.updatedAt.toISOString() : null,
          // Kept so a failed send can still be released.
          claimId,
        } satisfies PinnedRenderedDocumentSigning,
      },
      include: { signature: true },
    })
    .catch((error: unknown) => {
      throw isRecordNotFoundError(error) ? signingInProgress() : error;
    });

  await DocumensoService.distributeDocument({
    envelopeId: doc.envelopeId,
    apiKey,
  });

  return normalizePersistedRenderedDocument(recorded);
};

/** The RenderedDocumentKind-shaped audit event for the (rare) kinds that have one; every
 * other kind still gets audited, just under the generic DOCUMENT_UPDATED event. */
const RENDERED_DOCUMENT_SIGNED_AUDIT_EVENT: Partial<
  Record<PersistedRenderedDocument["kind"], AuditEventType>
> = {
  CONSENT: "CONSENT_FORM_SIGNED",
  PRESCRIPTION: "PRESCRIPTION_SIGNED",
};

const extractAppointmentPatientId = (patient: unknown): string | null => {
  if (patient && typeof patient === "object" && "id" in patient) {
    const id = (patient as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id : null;
  }
  return null;
};

/**
 * A RenderedDocument carries no patientId of its own - only the TemplateInstance
 * or ClinicalArtifact it is linked to does, and even then only via
 * appointmentId/caseId/encounterId (the same three-way linkage
 * loadRenderedDocumentsForPatientRecords in document.service.ts reads on the
 * way back out). Best-effort: a signed document with no resolvable patient -
 * an org-level template with no clinical linkage at all - audits nothing
 * rather than fabricating an id.
 */
const resolvePatientIdForSignedDocument = async (
  client: RenderedDocumentWriteClient,
  linkage: ClinicalRecordLinkage,
): Promise<string | null> => {
  if (linkage.caseId) {
    const found = await client.case.findUnique({
      where: { id: linkage.caseId },
      select: { patientId: true },
    });
    if (found?.patientId) return found.patientId;
  }
  if (linkage.encounterId) {
    const found = await client.encounter.findUnique({
      where: { id: linkage.encounterId },
      select: { patientId: true },
    });
    if (found?.patientId) return found.patientId;
  }
  if (linkage.appointmentId) {
    const found = await client.appointment.findUnique({
      where: { id: linkage.appointmentId },
      select: { patient: true },
    });
    const patientId = extractAppointmentPatientId(found?.patient);
    if (patientId) return patientId;
  }
  return null;
};

/** `signing` as stored on a rendered document, with the pinned revision. */
type PinnedRenderedDocumentSigning = RenderedDocumentSigning & {
  sourceRevision?: string | null;
  claimId?: string;
};

/**
 * The pinned revision as a timestamp, or `null` when there is none or it does
 * not parse. A signing started without one is never matched to its record.
 */
const parseSourceRevision = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const revision = new Date(value);
  return Number.isNaN(revision.getTime()) ? null : revision;
};

/**
 * Moves the TemplateInstance/ClinicalArtifact a just-signed RenderedDocument is
 * linked to on to SIGNED, and reports whether it moved. It only moves while it
 * is still COMPLETED at the revision pinned when signing started, both in the
 * WHERE, so a record reopened, edited, voided or superseded while the signature
 * was outstanding (even one finalised again since) keeps its status, and so
 * does one whose change commits concurrently. Returns `true` for a document
 * with no linked record.
 */
const propagateSigningCompletionToLinkedRecord = async (
  client: RenderedDocumentWriteClient,
  existing: PersistedRenderedDocument,
  sourceRevision: Date | null,
  signedBy: string | undefined,
  signedAt: Date,
): Promise<boolean> => {
  if (!existing.templateInstanceId && !existing.clinicalArtifactId) {
    return true;
  }
  // Prisma drops a filter whose value is undefined, so a missing revision must
  // not reach the WHERE: it would widen the claim to any COMPLETED revision.
  if (!sourceRevision) {
    return false;
  }
  const moved = existing.templateInstanceId
    ? await client.templateInstance.updateMany({
        where: {
          id: existing.templateInstanceId,
          status: "COMPLETED",
          updatedAt: sourceRevision,
        },
        data: { status: "SIGNED", signedBy, signedAt },
      })
    : await client.clinicalArtifact.updateMany({
        where: {
          id: String(existing.clinicalArtifactId),
          status: "COMPLETED",
          updatedAt: sourceRevision,
        },
        // See the artifact's `version` column (#3144): signing is a generation.
        data: {
          status: "SIGNED",
          signedBy,
          signedAt,
          version: { increment: 1 },
        },
      });
  return moved.count > 0;
};

const recordRenderedDocumentAuditSafely = async (
  client: RenderedDocumentWriteClient,
  existing: PersistedRenderedDocument,
  linkage: ClinicalRecordLinkage | null,
  event: Pick<AuditTrailRecordInput, "eventType" | "actorType" | "metadata">,
): Promise<void> => {
  if (!linkage) return;
  const patientId = await resolvePatientIdForSignedDocument(client, linkage);
  if (!patientId) return;

  await AuditTrailService.recordSafely({
    organisationId: existing.organisationId,
    patientId,
    entityType: "DOCUMENT",
    entityId: existing.id,
    ...event,
  });
};

/** The claim on a document still awaiting this very Documenso document. */
const awaitingSignatureWhere = (
  renderedDocumentId: string,
  documentId: string,
): Prisma.RenderedDocumentWhereUniqueInput => ({
  id: String(renderedDocumentId),
  status: { not: "SIGNED" },
  AND: [
    { signing: { path: ["documentId"], equals: String(documentId) } },
    { signing: { path: ["status"], equals: "IN_PROGRESS" } },
  ],
});

/**
 * Returns a signing request to not started, so the document can be sent for
 * signing again. Only while the document still awaits that same Documenso
 * document, so a late or out-of-order event for it changes nothing once it is
 * signed, withdrawn or replaced. Reports whether anything was withdrawn.
 */
export const withdrawPersistedRenderedDocumentSigning = async (
  renderedDocumentId: string,
  documentId: string,
): Promise<boolean> => {
  const withdrawn = await renderedDocumentClient.renderedDocument.updateMany({
    where: awaitingSignatureWhere(renderedDocumentId, documentId),
    data: {
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "NOT_STARTED",
        documentId: String(documentId),
      },
    },
  });
  return withdrawn.count > 0;
};

/**
 * A signed copy whose record changed while the signature was outstanding is
 * not kept. The document goes back to not started, so the record can be sent
 * for signing again once it is finalised, and the discard is logged and
 * audited. Conditional on the document still awaiting this Documenso document,
 * so a concurrent completion or a newer signing request is left alone.
 */
const releaseDiscardedSigning = async (
  existing: PersistedRenderedDocument,
  documentId: string,
): Promise<void> => {
  if (
    !(await withdrawPersistedRenderedDocumentSigning(existing.id, documentId))
  ) {
    return;
  }

  logger.warn(
    "[RenderedDocument] Signed copy discarded: the record changed while the signature was outstanding",
    { renderedDocumentId: existing.id },
  );
  await recordRenderedDocumentAuditSafely(
    renderedDocumentClient,
    existing,
    await findLinkedRecord(renderedDocumentClient, existing),
    {
      eventType: "DOCUMENT_UPDATED",
      actorType: "SYSTEM",
      metadata: {
        renderedDocumentId: existing.id,
        kind: existing.kind,
        outcome: "SIGNATURE_DISCARDED",
      },
    },
  );
};

/**
 * A client's signature on a form or consent completes what the practice sent
 * them for that appointment, so the assignment reads signed and no longer
 * holds up finalising the visit. Only the client's own signature does this: a
 * signature by practice staff, or the discharge packet's, never does.
 */
/**
 * Whether a newer submission of the same form for the same appointment, by
 * someone other than the signer, is the one waiting for their signature. The
 * client signs their own submission, or else the latest the practice
 * completed for them: a practice correction saved after a first version
 * supersedes that version for the request.
 */
export const hasNewerSubmissionForSigner = async (
  client: Pick<Prisma.TransactionClient, "templateInstance">,
  instance: {
    id: string;
    organisationId: string;
    templateId: string;
    appointmentId: string;
    authorId: string | null;
    createdAt: Date;
  },
  signerId: string,
): Promise<boolean> => {
  if (instance.authorId === signerId) return false;
  const newer = await client.templateInstance.count({
    where: {
      id: { not: instance.id },
      organisationId: instance.organisationId,
      templateId: instance.templateId,
      appointmentId: instance.appointmentId,
      status: { in: ["COMPLETED", "SIGNED"] },
      createdAt: { gt: instance.createdAt },
      OR: [{ authorId: null }, { authorId: { not: signerId } }],
    },
  });
  return newer > 0;
};

const markClientAssignmentsSigned = async (
  tx: Pick<Prisma.TransactionClient, "formAssignment" | "templateInstance">,
  existing: PersistedRenderedDocument,
  signing: PinnedRenderedDocumentSigning,
  linked: LinkedRecord | null,
  signedAt: Date,
): Promise<void> => {
  if (
    signing.signerType !== "PARENT" ||
    !signing.signerId ||
    !existing.templateId ||
    !existing.templateInstanceId ||
    !linked?.appointmentId
  ) {
    return;
  }
  // A version the practice has since corrected no longer answers the request.
  if (
    await hasNewerSubmissionForSigner(
      tx,
      {
        id: existing.templateInstanceId,
        organisationId: existing.organisationId,
        templateId: existing.templateId,
        appointmentId: linked.appointmentId,
        authorId: linked.authorId,
        createdAt: linked.createdAt,
      },
      signing.signerId,
    )
  ) {
    return;
  }
  await tx.formAssignment.updateMany({
    where: {
      organisationId: existing.organisationId,
      templateId: existing.templateId,
      appointmentId: linked.appointmentId,
      status: { in: ["SENT", "VIEWED", "SUBMITTED"] },
    },
    data: { status: "SIGNED", signedAt },
  });
};

/**
 * Takes the lock a submission of the same form for the same appointment
 * takes, so a practice correction saved while a signature completes is seen
 * by it, or sees the request it answered.
 */
const lockRequestOfDocument = async (
  tx: Prisma.TransactionClient,
  existing: PersistedRenderedDocument,
): Promise<void> => {
  if (!existing.templateId || !existing.templateInstanceId) return;
  const instance = await tx.templateInstance.findUnique({
    where: { id: existing.templateInstanceId },
    select: { appointmentId: true },
  });
  if (!instance?.appointmentId) return;
  await lockClientRequest(tx, {
    organisationId: existing.organisationId,
    templateId: existing.templateId,
    appointmentId: instance.appointmentId,
  });
};

/** Rolls the completion transaction back when there is nothing to complete. */
class SigningCompletionSkipped extends Error {
  /** `true` when the linked record no longer matches what was signed. */
  constructor(readonly recordChanged: boolean) {
    super("Signing completion skipped");
  }
}

const isRecordNotFoundError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2025";

/** The signed PDF Documenso holds for a completed signing request. */
const downloadSignedCopy = async (
  organisationId: string,
  documentId: string,
): Promise<{ downloadUrl?: string | null }> => {
  const apiKey =
    await DocumensoService.resolveOrganisationApiKey(organisationId);

  if (!apiKey) {
    throw new RenderedDocumentServiceError(
      "Documenso API key not configured for organisation",
      400,
    );
  }

  const signedPdf = await DocumensoService.downloadSignedDocument({
    documentId: Number.parseInt(documentId, 10),
    apiKey,
  });

  if (!signedPdf) {
    throw new RenderedDocumentServiceError(
      "Unable to download signed document",
      502,
    );
  }

  return signedPdf;
};

const buildSignatureData = (
  existing: PersistedRenderedDocument,
  signing: PinnedRenderedDocumentSigning,
  signedAt: Date,
) => {
  const signature = buildDocumentSignature(existing.id, {
    signerId:
      signing.signerId ?? signing.signerEmail ?? existing.signedBy ?? "",
    signerType: signing.signerType ?? "PMS_USER",
    signatureText: signing.signatureText,
    signedAt,
  });
  return {
    signerId: signature.signerId,
    signerType: signature.signerType,
    signatureText: signature.signatureText,
    signedAt: signature.signedAt,
  };
};

/**
 * Marks the document signed. Claimed on the status and on this Documenso
 * document, so of two deliveries that both read the document unsigned the
 * second matches nothing once the first commits, and a stale event for an
 * earlier signing request never completes a newer one.
 */
const claimSignedDocument = async (
  tx: RenderedDocumentWriteClient,
  existing: PersistedRenderedDocument,
  signing: PinnedRenderedDocumentSigning,
  documentId: string,
  signed: SignedCopy,
): Promise<Omit<PersistedRenderedDocument, "signature">> => {
  try {
    return await tx.renderedDocument.update({
      where: awaitingSignatureWhere(existing.id, documentId),
      data: {
        status: "SIGNED",
        signedBy: signed.by,
        signedAt: signed.at,
        pdfUrl: signed.pdfUrl ?? existing.pdfUrl ?? undefined,
        signing: {
          ...signing,
          status: "SIGNED",
          pdf: { url: signed.pdfUrl },
        },
      },
    });
  } catch (error) {
    throw isRecordNotFoundError(error)
      ? new SigningCompletionSkipped(false)
      : error;
  }
};

type SignedCopy = { by: string | undefined; at: Date; pdfUrl: string | null };

type CompletedSigning = {
  document: PersistedRenderedDocument;
  linked: LinkedRecord | null;
};

/**
 * The signing request a completion acts on, or `null` when there is nothing to
 * complete. Only a signing still awaiting its signature completes: one already
 * signed, withdrawn or discarded is left as it is, whatever order events
 * arrive in.
 */
const readOpenSigning = (
  existing: PersistedRenderedDocument,
): { signing: PinnedRenderedDocumentSigning; documentId: string } | null => {
  if (!existing.signing) {
    throw new RenderedDocumentServiceError("Document signing not started", 409);
  }

  const signing = existing.signing as PinnedRenderedDocumentSigning;
  if (existing.status === "SIGNED" || signing.status !== "IN_PROGRESS") {
    return null;
  }

  if (!signing.documentId) {
    throw new RenderedDocumentServiceError(
      "Documenso document id missing",
      400,
    );
  }

  return { signing, documentId: signing.documentId };
};

/**
 * One transaction: the linked record, the document and its signature row
 * commit together or not at all, so a failure part-way leaves nothing for a
 * retry to trip over. `null` when the completion is not kept; a discarded one
 * also returns the document to not started.
 */
const commitSigningCompletion = async (
  existing: PersistedRenderedDocument,
  signing: PinnedRenderedDocumentSigning,
  documentId: string,
  signed: SignedCopy,
): Promise<CompletedSigning | null> => {
  const signatureData = buildSignatureData(existing, signing, signed.at);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockRequestOfDocument(tx, existing);
      // Not moved: the record was reopened, edited, voided or superseded while
      // the signature was outstanding, so no signed copy of content it no
      // longer stands for is recorded against it.
      const moved = await propagateSigningCompletionToLinkedRecord(
        tx,
        existing,
        parseSourceRevision(signing.sourceRevision),
        signed.by,
        signed.at,
      );
      if (!moved) {
        throw new SigningCompletionSkipped(true);
      }

      const document = await claimSignedDocument(
        tx,
        existing,
        signing,
        documentId,
        signed,
      );

      // An upsert, so a signature row left by an earlier partial completion
      // is taken over rather than failing every retry on the unique key.
      const signatureRow = await tx.documentSignature.upsert({
        where: { renderedDocumentId: existing.id },
        create: { renderedDocumentId: existing.id, ...signatureData },
        update: signatureData,
      });

      const linked = await findLinkedRecord(tx, existing);
      await markClientAssignmentsSigned(
        tx,
        existing,
        signing,
        linked,
        signed.at,
      );

      return {
        document: { ...document, signature: signatureRow },
        linked,
      };
    });
  } catch (error) {
    if (!(error instanceof SigningCompletionSkipped)) {
      throw error;
    }
    if (error.recordChanged) {
      await releaseDiscardedSigning(existing, documentId);
    }
    return null;
  }
};

export const completePersistedRenderedDocumentSigning = async (
  renderedDocumentId: string,
): Promise<PersistedRenderedDocument> => {
  const existing = await getPersistedRenderedDocument(renderedDocumentId, null);
  const open = readOpenSigning(existing);
  if (!open) {
    return existing;
  }

  const signedPdf = await downloadSignedCopy(
    existing.organisationId,
    open.documentId,
  );
  const completed = await commitSigningCompletion(
    existing,
    open.signing,
    open.documentId,
    {
      by: open.signing.signerId ?? existing.signedBy ?? undefined,
      at: new Date(),
      pdfUrl: signedPdf.downloadUrl ?? null,
    },
  );
  if (!completed) {
    return existing;
  }

  await recordRenderedDocumentAuditSafely(
    renderedDocumentClient,
    existing,
    completed.linked,
    {
      eventType:
        RENDERED_DOCUMENT_SIGNED_AUDIT_EVENT[existing.kind] ??
        "DOCUMENT_UPDATED",
      actorType: "PMS_USER",
      metadata: { renderedDocumentId: existing.id, kind: existing.kind },
    },
  );

  return normalizePersistedRenderedDocument(completed.document);
};
