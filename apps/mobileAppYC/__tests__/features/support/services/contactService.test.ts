import {
  contactService,
  uploadContactAttachments,
  CONTACT_SOURCE,
} from '../../../../src/features/support/services/contactService';
import apiClient, {withAuthHeaders} from '../../../../src/shared/services/apiClient';
import {documentApi} from '../../../../src/features/documents/services/documentService';
import {ensureAccessContext, toErrorMessage} from '../../../../src/shared/utils/serviceHelpers';

// --- Mocks ---

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn(),
}));

jest.mock('@/features/documents/services/documentService', () => ({
  documentApi: {
    uploadAttachment: jest.fn(),
  },
}));

jest.mock('@/shared/utils/serviceHelpers', () => ({
  ensureAccessContext: jest.fn(),
  toErrorMessage: jest.fn(),
}));

describe('contactService', () => {
  const mockToken = 'mock-token';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (ensureAccessContext as jest.Mock).mockResolvedValue({
      accessToken: mockToken,
      userId: mockUserId,
    });
    (withAuthHeaders as jest.Mock).mockReturnValue({Authorization: 'Bearer token'});
  });

  // ===========================================================================
  // 1. uploadContactAttachments
  // ===========================================================================

  describe('uploadContactAttachments', () => {
    const validFile = {uri: 'file://path', name: 'test.jpg', status: 'ready'};
    const companionId = 'comp-123';

    it('returns empty result immediately if no files provided', async () => {
      const result = await uploadContactAttachments({files: [], companionId});
      expect(result).toEqual({uploaded: [], attachments: []});
      expect(ensureAccessContext).not.toHaveBeenCalled();
    });

    it('throws error if companionId is missing', async () => {
      await expect(
        uploadContactAttachments({files: [validFile] as any, companionId: ''}),
      ).rejects.toThrow('Please add a pet profile before uploading attachments.');
    });

    it('throws error if a file has an empty/missing URI', async () => {
      const invalidFile = {...validFile, uri: '   '};
      await expect(
        uploadContactAttachments({files: [invalidFile] as any, companionId}),
      ).rejects.toThrow('Some files are still preparing or could not be read');
    });

    it('throws error if a file status is not "ready" (and status exists)', async () => {
      const invalidFile = {...validFile, status: 'uploading'};
      await expect(
        uploadContactAttachments({files: [invalidFile] as any, companionId}),
      ).rejects.toThrow('Some files are still preparing or could not be read');
    });

    // --- Upload & Mapping Logic ---

    it('uploads files and maps them to attachment payloads correctly', async () => {
      const file1 = {uri: 'path/1', name: '1.jpg', status: 'ready'};
      const file2 = {uri: 'path/2', name: '2.jpg', status: 'ready'};

      // Mock upload responses
      const uploadResponse1 = {downloadUrl: 'http://url/1', name: '1.jpg'};
      const uploadResponse2 = {viewUrl: 'http://url/2', name: '2.jpg'}; // Fallback URL field

      (documentApi.uploadAttachment as jest.Mock)
        .mockResolvedValueOnce(uploadResponse1)
        .mockResolvedValueOnce(uploadResponse2);

      const result = await uploadContactAttachments({
        files: [file1, file2] as any,
        companionId,
      });

      // Verify API calls
      expect(ensureAccessContext).toHaveBeenCalled();
      expect(documentApi.uploadAttachment).toHaveBeenCalledTimes(2);
      expect(documentApi.uploadAttachment).toHaveBeenCalledWith({
        file: file1,
        companionId,
        accessToken: mockToken,
      });

      // Verify Result Structure
      expect(result.uploaded).toHaveLength(2);
      expect(result.attachments).toEqual([
        {url: 'http://url/1', name: '1.jpg'},
        {url: 'http://url/2', name: '2.jpg'},
      ]);
    });

    it('filters out uploads that return no URL (mapFileToAttachment null branch)', async () => {
      const file1 = {uri: 'path/1', status: 'ready'};

      // Mock response with NO url fields
      const badUploadResponse = {id: 'doc-1', name: 'No URL File'};
      (documentApi.uploadAttachment as jest.Mock).mockResolvedValue(badUploadResponse);

      const result = await uploadContactAttachments({
        files: [file1] as any,
        companionId,
      });

      expect(result.uploaded).toHaveLength(1); // It was "uploaded"
      expect(result.attachments).toHaveLength(0); // But mapped to null and filtered
    });

    it('uses s3Url as fallback if download/view URL missing', async () => {
      const file1 = {uri: 'path/1', status: 'ready'};
      (documentApi.uploadAttachment as jest.Mock).mockResolvedValue({
        s3Url: 'http://s3/bucket/key',
      });

      const result = await uploadContactAttachments({
        files: [file1] as any,
        companionId,
      });

      expect(result.attachments[0].url).toBe('http://s3/bucket/key');
    });
  });

  // ===========================================================================
  // 2. submitContact
  // ===========================================================================

  describe('submitContact', () => {
    const basePayload = {
      type: 'GENERAL_ENQUIRY' as const,
      subject: 'Hello',
      message: 'World',
    };

    it('submits contact request with default source and user ID headers', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({data: {success: true}});

      const result = await contactService.submitContact(basePayload);

      expect(ensureAccessContext).toHaveBeenCalled();

      // Verify headers include User ID
      expect(withAuthHeaders).toHaveBeenCalledWith(mockToken, {'x-user-id': mockUserId});

      // Verify Payload includes default source
      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/contact-us/contact',
        {
          ...basePayload,
          source: CONTACT_SOURCE,
        },
        expect.objectContaining({headers: expect.anything()}),
      );

      expect(result).toEqual({success: true});
    });

    it('submits with custom source and handles missing userId', async () => {
      // Mock context without userId
      (ensureAccessContext as jest.Mock).mockResolvedValue({
        accessToken: mockToken,
        userId: undefined,
      });
      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

      await contactService.submitContact({
        ...basePayload,
        source: 'WEB_DASHBOARD',
      });

      // Verify userId arg is undefined
      expect(withAuthHeaders).toHaveBeenCalledWith(mockToken, undefined);

      // Verify custom source usage
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({source: 'WEB_DASHBOARD'}),
        expect.anything(),
      );
    });

    it('handles API errors correctly', async () => {
      const error = new Error('Network Error');
      (apiClient.post as jest.Mock).mockRejectedValue(error);
      (toErrorMessage as jest.Mock).mockReturnValue('Formatted Error');

      await expect(contactService.submitContact(basePayload))
        .rejects.toThrow('Formatted Error');

      expect(toErrorMessage).toHaveBeenCalledWith(
        error,
        'Failed to submit your request.',
      );
    });
  });
});