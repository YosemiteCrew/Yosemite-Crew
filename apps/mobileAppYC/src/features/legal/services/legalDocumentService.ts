import apiClient from '@/shared/services/apiClient';
import {toErrorMessage} from '@/shared/utils/serviceHelpers';

export type YcLegalDocumentType = 'terms' | 'privacy';

export interface YcLegalDocument {
  pdfUrl: string;
  version: string;
  lastUpdated: string;
}

const buildUrl = (type: YcLegalDocumentType) =>
  `/v1/legal-document/${encodeURIComponent(type)}`;

// Public endpoint - YC's own Terms & Conditions / Privacy Policy are the
// same pre-generated PDF for every user, so no auth headers are attached.
export const legalDocumentService = {
  async fetchLegalDocument(
    type: YcLegalDocumentType,
  ): Promise<YcLegalDocument> {
    try {
      const {data} = await apiClient.get(buildUrl(type));
      const payload = data?.data ?? data ?? {};
      return {
        pdfUrl: payload?.pdfUrl ?? '',
        version: payload?.version ?? '',
        lastUpdated: payload?.lastUpdated ?? '',
      };
    } catch (error) {
      const message = toErrorMessage(error, 'Unable to load this document');
      throw new Error(message);
    }
  },
};

export default legalDocumentService;
