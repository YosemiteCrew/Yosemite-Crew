import { CompanionRecord, SignedFile } from '@/app/features/documents/types/companionDocuments';
import { getData, postData } from '@/app/services/axios';

export const createCompanionDocument = async (document: CompanionRecord, companionId: string) => {
  try {
    if (!companionId) {
      throw new Error('Companion ID missing');
    }
    const payload = {
      title: document.title,
      category: document.category,
      subcategory: document.subcategory,
      attachments: document.attachments,
      appointmentId: document.appointmentId ?? null,
      visitType: document.visitType ?? null,
      issuingBusinessName: document.issuingBusinessName?.trim() || null,
      issueDate: document.hasIssueDate ? (document.issueDate ?? null) : null,
    };
    await postData('/v1/document/pms/' + companionId, payload);
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

/**
 * A companion-documents GET can come back as a bare array or wrapped under
 * `data`/`documents`, depending on the endpoint - normalizes any of those
 * to a plain array, defaulting to empty rather than throwing on a shape
 * this hasn't seen.
 */
const fetchCompanionRecords = async (
  url: string,
  errorMessage: string
): Promise<CompanionRecord[]> => {
  try {
    const res = await getData<
      CompanionRecord[] | { data?: CompanionRecord[]; documents?: CompanionRecord[] }
    >(url, { _t: Date.now() });
    const payload = res.data;
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.data)) {
      return payload.data;
    }
    if (Array.isArray(payload?.documents)) {
      return payload.documents;
    }
    return [];
  } catch (err) {
    console.error(errorMessage, err);
    throw err;
  }
};

export const loadCompanionDocument = async (companionId: string): Promise<CompanionRecord[]> => {
  if (!companionId) {
    throw new Error('Companion ID missing');
  }
  return fetchCompanionRecords('/v1/document/pms/' + companionId, 'Failed to create service:');
};

/**
 * Just the signed/generated consent documents from the e-signing portal
 * (Documenso), for the companion-history Consent section - not every
 * document {@link loadCompanionDocument} returns.
 */
export const loadConsentDocumentsForCompanion = async (
  companionId: string
): Promise<CompanionRecord[]> => {
  if (!companionId) {
    throw new Error('Companion ID missing');
  }
  return fetchCompanionRecords(
    '/v1/document/pms/' + companionId + '/consent',
    'Failed to load consent documents:'
  );
};

export const loadDocumentDetails = async (documentId: string): Promise<CompanionRecord> => {
  try {
    if (!documentId) {
      throw new Error('Document ID missing');
    }
    const res = await getData<CompanionRecord>('/v1/document/pms/details/' + documentId);
    return res.data;
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

export const loadDocumentDownloadURL = async (
  documentId: string | undefined
): Promise<SignedFile[]> => {
  try {
    if (!documentId) {
      throw new Error('Document ID missing');
    }
    const res = await getData<SignedFile[]>('/v1/document/pms/view/' + documentId);
    return res.data;
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};
