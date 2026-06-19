import {
  Prisma,
  RenderedDocumentSourceKind as PrismaRenderedDocumentSourceKind,
} from "@prisma/client";
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
  type SignRenderedDocumentInput,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { DocumensoService } from "src/services/documenso.service";
import { renderRenderedDocumentPdf } from "src/services/rendered-document-renderer.service";

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
  "renderedDocument" | "documentSignature"
>;

type PersistedRenderedDocument = Prisma.RenderedDocumentGetPayload<{
  include: { signature: true };
}>;

const renderedDocumentClient = prisma as unknown as RenderedDocumentWriteClient;

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
  sourceKind: draft.source.sourceKind as PrismaRenderedDocumentSourceKind,
  sourceId: draft.source.sourceId,
  templateInstanceId: input.templateInstanceId ?? undefined,
  clinicalArtifactId: input.clinicalArtifactId ?? undefined,
  templateId: draft.source.templateId ?? undefined,
  templateVersion: draft.source.templateVersion ?? undefined,
  templateVersionId: draft.source.templateVersionId ?? undefined,
  kind: toLegacyTemplateKind(draft.kind),
  version: draft.version,
  title: draft.title,
  mimeType: draft.mimeType,
  status: draft.status,
  signable: draft.signable,
  pdfUrl: input.pdfUrl ?? undefined,
  pdf:
    input.pdf === undefined
      ? (buildRenderedDocumentPdfSnapshot(
          draft,
        ) as unknown as Prisma.InputJsonValue)
      : (input.pdf as Prisma.InputJsonValue),
  signedBy: draft.signedBy ?? undefined,
  signedAt: draft.signedAt ?? undefined,
  signing: draft.signing ?? undefined,
});

const normalizePersistedRenderedDocument = (
  document: PersistedRenderedDocument,
): PersistedRenderedDocument =>
  ({
    ...document,
    kind: normalizeTemplateKind(
      document.kind,
    ) as PersistedRenderedDocument["kind"],
  }) as PersistedRenderedDocument;

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

export const getPersistedRenderedDocument = async (
  renderedDocumentId: string,
  organisationId?: string,
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
    organisationId !== undefined &&
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

export const signPersistedRenderedDocument = async (
  input: PersistRenderedDocumentSignatureInput,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
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

  if (
    existing.signing &&
    typeof existing.signing === "object" &&
    !Array.isArray(existing.signing) &&
    (existing.signing as RenderedDocumentSigning).status === "IN_PROGRESS"
  ) {
    throw new RenderedDocumentServiceError(
      "Document signing is already in progress",
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

  const pdf = await renderRenderedDocumentPdf({
    title: existing.title,
    source: {
      sourceKind: existing.sourceKind,
      sourceId: existing.sourceId,
      organisationId: existing.organisationId,
      templateKind: existing.kind as RenderedDocumentKind,
      templateId: existing.templateId,
      templateVersion: existing.templateVersion,
      templateVersionId: existing.templateVersionId,
    },
  });
  const renderedPdfSnapshot = buildRenderedDocumentPdfSnapshot({
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
  });

  const doc = await DocumensoService.createDocument({
    pdf,
    signerEmail: input.signerEmail,
    signerName: input.signerName,
    apiKey,
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

  await DocumensoService.distributeDocument({
    documentId: doc.id,
    apiKey,
  });

  return normalizePersistedRenderedDocument(
    await client.renderedDocument.update({
      where: { id: existing.id },
      data: {
        pdf: renderedPdfSnapshot as unknown as Prisma.InputJsonValue,
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
        } as unknown as Prisma.InputJsonValue,
      },
      include: { signature: true },
    }),
  );
};

export const completePersistedRenderedDocumentSigning = async (
  renderedDocumentId: string,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<PersistedRenderedDocument> => {
  const existing = await getPersistedRenderedDocument(
    renderedDocumentId,
    undefined,
    client,
  );

  if (!existing.signing) {
    throw new RenderedDocumentServiceError("Document signing not started", 409);
  }

  if (existing.status === "SIGNED") {
    return existing;
  }

  const signing = existing.signing as RenderedDocumentSigning;
  if (signing.status === "SIGNED") {
    return existing;
  }

  const documentId = signing.documentId;
  if (!documentId) {
    throw new RenderedDocumentServiceError(
      "Documenso document id missing",
      400,
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

  await client.documentSignature.create({
    data: {
      renderedDocumentId: existing.id,
      signerId:
        signing.signerId ?? signing.signerEmail ?? existing.signedBy ?? "",
      signerType: signing.signerType ?? "PMS_USER",
      signedAt: new Date(),
    },
  });

  return normalizePersistedRenderedDocument(
    await client.renderedDocument.update({
      where: { id: existing.id },
      data: {
        status: "SIGNED",
        signedBy: signing.signerId ?? existing.signedBy ?? undefined,
        signedAt: new Date(),
        pdfUrl: signedPdf.downloadUrl ?? existing.pdfUrl ?? undefined,
        signing: {
          ...signing,
          status: "SIGNED",
          pdf: {
            url: signedPdf.downloadUrl ?? null,
          },
        } as unknown as Prisma.InputJsonValue,
      },
      include: { signature: true },
    }),
  );
};
