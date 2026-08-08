import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {
  ensureAccessContext,
  toErrorMessage,
} from '@/shared/utils/serviceHelpers';

export type OrganisationDocumentCategory =
  'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY' | 'CANCELLATION_POLICY';

export type OrganisationDocumentVisibility = 'PUBLIC' | 'PRIVATE' | 'INTERNAL';

export interface OrganisationDocument {
  id: string;
  organisationId: string;
  title: string;
  description?: string | null;
  category: OrganisationDocumentCategory;
  fileSize?: number | null;
  visibility?: OrganisationDocumentVisibility | null;
  version?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pdfUrl?: string | null;
}

export interface OrganisationDocumentAcknowledgeStatus {
  acknowledged: boolean;
  version: number | null;
  acknowledgedAt: string | null;
}

const buildUrl = (
  organisationId: string,
  category: OrganisationDocumentCategory,
) =>
  `/v1/organisation-document/mobile/${encodeURIComponent(organisationId)}/documents?category=${encodeURIComponent(category)}`;

const buildAcknowledgeUrl = (organisationId: string, documentId: string) =>
  `/v1/organisation-document/mobile/${encodeURIComponent(organisationId)}/documents/${encodeURIComponent(documentId)}/acknowledge`;

const buildAcknowledgeStatusUrl = (
  organisationId: string,
  documentId: string,
) =>
  `/v1/organisation-document/mobile/${encodeURIComponent(organisationId)}/documents/${encodeURIComponent(documentId)}/acknowledge-status`;

const isValidCategory = (value: any): value is OrganisationDocumentCategory =>
  value === 'TERMS_AND_CONDITIONS' ||
  value === 'PRIVACY_POLICY' ||
  value === 'CANCELLATION_POLICY';

const isValidVisibility = (
  value: any,
): value is OrganisationDocumentVisibility =>
  value === 'PUBLIC' || value === 'PRIVATE' || value === 'INTERNAL';

const mapDocument = (raw: any): OrganisationDocument => ({
  id:
    raw?._id ??
    raw?.id ??
    raw?.documentId ??
    `${raw?.category ?? 'doc'}-${raw?.organisationId ?? ''}`,
  organisationId: raw?.organisationId ?? raw?.organisation_id ?? '',
  title: raw?.title ?? 'Document',
  description: raw?.description ?? raw?.details ?? null,
  category: isValidCategory(raw?.category)
    ? raw.category
    : 'TERMS_AND_CONDITIONS',
  fileSize: raw?.fileSize ?? null,
  visibility: isValidVisibility(raw?.visibility) ? raw.visibility : null,
  version: raw?.version ?? null,
  createdAt: raw?.createdAt ?? null,
  updatedAt: raw?.updatedAt ?? null,
  pdfUrl: raw?.pdfUrl ?? null,
});

export const organisationDocumentService = {
  async fetchDocuments(params: {
    organisationId: string;
    category: OrganisationDocumentCategory;
  }): Promise<OrganisationDocument[]> {
    const {organisationId, category} = params;

    if (!organisationId) {
      throw new Error('Missing organisation identifier');
    }

    const {accessToken} = await ensureAccessContext();
    try {
      const {data} = await apiClient.get(buildUrl(organisationId, category), {
        headers: withAuthHeaders(accessToken),
      });
      const payload = data?.data ?? data ?? [];
      const docs = Array.isArray(payload) ? payload : [];
      return docs.map(mapDocument);
    } catch (error) {
      const message = toErrorMessage(error, 'Unable to load documents');
      throw new Error(message);
    }
  },

  async acknowledgeDocument(params: {
    organisationId: string;
    documentId: string;
    category: OrganisationDocumentCategory;
    version: number;
  }): Promise<void> {
    const {organisationId, documentId, category, version} = params;

    if (!organisationId || !documentId) {
      throw new Error('Missing organisation or document identifier');
    }

    const {accessToken} = await ensureAccessContext();
    try {
      await apiClient.post(
        buildAcknowledgeUrl(organisationId, documentId),
        {category, version},
        {headers: withAuthHeaders(accessToken)},
      );
    } catch (error) {
      const message = toErrorMessage(
        error,
        'Unable to save your acknowledgment',
      );
      throw new Error(message);
    }
  },

  async getAcknowledgeStatus(params: {
    organisationId: string;
    documentId: string;
  }): Promise<OrganisationDocumentAcknowledgeStatus> {
    const {organisationId, documentId} = params;

    if (!organisationId || !documentId) {
      throw new Error('Missing organisation or document identifier');
    }

    const {accessToken} = await ensureAccessContext();
    try {
      const {data} = await apiClient.get(
        buildAcknowledgeStatusUrl(organisationId, documentId),
        {headers: withAuthHeaders(accessToken)},
      );
      const payload = data?.data ?? data ?? {};
      return {
        acknowledged: Boolean(payload?.acknowledged),
        version: payload?.version ?? null,
        acknowledgedAt: payload?.acknowledgedAt ?? null,
      };
    } catch (error) {
      const message = toErrorMessage(
        error,
        'Unable to load acknowledgment status',
      );
      throw new Error(message);
    }
  },
};

export default organisationDocumentService;
