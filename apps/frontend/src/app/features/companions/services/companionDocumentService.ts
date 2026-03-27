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

export const loadCompanionDocument = async (companionId: string): Promise<CompanionRecord[]> => {
  try {
    if (!companionId) {
      throw new Error('Companion ID missing');
    }
    const res = await getData<
      CompanionRecord[] | { data?: CompanionRecord[]; documents?: CompanionRecord[] }
    >('/v1/document/pms/' + companionId, { _t: Date.now() });
    const payload = res.data as
      | CompanionRecord[]
      | { data?: CompanionRecord[]; documents?: CompanionRecord[] };
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
    console.error('Failed to create service:', err);
    throw err;
  }
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
