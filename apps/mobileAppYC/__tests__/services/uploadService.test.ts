import {
  uploadFileToPresignedUrl,
  requestParentProfileUploadUrl,
  requestCompanionProfileUploadUrl,
} from '../../src/shared/services/uploadService';
import RNFetchBlob from 'react-native-blob-util';
import RNFS from 'react-native-fs';
import apiClient from '../../src/shared/services/apiClient';

// --- Mocks ---

jest.mock('react-native-blob-util', () => ({
  fs: {
    exists: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
  },
  fetch: jest.fn(),
  wrap: jest.fn((path) => `wrapped:${path}`),
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('../../src/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}));

describe('uploadService', () => {
  const mockUrl = 'https://s3.example.com/upload';
  const mockKey = 'uploads/file.jpg';
  const mockAccessToken = 'test-token';
  const mockMimeType = 'image/jpeg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Presigned URL Requests', () => {
    const mockResponse = {
      data: { url: mockUrl, key: mockKey },
      status: 200,
    };

    it('requestParentProfileUploadUrl calls correct endpoint', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await requestParentProfileUploadUrl({
        accessToken: mockAccessToken,
        mimeType: mockMimeType,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/parent/profile/presigned',
        { mimeType: mockMimeType },
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        }),
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('requestCompanionProfileUploadUrl calls correct endpoint', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await requestCompanionProfileUploadUrl({
        accessToken: mockAccessToken,
        mimeType: mockMimeType,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/companion/profile/presigned',
        { mimeType: mockMimeType },
        expect.anything(),
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('uploadFileToPresignedUrl', () => {
    const mockFilePath = 'file:///storage/emulated/0/test.jpg';
    const cleanPath = '/storage/emulated/0/test.jpg';
    const mockBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World"

    beforeEach(() => {
      // Default Happy Path Mocks
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      (RNFetchBlob.fs.readFile as jest.Mock).mockResolvedValue(mockBase64);
      (RNFetchBlob.fetch as jest.Mock).mockResolvedValue({
        info: () => ({ status: 200 }),
        text: () => 'Success',
      });
    });

    it('successfully reads and uploads a valid file', async () => {
      await uploadFileToPresignedUrl({
        filePath: mockFilePath,
        mimeType: mockMimeType,
        url: mockUrl,
      });

      // 1. Should normalize path and check existence
      expect(RNFS.exists).toHaveBeenCalledWith(cleanPath);

      // 2. Should read file as base64 to verify content
      expect(RNFetchBlob.fs.readFile).toHaveBeenCalledWith(cleanPath, 'base64');

      // 3. Should call RNFetchBlob.fetch with correct arguments
      expect(RNFetchBlob.fetch).toHaveBeenCalledWith(
        'PUT',
        mockUrl,
        expect.objectContaining({
          'Content-Type': mockMimeType,
        }),
        `wrapped:${cleanPath}`, // From our mock wrapper
      );
    });

    it('handles URL encoded file paths', async () => {
      const encodedPath = 'file:///storage/my%20folder/image.jpg';
      const decodedPath = '/storage/my folder/image.jpg';

      await uploadFileToPresignedUrl({
        filePath: encodedPath,
        mimeType: mockMimeType,
        url: mockUrl,
      });

      // Verification reading should use the decoded path
      expect(RNFetchBlob.fs.readFile).toHaveBeenCalledWith(decodedPath, 'base64');
    });

    it('throws error if file does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);
      (RNFetchBlob.fs.exists as jest.Mock).mockResolvedValue(false);
      (RNFetchBlob.fs.readFile as jest.Mock).mockRejectedValue(
        new Error('ENOENT: no such file or directory'),
      );

      await expect(
        uploadFileToPresignedUrl({
          filePath: '/invalid/path.jpg',
          mimeType: mockMimeType,
          url: mockUrl,
        }),
      ).rejects.toThrow(/Failed to read file/);
    });

    it('throws error if file is empty (0 bytes)', async () => {
      // File exists but has 0 size in stats
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 0 });
      (RNFetchBlob.fs.readFile as jest.Mock).mockResolvedValue('');

      await expect(
        uploadFileToPresignedUrl({
          filePath: mockFilePath,
          mimeType: mockMimeType,
          url: mockUrl,
        }),
      ).rejects.toThrow(/File is empty or unreadable/);
    });

    it('throws error if file content is empty string', async () => {
      (RNFetchBlob.fs.readFile as jest.Mock).mockResolvedValue(''); // Empty content

      await expect(
        uploadFileToPresignedUrl({
          filePath: mockFilePath,
          mimeType: mockMimeType,
          url: mockUrl,
        }),
      ).rejects.toThrow(/File is empty or unreadable/);
    });

    it('throws error if file content is effectively empty (whitespace)', async () => {
      (RNFetchBlob.fs.readFile as jest.Mock).mockResolvedValue('   ');

      await expect(
        uploadFileToPresignedUrl({
          filePath: mockFilePath,
          mimeType: mockMimeType,
          url: mockUrl,
        }),
      ).rejects.toThrow(/File is empty or unreadable/);
    });

    it('throws error if upload returns 400+ status', async () => {
      (RNFetchBlob.fetch as jest.Mock).mockResolvedValue({
        info: () => ({ status: 500 }),
        text: () => 'Internal Server Error',
      });

      await expect(
        uploadFileToPresignedUrl({
          filePath: mockFilePath,
          mimeType: mockMimeType,
          url: mockUrl,
        }),
      ).rejects.toThrow('Failed to upload file. Status: 500');
    });

    it('handles content:// URIs without stripping scheme', async () => {
      const contentUri = 'content://com.android.providers/123';

      // Mock existence check to fail FS but pass BlobUtil (common for content URIs)
      (RNFS.exists as jest.Mock).mockResolvedValue(false);
      (RNFetchBlob.fs.exists as jest.Mock).mockResolvedValue(true);
      (RNFetchBlob.fs.stat as jest.Mock).mockResolvedValue({ size: 2048, path: contentUri });

      await uploadFileToPresignedUrl({
        filePath: contentUri,
        mimeType: mockMimeType,
        url: mockUrl,
      });

      // Should try to read the raw content URI
      expect(RNFetchBlob.fs.readFile).toHaveBeenCalledWith(contentUri, 'base64');
      expect(RNFetchBlob.wrap).toHaveBeenCalledWith(contentUri);
    });
  });
});
