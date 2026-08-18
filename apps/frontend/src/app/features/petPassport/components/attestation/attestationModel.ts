import axios from 'axios';
import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  CompanionRecord,
  getCompanionDocumentCategoryLabel,
  getCompanionDocumentSubcategoryLabel,
} from '@/app/features/documents/types/companionDocuments';
import { formatDateLabel } from '@/app/lib/forms';

/**
 * Lifecycle of the passport clinical record (the backend's ClinicalArtifact
 * status) that a parent-uploaded document has been captured into.
 *
 * Only SIGNED records reach the passport: the capture routes create the record
 * as DRAFT, `/records/:id/sign` parks it at IN_PROGRESS until Documenso's
 * webhook reports the signature complete, `/records/:id/attest` flips it to
 * SIGNED directly, and `/records/:id/revoke` voids it.
 */
export type PassportRecordStatus = 'DRAFT' | 'IN_PROGRESS' | 'SIGNED' | 'VOID';

const PASSPORT_RECORD_STATUSES = new Set<PassportRecordStatus>([
  'DRAFT',
  'IN_PROGRESS',
  'SIGNED',
  'VOID',
]);

/**
 * A companion record that the API has linked to a passport clinical record.
 *
 * BACKEND: `GET /v1/document/pms/:companionId` returns neither field today, so
 * `getPassportRecordLink` resolves to null and the review-and-attest affordance
 * stays hidden (the same approach the lifecycle tabs take for the fields they
 * still lack). Two things are needed:
 *  1. `passportRecordId` on `DocumentDto` for a document that has been captured
 *     into a passport record, plus its `passportRecordStatus`.
 *  2. That id must be the **ClinicalArtifact** id. The four capture responses
 *     and `GET /passport` both return the child row id (`Immunization.id`,
 *     `RabiesTitration.id`, ...) while `/records/:recordId/{sign,attest,revoke}`
 *     look the record up by `clinicalArtifact.id`, so no id the frontend can
 *     obtain today addresses the attestation routes.
 */
export type PassportLinkedRecord = CompanionRecord & {
  passportRecordId?: string | null;
  passportRecordStatus?: PassportRecordStatus | null;
};

export type PassportRecordLink = {
  recordId: string;
  status: PassportRecordStatus;
};

/**
 * The passport record a document has been captured into, or null when the
 * document is not linked to one. An unrecognised status is treated as DRAFT:
 * "not attested yet" is the only claim that is safe to make without knowing.
 */
export const getPassportRecordLink = (record: CompanionRecord): PassportRecordLink | null => {
  const linked = record as PassportLinkedRecord;
  const recordId = linked.passportRecordId?.trim();
  if (!recordId) return null;
  const status = linked.passportRecordStatus ?? undefined;
  return {
    recordId,
    status: status && PASSPORT_RECORD_STATUSES.has(status) ? status : 'DRAFT',
  };
};

export type PassportRecordStatusMeta = {
  label: string;
  tone: StatusTone;
  /** Plain-language state, stating what is and is not true of the passport. */
  detail: string;
};

/**
 * What each status means for the passport, in the vet's terms. IN_PROGRESS
 * deliberately does not read as signed: the record only counts once Documenso's
 * webhook reports the signature back.
 */
export const PASSPORT_RECORD_STATUS_META: Record<PassportRecordStatus, PassportRecordStatusMeta> = {
  DRAFT: {
    label: 'Not attested',
    tone: 'neutral',
    detail:
      'Captured from the uploaded document. It stays out of the passport until a veterinarian attests it.',
  },
  IN_PROGRESS: {
    label: 'Signature pending',
    tone: 'progress',
    detail:
      'Sent for e-signature. The record is not passport-valid yet - it becomes valid when the signed document comes back from Documenso.',
  },
  SIGNED: {
    label: 'Attested',
    tone: 'success',
    detail: 'Attested by a veterinarian and carried in the pet passport.',
  },
  VOID: {
    label: 'Revoked',
    tone: 'danger',
    detail: 'The attestation was revoked. The record no longer counts toward the passport.',
  },
};

/** Statuses that can still be signed or attested. */
export const canAttestStatus = (status: PassportRecordStatus): boolean =>
  status === 'DRAFT' || status === 'IN_PROGRESS';

/** The API's own message for a failed call, so the vet sees why it failed. */
const readApiMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) return '';
  const data = error.response?.data as { message?: unknown } | undefined;
  if (typeof data?.message === 'string') return data.message;
  return error.message;
};

export const getAttestationErrorMessage = (error: unknown, fallback: string): string =>
  readApiMessage(error).trim() || fallback;

/**
 * Whether the practice simply has no Documenso signing set up. The service
 * answers a sign request with 400 "Documenso signing is not configured for this
 * practice or signer.", which is the one failure that should promote manual
 * attestation rather than ask the vet to try again.
 */
export const isDocumensoUnavailable = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return false;
  return readApiMessage(error).toLowerCase().includes('documenso');
};

export type ReviewField = {
  label: string;
  value: string;
};

const DASH = '-';

/** Who put the file on the record, from the uploader ids the document carries. */
export const getRecordOrigin = (record: CompanionRecord): string => {
  if (record.uploadedByParentId) return 'Uploaded by the pet parent';
  if (record.uploadedByPmsUserId) return 'Uploaded by the practice';
  return 'Origin not recorded';
};

const formatAttachments = (record: CompanionRecord): string => {
  const attachments = record.attachments ?? [];
  if (attachments.length === 0) return 'No file attached';
  const types = [
    ...new Set(
      attachments.map(
        (attachment) => attachment.mimeType?.split('/').pop()?.toUpperCase() || 'FILE'
      )
    ),
  ];
  return `${attachments.length} ${attachments.length === 1 ? 'file' : 'files'} (${types.join(', ')})`;
};

/**
 * The record as the pet parent filed it. This is the half of the review that
 * the vet is signing their name to, so every value is shown as stored - an
 * absent field reads as a dash rather than being quietly dropped.
 */
export const getReviewFields = (record: CompanionRecord): ReviewField[] => [
  { label: 'Document', value: record.title?.trim() || 'Untitled document' },
  { label: 'Category', value: getCompanionDocumentCategoryLabel(record.category) },
  { label: 'Type', value: getCompanionDocumentSubcategoryLabel(record.subcategory) },
  { label: 'Issue date', value: formatDateLabel(record.issueDate) || 'Undated' },
  { label: 'Issued by', value: record.issuingBusinessName?.trim() || DASH },
  { label: 'Attachments', value: formatAttachments(record) },
  { label: 'Origin', value: getRecordOrigin(record) },
];
