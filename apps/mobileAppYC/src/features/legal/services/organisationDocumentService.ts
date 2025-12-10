import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {ensureAccessContext, toErrorMessage} from '@/shared/utils/serviceHelpers';

export type OrganisationDocumentCategory =
  | 'TERMS_AND_CONDITIONS'
  | 'PRIVACY_POLICY'
  | 'CANCELLATION_POLICY';

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
}

const buildUrl = (organisationId: string, category: OrganisationDocumentCategory) =>
  `/v1/organisation-document/mobile/${encodeURIComponent(organisationId)}/documents?category=${encodeURIComponent(category)}`;

const isValidCategory = (value: any): value is OrganisationDocumentCategory =>
  value === 'TERMS_AND_CONDITIONS' ||
  value === 'PRIVACY_POLICY' ||
  value === 'CANCELLATION_POLICY';

const isValidVisibility = (value: any): value is OrganisationDocumentVisibility =>
  value === 'PUBLIC' || value === 'PRIVATE' || value === 'INTERNAL';

const mapDocument = (raw: any): OrganisationDocument => ({
  id: raw?._id ?? raw?.id ?? raw?.documentId ?? `${raw?.category ?? 'doc'}-${raw?.organisationId ?? ''}`,
  organisationId: raw?.organisationId ?? raw?.organisation_id ?? '',
  title: raw?.title ?? 'Document',
  description: raw?.description ?? raw?.details ?? null,
  category: isValidCategory(raw?.category) ? raw.category : 'TERMS_AND_CONDITIONS',
  fileSize: raw?.fileSize ?? null,
  visibility: isValidVisibility(raw?.visibility) ? raw.visibility : null,
  version: raw?.version ?? null,
  createdAt: raw?.createdAt ?? null,
  updatedAt: raw?.updatedAt ?? null,
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
};

export default organisationDocumentService;
