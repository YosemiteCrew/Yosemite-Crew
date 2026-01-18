import { jest, describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

// 1. Setup Mocks BEFORE imports
const mockS3Instance = {
  upload: jest.fn(),
  getSignedUrlPromise: jest.fn(),
  copyObject: jest.fn(),
  deleteObject: jest.fn(),
  getBucketLifecycleConfiguration: jest.fn(),
  putBucketLifecycleConfiguration: jest.fn(),
};

jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(() => mockS3Instance),
  };
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Mock console to keep test output clean
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

// 2. Import Module
import * as UploadMiddleware from '../../src/middlewares/upload';

describe('Upload Middleware', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_CLOUD_FRONT_BASE_URL = 'cdn.test.com';
    process.env.AWS_ACCESS_KEY_ID = 'key';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ======================================================================
  // 1. UTILITY FUNCTIONS & CONFIG
  // ======================================================================
  describe('Utilities & Configuration', () => {
    it('should throw if bucket name env is missing', async () => {
      delete process.env.AWS_S3_BUCKET_NAME;

      await expect(
        UploadMiddleware.generatePresignedUrl('image/png', 'user', '123')
      ).rejects.toThrow('AWS_S3_BUCKET_NAME is not defined');
    });


    it('should throw if CloudFront URL is missing', () => {
      delete process.env.AWS_CLOUD_FRONT_BASE_URL;
      expect(() => UploadMiddleware.getURLForKey('key'))
        .toThrow('AWS_CLOUD_FRONT_BASE_URL is not defined');
    });

    it('getURLForKey should return formatted URL', () => {
      const url = UploadMiddleware.getURLForKey('folder/image.jpg');
      expect(url).toBe('https://cdn.test.com/folder/image.jpg');
    });

    it('generatePresignedDownloadUrl should return CF URL', async () => {
      const url = await UploadMiddleware.generatePresignedDownloadUrl('key.jpg');
      expect(url).toBe('https://cdn.test.com/key.jpg');
    });

    describe('mimeTypeToExtension', () => {
      const testCases = [
        ['image/jpeg', '.jpg'],
        ['image/jpg', '.jpg'],
        ['image/png', '.png'],
        ['application/pdf', '.pdf'],
        ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
        ['application/msword', '.doc'],
        ['application/vnd.ms-excel', '.xls'],
        ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
        ['application/vnd.ms-powerpoint', '.ppt'],
        ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
        ['unknown/type', ''],
      ];

      testCases.forEach(([mime, ext]) => {
        it(`should return "${ext}" for "${mime}"`, () => {
          expect(UploadMiddleware.mimeTypeToExtension(mime)).toBe(ext);
        });
      });
    });

    describe('buildS3Key', () => {
      it('should build keys for all types correctly', () => {
        expect(UploadMiddleware.buildS3Key('temp', undefined, 'image/png')).toBe('temp/uploads/mock-uuid.png');
        expect(UploadMiddleware.buildS3Key('user', '123', 'image/jpeg')).toBe('users/123/mock-uuid.jpg');
        expect(UploadMiddleware.buildS3Key('org', '456')).toBe('orgs/456/mock-uuid');
        expect(UploadMiddleware.buildS3Key('parent', 'p1')).toBe('parent/p1/mock-uuid');
        expect(UploadMiddleware.buildS3Key('companion', 'c1')).toBe('companion/c1/mock-uuid');
        expect(UploadMiddleware.buildS3Key('custom', 'folder')).toBe('folder/mock-uuid');
        expect(UploadMiddleware.buildS3Key('user-org', 'uo1')).toBe('user-org/uo1/mock-uuid');
      });

      it('should throw error for invalid type', () => {
        // @ts-ignore - Testing runtime validation
        expect(() => UploadMiddleware.buildS3Key('invalid', '123')).toThrow('Invalid upload type');
      });
    });
  });

  // ======================================================================
  // 2. DIRECT UPLOAD HANDLERS
  // ======================================================================
  describe('Upload Handlers', () => {
    describe('uploadToS3 (Internal)', () => {
      it('should upload successfully', async () => {
        const mockPromise = (jest.fn() as any).mockResolvedValue({ Location: 's3-loc', Key: 'key' });
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        // We access uploadToS3 via exported handleFileUpload which calls it
        const file = { name: 'test.png', mimetype: 'image/png', data: Buffer.from('test') };
        const result = await UploadMiddleware.handleFileUpload(file, 'test-folder');

        expect(mockS3Instance.upload).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Key: 'test-folder/mock-uuid.png',
          Body: file.data,
          ContentType: 'image/png',
          ContentDisposition: 'inline',
        });
        expect(result.url).toBe('s3-loc');
      });

      it('should handle S3 upload failure', async () => {
        const mockPromise = (jest.fn() as any).mockRejectedValue(new Error('Network error'));
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        const file = { name: 'test.png', mimetype: 'image/png', data: Buffer.from('test') };
        await expect(UploadMiddleware.handleFileUpload(file, 'test-folder'))
          .rejects.toThrow('S3 upload failed: Network error');

        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should handle non-Error objects thrown during upload', async () => {
        const mockPromise = (jest.fn() as any).mockRejectedValue('String error');
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        const file = { name: 'test.png', mimetype: 'image/png', data: Buffer.from('test') };
        await expect(UploadMiddleware.handleFileUpload(file, 'test-folder'))
          .rejects.toThrow('S3 upload failed: Unknown error');
      });
    });

    describe('handleFileUpload', () => {
      it('should throw if no file provided', async () => {
        // @ts-ignore
        await expect(UploadMiddleware.handleFileUpload(null, 'folder'))
          .rejects.toThrow('No file uploaded.');
      });

      it('should throw if unsupported mime type', async () => {
        const file = { name: 'test.exe', mimetype: 'application/x-msdownload', data: Buffer.from('') };
        await expect(UploadMiddleware.handleFileUpload(file, 'folder'))
          .rejects.toThrow('Unsupported file type.');
      });

      it('should sanitize filename', async () => {
        const mockPromise = (jest.fn() as any).mockResolvedValue({ Location: 'loc' });
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        const file = { name: '../../evil.png', mimetype: 'image/png', data: Buffer.from('') };
        const result = await UploadMiddleware.handleFileUpload(file, 'folder');

        expect(result.originalname).toBe('../../evil.png'); // The function returns input name in result
        // But constructs key safely:
        expect(mockS3Instance.upload).toHaveBeenCalledWith(expect.objectContaining({
            // uuid is mocked to 'mock-uuid', sanitization logic is used for extension mostly in this function
            Key: 'folder/mock-uuid.png'
        }));
      });
    });

    describe('handleMultipleFileUpload', () => {
      it('should upload multiple files', async () => {
        const mockPromise = (jest.fn() as any).mockResolvedValue({ Location: 'loc' });
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        const files = [
          { name: '1.png', mimetype: 'image/png', data: Buffer.from('1') },
          { name: '2.jpg', mimetype: 'image/jpeg', data: Buffer.from('2') },
        ];

        const results = await UploadMiddleware.handleMultipleFileUpload(files, 'multi');
        expect(results).toHaveLength(2);
        expect(mockS3Instance.upload).toHaveBeenCalledTimes(2);
      });
    });

    describe('uploadBufferAsFile', () => {
      it('should upload buffer successfully', async () => {
        const mockPromise = (jest.fn() as any).mockResolvedValue({ Location: 'loc', Key: 'k' });
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        const buf = Buffer.from('data');
        const res = await UploadMiddleware.uploadBufferAsFile(buf, {
          folderName: 'buf-folder',
          mimeType: 'application/pdf',
          originalName: 'report' // no extension
        });

        expect(res.key).toBe('buf-folder/mock-uuid.pdf');
        expect(res.originalname).toBe('report.pdf'); // Appends extension
      });

      it('should accept original name with extension', async () => {
        const mockPromise = (jest.fn() as any).mockResolvedValue({ Location: 'loc', Key: 'k' });
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        const res = await UploadMiddleware.uploadBufferAsFile(Buffer.from(''), {
          folderName: 'f', mimeType: 'image/png', originalName: 'image.png'
        });
        expect(res.originalname).toBe('image.png');
      });

      it('should fallback to default filename if sanitization returns empty', async () => {
        const mockPromise = (jest.fn() as any).mockResolvedValue({ Location: 'loc', Key: 'k' });
        mockS3Instance.upload.mockReturnValue({ promise: mockPromise });

        // A string that sanitizes to empty? sanitize-filename removes most illegal chars.
        // Assuming undefined originalName triggers default "file"
        const res = await UploadMiddleware.uploadBufferAsFile(Buffer.from(''), {
            folderName: 'f', mimeType: 'image/png'
        });
        expect(res.originalname).toBe('file.png');
      });

      it('should throw on invalid mime', async () => {
        await expect(UploadMiddleware.uploadBufferAsFile(Buffer.from(''), {
          folderName: 'f', mimeType: 'bad/mime'
        })).rejects.toThrow('Unsupported file type');
      });
    });
  });

  // ======================================================================
  // 3. PRESIGNED URLS & FILE OPERATIONS
  // ======================================================================
  describe('S3 Operations', () => {
    describe('generatePresignedUrl', () => {
      it('should return url and key', async () => {
        // Cast to any to fix type error
        (mockS3Instance.getSignedUrlPromise as any).mockResolvedValue('http://signed.url');

        const result = await UploadMiddleware.generatePresignedUrl('image/jpeg', 'user', '123');

        expect(mockS3Instance.getSignedUrlPromise).toHaveBeenCalledWith('putObject', {
          Bucket: 'test-bucket',
          Key: 'users/123/mock-uuid.jpg',
          ContentType: 'image/jpeg',
          Expires: 900
        });
        expect(result).toEqual({ url: 'http://signed.url', key: 'users/123/mock-uuid.jpg' });
      });

      it('should handle errors', async () => {
        // Cast to any to fix type error
        (mockS3Instance.getSignedUrlPromise as any).mockRejectedValue(new Error('Signing failed'));
        await expect(UploadMiddleware.generatePresignedUrl('image/jpeg', 'temp'))
          .rejects.toThrow('Failed to generate presigned URL: Signing failed');
      });
    });

    describe('moveFile', () => {
      it('should copy then delete', async () => {
        mockS3Instance.copyObject.mockReturnValue({ promise: (jest.fn() as any).mockResolvedValue({}) });
        mockS3Instance.deleteObject.mockReturnValue({ promise: (jest.fn() as any).mockResolvedValue({}) });

        const url = await UploadMiddleware.moveFile('old-key', 'new-key');

        expect(mockS3Instance.copyObject).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          CopySource: 'test-bucket/old-key',
          Key: 'new-key'
        });
        expect(mockS3Instance.deleteObject).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Key: 'old-key'
        });
        expect(url).toBe('https://cdn.test.com/new-key');
      });

      it('should handle errors during move', async () => {
        mockS3Instance.copyObject.mockReturnValue({ promise: (jest.fn() as any).mockRejectedValue(new Error('Copy failed')) });

        await expect(UploadMiddleware.moveFile('old', 'new'))
          .rejects.toThrow('Failed to move file: Copy failed');
      });
    });

    describe('deleteFromS3', () => {
      it('should delete file', async () => {
        mockS3Instance.deleteObject.mockReturnValue({ promise: (jest.fn() as any).mockResolvedValue({}) });
        await UploadMiddleware.deleteFromS3('key');
        expect(mockS3Instance.deleteObject).toHaveBeenCalledWith({
          Bucket: 'test-bucket', Key: 'key'
        });
      });

      it('should throw error on failure', async () => {
        mockS3Instance.deleteObject.mockReturnValue({ promise: (jest.fn() as any).mockRejectedValue(new Error('Del failed')) });
        await expect(UploadMiddleware.deleteFromS3('key')).rejects.toThrow('Del failed');
      });
    });
  });

  // ======================================================================
  // 4. LIFECYCLE POLICY
  // ======================================================================
  describe('setupLifecyclePolicy', () => {
    it('should do nothing if rule already exists', async () => {
      const mockConfig = { Rules: [{ ID: 'AutoDeleteTempUploads' }] };
      mockS3Instance.getBucketLifecycleConfiguration.mockReturnValue({
        promise: (jest.fn() as any).mockResolvedValue(mockConfig)
      });

      await UploadMiddleware.setupLifecyclePolicy();

      expect(mockS3Instance.getBucketLifecycleConfiguration).toHaveBeenCalled();
      expect(mockS3Instance.putBucketLifecycleConfiguration).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('should append rule if config exists but rule missing', async () => {
      const mockConfig = { Rules: [{ ID: 'OtherRule' }] };
      mockS3Instance.getBucketLifecycleConfiguration.mockReturnValue({
        promise: (jest.fn() as any).mockResolvedValue(mockConfig)
      });
      mockS3Instance.putBucketLifecycleConfiguration.mockReturnValue({
        promise: (jest.fn() as any).mockResolvedValue({})
      });

      await UploadMiddleware.setupLifecyclePolicy();

      expect(mockS3Instance.putBucketLifecycleConfiguration).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        LifecycleConfiguration: {
          Rules: [
            { ID: 'OtherRule' },
            expect.objectContaining({ ID: 'AutoDeleteTempUploads', Prefix: 'temp/', Status: 'Enabled' })
          ]
        }
      });
    });

    it('should create new config if NoSuchLifecycleConfiguration', async () => {
      const error = { code: 'NoSuchLifecycleConfiguration' };
      mockS3Instance.getBucketLifecycleConfiguration.mockReturnValue({
        promise: (jest.fn() as any).mockRejectedValue(error)
      });
      mockS3Instance.putBucketLifecycleConfiguration.mockReturnValue({
        promise: (jest.fn() as any).mockResolvedValue({})
      });

      await UploadMiddleware.setupLifecyclePolicy();

      expect(mockS3Instance.putBucketLifecycleConfiguration).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        LifecycleConfiguration: {
          Rules: [expect.objectContaining({ ID: 'AutoDeleteTempUploads' })]
        }
      });
    });

    it('should throw on generic error', async () => {
      mockS3Instance.getBucketLifecycleConfiguration.mockReturnValue({
        promise: (jest.fn() as any).mockRejectedValue(new Error('Access Denied'))
      });

      await expect(UploadMiddleware.setupLifecyclePolicy())
        .rejects.toThrow('Failed to set lifecycle policy: Access Denied');
    });

    it('should handle error object with null code in getErrorCode helper', async () => {
       const error = { code: null };
       mockS3Instance.getBucketLifecycleConfiguration.mockReturnValue({
         promise: (jest.fn() as any).mockRejectedValue(error)
       });

       await expect(UploadMiddleware.setupLifecyclePolicy())
         .rejects.toThrow('Failed to set lifecycle policy: Unknown error');
    });
  });
});