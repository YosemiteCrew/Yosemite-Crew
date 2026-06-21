import {
  Prisma,
  RenderedDocumentSourceKind as PrismaRenderedDocumentSourceKind,
} from "@prisma/client";
import AWS from "aws-sdk";
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
import { DocumensoService } from "src/services/documenso.service";
import { renderRenderedDocumentPdfWithMetadata } from "src/services/rendered-document-renderer.service";

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

const downloadPdfBuffer = async (url: string): Promise<Buffer> => {
  try {
    const parsedUrl = new URL(url);
    const key = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));

    if (key) {
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
    }
  } catch {
    // Fall back to direct fetch below. This covers public URLs and non-S3 sources.
  }

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
  });

  return Buffer.from(response.data);
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
      pdf: pdfSnapshot as unknown as Prisma.InputJsonValue,
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

export const getPersistedRenderedDocumentPdf = async (
  renderedDocumentId: string,
  organisationId?: string,
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
  organisationId?: string,
  client: RenderedDocumentWriteClient = renderedDocumentClient,
): Promise<RenderedDocumentPdfResult> => {
  const document = await getPersistedRenderedDocument(
    renderedDocumentId,
    organisationId,
    client,
  );

  return rerenderAndPersistClinicalRenderedDocumentPdf(document, client);
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
