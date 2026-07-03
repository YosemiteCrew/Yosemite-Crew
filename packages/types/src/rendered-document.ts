import type { ClinicalArtifactKind } from './clinical-artifact';
import type { TemplateKind } from './template';

export type RenderedDocumentKind =
  | 'FORM'
  | 'CONSENT'
  | 'SOAP_NOTE'
  | 'PRESCRIPTION'
  | 'DISCHARGE_SUMMARY'
  | 'VITAL_RECORD'
  | 'TASK_ASSIGNMENT'
  | 'INPATIENT_SCHEDULE'
  | 'INVOICE';

export type RenderedDocumentSourceKind =
  | 'TEMPLATE_INSTANCE'
  | 'CLINICAL_ARTIFACT'
  | 'FORM_SUBMISSION'
  | 'TASK_SCHEDULE'
  | 'INVOICE';

export type RenderedDocumentStatus = 'DRAFT' | 'SIGNED';
export type DocumentSignatureSignerType = 'PMS_USER' | 'PARENT' | 'SYSTEM';
export type RenderedDocumentSigningStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SIGNED';
export type RenderedDocumentSigningProvider = 'DOCUMENSO';

export type RenderedDocumentSource = {
  sourceKind: RenderedDocumentSourceKind;
  sourceId: string;
  organisationId: string;
  templateKind: TemplateKind | ClinicalArtifactKind | 'INVOICE';
  templateId?: string | null;
  templateVersion?: number | null;
  templateVersionId?: string | null;
};

export type RenderedDocumentPdfSnapshot = {
  version: 1;
  renderer: 'rendered-document-renderer.service';
  renderedAt: string;
  title: string;
  mimeType: 'application/pdf';
  documentKind: RenderedDocumentKind;
  source: RenderedDocumentSource;
};

export type RenderedDocumentSignature = {
  documentId: string;
  signerId: string;
  signerType: DocumentSignatureSignerType;
  signedAt: Date;
  signatureText?: string | null;
};

export type RenderedDocumentSigning = {
  required: boolean;
  provider: RenderedDocumentSigningProvider;
  status: RenderedDocumentSigningStatus;
  documentId?: string | null;
  signerId?: string | null;
  signerType?: DocumentSignatureSignerType | null;
  signerEmail?: string | null;
  signerName?: string | null;
  signingUrl?: string | null;
  pdf?: {
    url?: string | null;
  } | null;
};

export type RenderedDocument = {
  id: string;
  version: number;
  kind: RenderedDocumentKind;
  status: RenderedDocumentStatus;
  title: string;
  organisationId: string;
  mimeType: 'application/pdf';
  signable: boolean;
  source: RenderedDocumentSource;
  pdf?: RenderedDocumentPdfSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date | null;
  signedBy?: string | null;
  signing?: RenderedDocumentSigning | null;
  signature?: RenderedDocumentSignature | null;
};

export type BuildRenderedDocumentInput = {
  title: string;
  source: RenderedDocumentSource;
  version?: number;
};

export type SignRenderedDocumentInput = {
  signerId: string;
  signerType: DocumentSignatureSignerType;
  signatureText?: string | null;
  signedAt?: Date;
};

export type PersistRenderedDocumentInput = BuildRenderedDocumentInput & {
  templateInstanceId?: string;
  clinicalArtifactId?: string;
  pdfUrl?: string | null;
  pdf?: unknown;
};

export type PersistRenderedDocumentSignatureInput = SignRenderedDocumentInput & {
  renderedDocumentId: string;
  organisationId?: string;
  signerEmail: string;
  signerName: string;
};

const SIGNABLE_RENDERED_DOCUMENT_KINDS = new Set<RenderedDocumentKind>([
  'FORM',
  'CONSENT',
  'SOAP_NOTE',
  'PRESCRIPTION',
  'DISCHARGE_SUMMARY',
  'VITAL_RECORD',
]);

const normalizeRequiredString = (value: string, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return normalized;
};

const toRenderedDocumentKind = (source: RenderedDocumentSource): RenderedDocumentKind => {
  if (source.sourceKind === 'INVOICE') {
    return 'INVOICE';
  }

  const kind = source.templateKind;
  switch (kind) {
    case 'FORM':
      return 'FORM';
    case 'CONSENT':
      return 'CONSENT';
    case 'SOAP_NOTE':
      return 'SOAP_NOTE';
    case 'PRESCRIPTION':
      return 'PRESCRIPTION';
    case 'DISCHARGE_SUMMARY':
      return 'DISCHARGE_SUMMARY';
    case 'VITAL_RECORD':
      return 'VITAL_RECORD';
    case 'TASK_ASSIGNMENT':
      return 'TASK_ASSIGNMENT';
    case 'INPATIENT_SCHEDULE':
      return 'INPATIENT_SCHEDULE';
    default:
      throw new Error('Unsupported rendered document kind');
  }
};

const normalizeSignatureText = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Invalid signatureText');
  }

  return normalized;
};

const createRenderedDocumentId = (): string => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `rendered-document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const buildRenderedDocumentPdfSnapshot = (
  document: Pick<RenderedDocument, 'kind' | 'source' | 'title'>,
  renderedAt = new Date()
): RenderedDocumentPdfSnapshot => ({
  version: 1,
  renderer: 'rendered-document-renderer.service',
  renderedAt: renderedAt.toISOString(),
  title: document.title,
  mimeType: 'application/pdf',
  documentKind: document.kind,
  source: document.source,
});

export const isSignableRenderedDocumentKind = (kind: RenderedDocumentKind): boolean =>
  SIGNABLE_RENDERED_DOCUMENT_KINDS.has(kind);

export const buildRenderedDocumentDraft = (input: BuildRenderedDocumentInput): RenderedDocument => {
  const title = normalizeRequiredString(input.title, 'title');
  const organisationId = normalizeRequiredString(input.source.organisationId, 'organisationId');
  const sourceId = normalizeRequiredString(input.source.sourceId, 'sourceId');
  const kind = toRenderedDocumentKind(input.source);
  const now = new Date();

  return {
    id: createRenderedDocumentId(),
    version: input.version ?? 1,
    kind,
    status: 'DRAFT',
    title,
    organisationId,
    mimeType: 'application/pdf',
    signable: isSignableRenderedDocumentKind(kind),
    source: {
      ...input.source,
      organisationId,
      sourceId,
    },
    pdf: null,
    createdAt: now,
    updatedAt: now,
    signedAt: null,
    signedBy: null,
    signing: null,
    signature: null,
  };
};

export const buildDocumentSignature = (
  documentId: string,
  input: SignRenderedDocumentInput
): RenderedDocumentSignature => ({
  documentId: normalizeRequiredString(documentId, 'documentId'),
  signerId: normalizeRequiredString(input.signerId, 'signerId'),
  signerType: input.signerType,
  signedAt: input.signedAt ?? new Date(),
  signatureText: normalizeSignatureText(input.signatureText),
});

export const signRenderedDocument = (
  document: RenderedDocument,
  input: SignRenderedDocumentInput
): RenderedDocument => {
  if (!document.signable) {
    throw new Error('Document kind is not signable');
  }

  if (document.status === 'SIGNED') {
    throw new Error('Document is already signed');
  }

  const signature = buildDocumentSignature(document.id, input);

  return {
    ...document,
    status: 'SIGNED',
    signedAt: signature.signedAt,
    signedBy: signature.signerId,
    signature,
    updatedAt: signature.signedAt,
  };
};
