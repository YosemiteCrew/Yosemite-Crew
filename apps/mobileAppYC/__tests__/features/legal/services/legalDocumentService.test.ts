import legalDocumentService from '../../../../src/features/legal/services/legalDocumentService';
import apiClient from '../../../../src/shared/services/apiClient';
import {toErrorMessage} from '../../../../src/shared/utils/serviceHelpers';

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('@/shared/utils/serviceHelpers', () => ({
  toErrorMessage: jest.fn((_err, defaultMsg) => defaultMsg || 'Mock Error'),
}));

describe('legalDocumentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the public legal-document endpoint with no auth headers', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        data: {
          pdfUrl: 'https://cdn.example/legal/terms-v1.pdf',
          version: 'v1',
          lastUpdated: '2026-03-01',
        },
      },
    });

    const result = await legalDocumentService.fetchLegalDocument('terms');

    expect(apiClient.get).toHaveBeenCalledWith('/v1/legal-document/terms');
    expect(result).toEqual({
      pdfUrl: 'https://cdn.example/legal/terms-v1.pdf',
      version: 'v1',
      lastUpdated: '2026-03-01',
    });
  });

  it('builds the url for the privacy document type', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({data: {data: {}}});

    await legalDocumentService.fetchLegalDocument('privacy');

    expect(apiClient.get).toHaveBeenCalledWith('/v1/legal-document/privacy');
  });

  it('handles a flat (non-nested) response payload', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        pdfUrl: 'https://cdn.example/legal/privacy-v2.pdf',
        version: 'v2',
        lastUpdated: '2026-04-01',
      },
    });

    const result = await legalDocumentService.fetchLegalDocument('privacy');

    expect(result).toEqual({
      pdfUrl: 'https://cdn.example/legal/privacy-v2.pdf',
      version: 'v2',
      lastUpdated: '2026-04-01',
    });
  });

  it('defaults to empty strings when the payload is missing fields', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({data: null});

    const result = await legalDocumentService.fetchLegalDocument('terms');

    expect(result).toEqual({pdfUrl: '', version: '', lastUpdated: ''});
  });

  it('catches API errors and rethrows with a formatted message', async () => {
    const apiError = new Error('Network Fail');
    (apiClient.get as jest.Mock).mockRejectedValue(apiError);
    (toErrorMessage as jest.Mock).mockReturnValue(
      'Unable to load this document',
    );

    await expect(
      legalDocumentService.fetchLegalDocument('terms'),
    ).rejects.toThrow('Unable to load this document');

    expect(toErrorMessage).toHaveBeenCalledWith(
      apiError,
      'Unable to load this document',
    );
  });
});
