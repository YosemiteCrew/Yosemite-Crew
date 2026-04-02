import {
  startFormSigning,
  fetchSignedDocument,
  fetchSignedDocumentIfReady,
  downloadSubmissionPdf,
} from '@/app/features/forms/services/formSigningService';

const getDataMock = jest.fn();
const postDataMock = jest.fn();
const apiGetMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
  default: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('formSigningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startFormSigning', () => {
    it('posts to sign endpoint and returns response', async () => {
      const mockResponse = {
        documentId: 123,
        signingUrl: 'https://example.com/sign',
      };
      postDataMock.mockResolvedValue({ data: mockResponse });

      const result = await startFormSigning('submission-123');

      expect(postDataMock).toHaveBeenCalledWith(
        '/fhir/v1/form/form-submissions/submission-123/sign'
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns empty response when no data', async () => {
      postDataMock.mockResolvedValue({ data: {} });

      const result = await startFormSigning('submission-456');

      expect(result).toEqual({});
    });
  });

  describe('fetchSignedDocument', () => {
    it('fetches signed document details', async () => {
      const mockResponse = {
        pdf: {
          downloadUrl: 'https://s3.example.com/doc.pdf',
          filename: 'document.pdf',
          contentType: 'application/pdf',
        },
      };
      getDataMock.mockResolvedValue({ data: mockResponse });

      const result = await fetchSignedDocument('submission-123');

      expect(getDataMock).toHaveBeenCalledWith(
        '/fhir/v1/form/form-submissions/submission-123/signed-document'
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns empty response when no pdf data', async () => {
      getDataMock.mockResolvedValue({ data: {} });

      const result = await fetchSignedDocument('submission-456');

      expect(result).toEqual({});
    });
  });

  describe('fetchSignedDocumentIfReady', () => {
    it('returns signed document details when available', async () => {
      const mockResponse = {
        pdf: {
          downloadUrl: 'https://s3.example.com/doc.pdf',
          filename: 'document.pdf',
          contentType: 'application/pdf',
        },
      };
      apiGetMock.mockResolvedValue({ data: mockResponse });

      const result = await fetchSignedDocumentIfReady('submission-123');

      expect(apiGetMock).toHaveBeenCalledWith(
        '/fhir/v1/form/form-submissions/submission-123/signed-document'
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns null when backend reports submission is not signed yet', async () => {
      apiGetMock.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            message: 'Submission is not signed yet',
          },
        },
      });

      const result = await fetchSignedDocumentIfReady('submission-123');

      expect(result).toBeNull();
    });

    it('rethrows non-pending errors', async () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            message: 'Form submission not found',
          },
        },
      };
      apiGetMock.mockRejectedValue(error);

      await expect(fetchSignedDocumentIfReady('submission-123')).rejects.toEqual(error);
    });

    it('rethrows error when status is not 400 (e.g. 500)', async () => {
      const error = new Error('Internal error');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 500, data: { message: 'Internal server error' } };
      apiGetMock.mockRejectedValue(error);

      await expect(fetchSignedDocumentIfReady('submission-123')).rejects.toThrow('Internal error');
    });

    it('rethrows error when response data is not an object', async () => {
      const error = new Error('Bad response');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 400, data: 'plain string' };
      apiGetMock.mockRejectedValue(error);

      await expect(fetchSignedDocumentIfReady('submission-123')).rejects.toThrow('Bad response');
    });

    it('rethrows error when response data is null', async () => {
      const error = new Error('Null data');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 400, data: null };
      apiGetMock.mockRejectedValue(error);

      await expect(fetchSignedDocumentIfReady('submission-123')).rejects.toThrow('Null data');
    });
  });

  describe('downloadSubmissionPdf', () => {
    it('downloads PDF blob from signed document URL', async () => {
      const mockPdfBlob = new Blob(['pdf content'], {
        type: 'application/pdf',
      });
      getDataMock.mockResolvedValue({
        data: {
          pdf: {
            downloadUrl: 'https://s3.example.com/doc.pdf',
          },
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockPdfBlob),
      });

      const result = await downloadSubmissionPdf('submission-123');

      expect(getDataMock).toHaveBeenCalledWith(
        '/fhir/v1/form/form-submissions/submission-123/signed-document'
      );
      expect(mockFetch).toHaveBeenCalledWith('https://s3.example.com/doc.pdf', {
        method: 'GET',
        credentials: 'omit',
        headers: {
          Accept: '*/*',
        },
      });
      expect(result).toBe(mockPdfBlob);
    });

    it('throws error when download URL is not available', async () => {
      getDataMock.mockResolvedValue({ data: {} });

      await expect(downloadSubmissionPdf('submission-456')).rejects.toThrow(
        'Signed PDF not available'
      );
    });

    it('throws error when pdf object exists but downloadUrl is missing', async () => {
      getDataMock.mockResolvedValue({ data: { pdf: {} } });

      await expect(downloadSubmissionPdf('submission-456')).rejects.toThrow(
        'Signed PDF not available'
      );
    });

    it('throws error when fetch fails', async () => {
      getDataMock.mockResolvedValue({
        data: {
          pdf: {
            downloadUrl: 'https://s3.example.com/doc.pdf',
          },
        },
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(downloadSubmissionPdf('submission-789')).rejects.toThrow(
        'Failed to download signed PDF (404)'
      );
    });

    it('throws error when fetch returns 500', async () => {
      getDataMock.mockResolvedValue({
        data: {
          pdf: {
            downloadUrl: 'https://s3.example.com/doc.pdf',
          },
        },
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(downloadSubmissionPdf('submission-123')).rejects.toThrow(
        'Failed to download signed PDF (500)'
      );
    });
  });
});
