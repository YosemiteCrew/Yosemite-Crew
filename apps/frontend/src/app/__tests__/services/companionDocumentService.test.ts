import {
  createCompanionDocument,
  loadCompanionDocument,
  loadDocumentDetails,
  loadDocumentDownloadURL,
} from '@/app/features/companions/services/companionDocumentService';

const getDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
}));

describe('companionDocumentService', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('createCompanionDocument', () => {
    it('posts document to the correct endpoint', async () => {
      postDataMock.mockResolvedValue({ data: {} });

      const document = {
        title: 'Test Doc',
        category: 'HEALTH' as const,
        subcategory: 'HOSPITAL_VISITS' as const,
        attachments: [],
      };

      await createCompanionDocument(document, 'comp-123');

      expect(postDataMock).toHaveBeenCalledWith('/v1/document/pms/comp-123', {
        ...document,
        appointmentId: null,
        visitType: null,
        issuingBusinessName: null,
        issueDate: null,
      });
    });

    it('throws error when companionId is missing', async () => {
      const document = {
        title: 'Test Doc',
        category: 'HEALTH' as const,
        subcategory: 'HOSPITAL_VISITS' as const,
        attachments: [],
      };

      await expect(createCompanionDocument(document, '')).rejects.toThrow('Companion ID missing');
    });

    it('throws error when API call fails', async () => {
      postDataMock.mockRejectedValue(new Error('API error'));

      const document = {
        title: 'Test Doc',
        category: 'HEALTH' as const,
        subcategory: 'HOSPITAL_VISITS' as const,
        attachments: [],
      };

      await expect(createCompanionDocument(document, 'comp-123')).rejects.toThrow('API error');
    });
  });

  describe('loadCompanionDocument', () => {
    it('fetches documents from the correct endpoint', async () => {
      const mockDocuments = [{ title: 'Doc 1' }, { title: 'Doc 2' }];
      getDataMock.mockResolvedValue({ data: mockDocuments });

      const result = await loadCompanionDocument('comp-123');

      expect(getDataMock).toHaveBeenCalledWith(
        '/v1/document/pms/comp-123',
        expect.objectContaining({ _t: expect.any(Number) })
      );
      expect(result).toEqual(mockDocuments);
    });

    it('throws error when companionId is missing', async () => {
      await expect(loadCompanionDocument('')).rejects.toThrow('Companion ID missing');
    });

    it('throws error when API call fails', async () => {
      getDataMock.mockRejectedValue(new Error('API error'));

      await expect(loadCompanionDocument('comp-123')).rejects.toThrow('API error');
    });

    it('supports wrapped data response', async () => {
      const mockDocuments = [{ title: 'Doc Wrapped' }];
      getDataMock.mockResolvedValue({ data: { data: mockDocuments } });

      const result = await loadCompanionDocument('comp-123');

      expect(result).toEqual(mockDocuments);
    });
  });

  describe('loadDocumentDetails', () => {
    it('fetches document details from the correct endpoint', async () => {
      const mockDocument = { title: 'Doc Details', category: 'HEALTH' };
      getDataMock.mockResolvedValue({ data: mockDocument });

      const result = await loadDocumentDetails('doc-123');

      expect(getDataMock).toHaveBeenCalledWith('/v1/document/pms/details/doc-123');
      expect(result).toEqual(mockDocument);
    });

    it('throws error when documentId is missing', async () => {
      await expect(loadDocumentDetails('')).rejects.toThrow('Document ID missing');
    });

    it('throws error when API call fails', async () => {
      getDataMock.mockRejectedValue(new Error('API error'));

      await expect(loadDocumentDetails('doc-123')).rejects.toThrow('API error');
    });
  });

  describe('loadDocumentDownloadURL', () => {
    it('fetches download URL from the correct endpoint', async () => {
      const mockUrls = [
        { url: 'https://example.com/doc.pdf', key: 'key-1', mimeType: 'application/pdf' },
      ];
      getDataMock.mockResolvedValue({ data: mockUrls });

      const result = await loadDocumentDownloadURL('doc-123');

      expect(getDataMock).toHaveBeenCalledWith('/v1/document/pms/view/doc-123');
      expect(result).toEqual(mockUrls);
    });

    it('throws error when documentId is missing', async () => {
      await expect(loadDocumentDownloadURL('')).rejects.toThrow('Document ID missing');
    });

    it('throws error when documentId is undefined', async () => {
      await expect(loadDocumentDownloadURL(undefined)).rejects.toThrow('Document ID missing');
    });

    it('throws error when API call fails', async () => {
      getDataMock.mockRejectedValue(new Error('API error'));

      await expect(loadDocumentDownloadURL('doc-123')).rejects.toThrow('API error');
    });
  });
});
