import {documentApi} from '@/features/documents/services/documentService';
import apiClient from '@/shared/services/apiClient';
import {uploadFileToPresignedUrl} from '@/shared/services/uploadService';
import {generateId} from '@/shared/utils/helpers';
import {buildCdnUrlFromKey} from '@/shared/utils/cdnHelpers';
import RNFS from 'react-native-fs';

// --- Mocks ---
jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: {headers: {common: {}}},
  },
  withAuthHeaders: jest.fn(token => ({Authorization: `Bearer ${token}`})),
}));

jest.mock('@/shared/services/uploadService', () => ({
  uploadFileToPresignedUrl: jest.fn(),
}));

jest.mock('@/shared/utils/helpers', () => ({
  generateId: jest.fn(),
}));

jest.mock('@/shared/utils/cdnHelpers', () => ({
  buildCdnUrlFromKey: jest.fn(),
}));

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  mkdir: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve({statusCode: 200}),
  })),
}));

jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: jest.fn((uri: any) => (uri ? uri : null)),
}));

describe('documentService', () => {
  const mockToken = 'mock-token';
  const mockCompanionId = 'companion-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (generateId as jest.Mock).mockReturnValue('mock-uuid');
    (buildCdnUrlFromKey as jest.Mock).mockImplementation(k => `cdn/${k}`);
    (apiClient.defaults as any).baseURL = '';
  });

  describe('requestUploadUrl', () => {
    it('should return upload metadata on success', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          uploadUrl: 'http://upload',
          key: 'file-key',
          fileUrl: 'http://file',
        },
      });

      const res = await documentApi.requestUploadUrl({
        mimeType: 'image/jpeg',
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(res).toEqual({
        uploadUrl: 'http://upload',
        key: 'file-key',
        fileUrl: 'http://file',
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/document/mobile/upload-url',
        {mimeType: 'image/jpeg', companionId: mockCompanionId},
        expect.any(Object),
      );
    });

    it('should throw error if response is missing uploadUrl or key', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

      await expect(
        documentApi.requestUploadUrl({
          mimeType: 'image/png',
          companionId: mockCompanionId,
          accessToken: mockToken,
        }),
      ).rejects.toThrow('Unable to request upload URL');
    });

    it('should handle nested data structure in response', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {data: {uploadUrl: 'url', key: 'key'}},
      });
      const res = await documentApi.requestUploadUrl({
        mimeType: 't',
        companionId: 'c',
        accessToken: 't',
      });
      expect(res.uploadUrl).toBe('url');
    });

    it('should handle alternate key names', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {signedUrl: 'url', fileKey: 'key'},
      });
      const res = await documentApi.requestUploadUrl({
        mimeType: 't',
        companionId: 'c',
        accessToken: 't',
      });
      expect(res.uploadUrl).toBe('url');
      expect(res.key).toBe('key');
    });

    it('should support uploadURL, filePath, and publicUrl response keys', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {
          uploadURL: 'http://upload-alt',
          filePath: 'file-path',
          publicUrl: 'http://public',
        },
      });

      const res = await documentApi.requestUploadUrl({
        mimeType: 'application/pdf',
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(res).toEqual({
        uploadUrl: 'http://upload-alt',
        key: 'file-path',
        fileUrl: 'http://public',
      });
    });
  });

  describe('uploadAttachment', () => {
    const fileBase = {
      uri: 'file://path',
      name: 'test.jpg',
      size: 100,
      type: 'image/jpeg',
    };

    it('should return file immediately if it already has a key', async () => {
      const file = {...fileBase, key: 'existing-key'};
      const res = await documentApi.uploadAttachment({
        file: file as any,
        companionId: mockCompanionId,
        accessToken: mockToken,
      });
      expect(res.key).toBe('existing-key');
      expect(uploadFileToPresignedUrl).not.toHaveBeenCalled();
    });

    it('should throw if file uri is missing', async () => {
      const file = {name: 'test.jpg'} as any; // No uri
      await expect(
        documentApi.uploadAttachment({
          file,
          companionId: mockCompanionId,
          accessToken: mockToken,
        }),
      ).rejects.toThrow('File path missing');
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should perform upload flow and return new file object', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {uploadUrl: 'http://put', key: 'new-key', fileUrl: 'http://view'},
      });

      const res = await documentApi.uploadAttachment({
        file: fileBase as any,
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(uploadFileToPresignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({url: 'http://put', expectedSize: 100}),
      );
      expect(res.key).toBe('new-key');
      expect(res.viewUrl).toBe('http://view');
    });

    it('should fallback to cdn url if viewUrl is missing', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {uploadUrl: 'http://put', key: 'new-key'},
      });
      const res = await documentApi.uploadAttachment({
        file: fileBase as any,
        companionId: mockCompanionId,
        accessToken: mockToken,
      });
      expect(res.viewUrl).toBe('cdn/new-key');
    });
  });

  describe('create', () => {
    it('should throw if no files provided', async () => {
      await expect(
        documentApi.create({
          companionId: mockCompanionId,
          category: 'health',
          subcategory: null,
          visitType: null,
          title: 'Doc',
          businessName: 'Vet',
          issueDate: '',
          files: [],
          accessToken: mockToken,
        }),
      ).rejects.toThrow('Please upload at least one document');
    });

    it('should handle successful creation and map response', async () => {
      const files = [{key: 'k1', type: 'image/png', uri: 'f1'}];
      const apiResponse = {
        id: 'doc-1',
        category: 'HEALTH',
        attachments: [{key: 'k1', url: 'http://k1'}],
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      (apiClient.post as jest.Mock).mockResolvedValue({data: apiResponse});

      const res = await documentApi.create({
        companionId: mockCompanionId,
        category: 'health',
        subcategory: 'prescription',
        visitType: 'wellness-exam',
        title: 'Title',
        businessName: 'Biz',
        issueDate: '2023-01-01',
        files: files as any,
        accessToken: mockToken,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining(mockCompanionId),
        expect.objectContaining({
          category: 'HEALTH',
          subcategory: 'PRESCRIPTION',
          visitType: 'WELLNESS_EXAM',
          issueDate: '2023-01-01',
        }),
        expect.any(Object),
      );

      expect(res.id).toBe('doc-1');
      expect(res.files[0].viewUrl).toBe('http://k1');
    });

    it('should map alias categories correctly and return enriched input files on empty response', async () => {
      const files = [{key: 'k1'}];
      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

      const res = await documentApi.create({
        companionId: mockCompanionId,
        category: 'hygiene',
        subcategory: 'grooming-visits',
        visitType: null,
        title: 'Title',
        businessName: 'Biz',
        issueDate: 'invalid-date',
        files: files as any,
        accessToken: mockToken,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          category: 'HYGIENE_MAINTENANCE',
          subcategory: 'GROOMING_VISITS',
          issueDate: '',
        }),
        expect.any(Object),
      );

      expect(res.files).toEqual(
        expect.arrayContaining([expect.objectContaining({key: 'k1'})]),
      );
    });

    it('should preserve provided files when a non-empty create response has no attachments', async () => {
      const files = [
        {id: 'file-1', key: 'existing-key', name: 'Existing file'},
      ];
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {id: 'doc-without-files', title: 'Saved'},
      });

      const res = await documentApi.create({
        companionId: mockCompanionId,
        category: '',
        subcategory: null,
        visitType: '   ',
        title: 'Saved',
        businessName: 'Biz',
        issueDate: 'January 2, 2023',
        files: files as any,
        accessToken: mockToken,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          category: '',
          visitType: '',
          issueDate: '2023-01-02',
        }),
        expect.any(Object),
      );
      expect(res.files).toEqual(files);
    });

    it('should handle "others" category mapping', async () => {
      const files = [{key: 'k1'}];
      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});
      await documentApi.create({
        companionId: '1',
        category: 'others',
        subcategory: null,
        visitType: null,
        title: 't',
        businessName: 'b',
        issueDate: '',
        files: files as any,
        accessToken: 't',
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({category: 'OTHERS'}),
        expect.any(Object),
      );
    });
  });

  describe('update', () => {
    it('should call patch and normalize response', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: {id: 'doc-1', title: 'Updated'},
      });

      const res = await documentApi.update({
        documentId: 'doc-1',
        category: 'admin',
        subcategory: null,
        visitType: null,
        title: 'Updated',
        businessName: 'Biz',
        issueDate: '',
        files: [{key: 'k1'}] as any,
        accessToken: mockToken,
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('doc-1'),
        expect.objectContaining({title: 'Updated'}),
        expect.any(Object),
      );
      expect(res.title).toBe('Updated');
    });

    it('should handle missing files in update payload', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({data: null});

      await documentApi.update({
        documentId: 'd1',
        category: 'c',
        subcategory: null,
        visitType: null,
        title: 't',
        businessName: 'b',
        issueDate: '',
        files: undefined,
        accessToken: 't',
      });

      const callArg = (apiClient.patch as jest.Mock).mock.calls[0][1];
      expect(callArg.attachments).toBeUndefined();
    });

    it('should preserve provided files when the update response has no attachments', async () => {
      const files = [
        {id: 'file-1', key: 'k1', name: 'Existing file', uri: 'file://one'},
      ];
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: {id: 'doc-1', title: 'Updated without files'},
      });

      const res = await documentApi.update({
        documentId: 'doc-1',
        companionId: 'c1',
        category: 'admin',
        subcategory: null,
        visitType: null,
        title: 'Updated without files',
        businessName: 'Biz',
        issueDate: '',
        files: files as any,
        accessToken: mockToken,
      });

      expect(res.files).toEqual(
        expect.arrayContaining([expect.objectContaining({key: 'k1'})]),
      );
    });
  });

  describe('list', () => {
    it('should fetch and normalize a list of documents', async () => {
      const mockData = [
        {
          id: '1',
          category: 'ADMIN',
          subcategory: 'PASSPORT',
          attachments: [{key: 'a1', size: 1024}],
        },
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({data: {data: mockData}});

      const list = await documentApi.list({
        companionId: 'c1',
        accessToken: mockToken,
      });

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('1');
      expect(list[0].category).toBe('admin');
      expect(list[0].files[0].size).toBe(1024);
    });

    it('should handle various collection structures (extractDocumentsCollection coverage)', async () => {
      // 1. data.data
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {data: [{id: '1'}]},
      });
      let list = await documentApi.list({companionId: 'c1', accessToken: 't'});
      expect(list).toHaveLength(1);

      // 2. root array
      (apiClient.get as jest.Mock).mockResolvedValueOnce({data: [{id: '1'}]});
      list = await documentApi.list({companionId: 'c1', accessToken: 't'});
      expect(list).toHaveLength(1);

      // 3. data.documents
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {documents: [{id: '1'}]},
      });
      list = await documentApi.list({companionId: 'c1', accessToken: 't'});
      expect(list).toHaveLength(1);

      // 4. data.results
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {results: [{id: '1'}]},
      });
      list = await documentApi.list({companionId: 'c1', accessToken: 't'});
      expect(list).toHaveLength(1);

      // 5. data.items
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {items: [{id: '1'}]},
      });
      list = await documentApi.list({companionId: 'c1', accessToken: 't'});
      expect(list).toHaveLength(1);

      // 6. Direct object keys (documents)
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {documents: [{id: '1'}], someOtherKey: true},
      });
      list = await documentApi.list({companionId: 'c1', accessToken: 't'});
      expect(list).toHaveLength(1);
    });

    it('should map rendered PDF documents into previewable files', async () => {
      (RNFS.downloadFile as jest.Mock).mockReturnValue({
        promise: Promise.resolve({statusCode: 200}),
      });

      const list = await documentApi.listForAppointment({
        appointmentId: 'apt-1',
        companionId: 'comp-1',
        encounterId: 'enc-1',
        accessToken: mockToken,
      });

      expect(list).toHaveLength(1);
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: '/v1/workspace/mobile/encounters/enc-1/document-packet/pdf',
          toFile: '/tmp/clinical-packet-apt-1.pdf',
        }),
      );
      expect(list[0].files[0]).toEqual(
        expect.objectContaining({
          viewUrl: 'file:///tmp/clinical-packet-apt-1.pdf',
          downloadUrl: 'file:///tmp/clinical-packet-apt-1.pdf',
          type: 'application/pdf',
        }),
      );
    });

    it('should return no appointment documents when encounter id is missing', async () => {
      const list = await documentApi.listForAppointment({
        appointmentId: 'apt-1',
        companionId: 'comp-1',
        encounterId: null,
        accessToken: mockToken,
      });

      expect(list).toEqual([]);
      expect(RNFS.downloadFile).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should call search endpoint and normalize results', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: []});
      await documentApi.search({
        companionId: 'c1',
        query: 'foo',
        accessToken: mockToken,
      });
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/search/c1?title=foo'),
        expect.any(Object),
      );
    });
  });

  describe('remove', () => {
    it('should call delete endpoint', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});
      const res = await documentApi.remove({
        documentId: 'd1',
        accessToken: mockToken,
      });
      expect(res).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('d1'),
        expect.any(Object),
      );
    });

    it('should propagate error if delete fails', async () => {
      (apiClient.delete as jest.Mock).mockRejectedValue(
        new Error('Delete failed'),
      );
      await expect(
        documentApi.remove({documentId: 'd1', accessToken: mockToken}),
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('fetchView', () => {
    it('should fetch view data and normalize response', async () => {
      const apiData = {viewUrl: 'http://view', key: 'k1'};
      (apiClient.get as jest.Mock).mockResolvedValue({data: apiData});
      const files = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: mockToken,
      });
      expect(files).toHaveLength(1);
      expect(files[0].viewUrl).toBe('http://view');
    });

    it('should fallback to existing files if response is empty', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: null});
      const existing = [{id: 'f1', uri: 'local'}] as any;
      const files = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: 't',
        existingFiles: existing,
      });
      expect(files[0].id).toBe('f1');
    });

    it('should handle string response (url)', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: 'http://url'});
      const files = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: 't',
      });
      expect(files[0].uri).toBe('http://url');
    });

    it('should normalize direct download url objects when no attachment array is returned', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          downloadUrl: 'http://download',
          contentType: 'application/pdf',
          fileKey: 'download-key',
        },
      });

      const files = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: 't',
      });

      expect(files).toEqual([
        expect.objectContaining({
          key: 'download-key',
          uri: 'http://download',
          viewUrl: 'http://download',
          downloadUrl: 'http://download',
          type: 'application/pdf',
        }),
      ]);
    });

    it('should propagate error', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
      await expect(
        documentApi.fetchView({documentId: 'd1', accessToken: 't'}),
      ).rejects.toThrow('Fetch failed');
    });
  });

  // --- Helper Coverage (via Public Methods) ---
  describe('Helper Coverage via API', () => {
    it('normalizeDocumentFromApi: User Added logic and Pms User', async () => {
      const pmsDoc = {uploadedByPmsUserId: 'pms-1'};
      (apiClient.get as jest.Mock).mockResolvedValue({data: [pmsDoc]});
      const list1 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list1[0].isUserAdded).toBe(false);

      const parentDoc = {uploadedByParentId: 'parent-1'};
      (apiClient.get as jest.Mock).mockResolvedValue({data: [parentDoc]});
      const list2 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list2[0].isUserAdded).toBe(true);

      const boolDoc = {isUserAdded: true};
      (apiClient.get as jest.Mock).mockResolvedValue({data: [boolDoc]});
      const list3 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list3[0].isUserAdded).toBe(true);

      const syncedDoc = {source: 'pms', isUserAdded: true};
      (apiClient.get as jest.Mock).mockResolvedValue({data: [syncedDoc]});
      const list4 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list4[0].isSynced).toBe(true);
      expect(list4[0].isUserAdded).toBe(true);
    });

    it('normalizeDocumentFromApi: Subcategory normalization', async () => {
      const doc1 = {category: 'others', subcategory: null};
      (apiClient.get as jest.Mock).mockResolvedValue({data: [doc1]});
      const list1 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list1[0].subcategory).toBe('weight-logs');

      const doc2 = {category: 'hygiene', subcategory: 'others'};
      (apiClient.get as jest.Mock).mockResolvedValue({data: [doc2]});
      const list2 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list2[0].category).toBe('hygiene-maintenance');
      expect(list2[0].subcategory).toBe('other');

      const doc3 = {
        category: 'health',
        subcategory: 'training-and-behaviour-reports',
      };
      (apiClient.get as jest.Mock).mockResolvedValue({data: [doc3]});
      const list3 = await documentApi.list({
        companionId: 'c',
        accessToken: 't',
      });
      expect(list3[0].subcategory).toBe('training-behaviour');
    });

    it('mapAttachmentFromApi: Size extraction variants', async () => {
      const variants = [
        {size: 10},
        {fileSize: 20},
        {contentLength: 30},
        {nothing: 0},
      ];

      const payload = [
        {id: '1', attachments: [variants[0]]},
        {id: '2', attachments: [variants[1]]},
        {id: '3', attachments: [variants[2]]},
        {id: '4', attachments: [variants[3]]},
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({data: payload});

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].files[0].size).toBe(10);
      expect(list[1].files[0].size).toBe(20);
      expect(list[2].files[0].size).toBe(30);
      expect(list[3].files[0].size).toBe(0);
    });

    it('mapAttachmentFromApi: Name derivation logic and UUID regex', async () => {
      const payload = [
        {id: '1', attachments: [{name: 'Explicit'}]},
        {id: '2', attachments: [{key: 'mock_file_key'}]},
        // UUID case (starts with 8 hex, dash, 4 hex, dash)
        {
          id: '3',
          attachments: [{key: 'mock_uuid_file_key_pdf'}],
        },
        {id: '4', attachments: [{noKey: true}]},
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({data: payload});

      // Mock buildCdnUrlFromKey to return URLs with specific filenames
      (buildCdnUrlFromKey as jest.Mock).mockImplementation(key => {
        if (!key) {
          return null;
        }
        if (key === 'mock_file_key') {
          return 'https://example.com/derived.jpg';
        }
        if (key === 'mock_uuid_file_key_pdf') {
          return 'https://example.com/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-test.pdf';
        }
        return `cdn/${key}`;
      });

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].files[0].name).toBe('Explicit');
      expect(list[1].files[0].name).toBe('derived.jpg');
      // Should keep full name if regex matches UUID pattern
      expect(list[2].files[0].name).toBe(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-test.pdf',
      );
      expect(list[3].files[0].name).toContain('document-');
    });

    it('toSafeIsoString: fallbacks', async () => {
      const doc = {
        createdAt: 'invalid-date',
        issueDate: 'invalid-date',
      };
      (apiClient.get as jest.Mock).mockResolvedValue({data: [doc]});
      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].issueDate).toBe('');
      expect(list[0].createdAt).not.toBe('');
    });

    it('pickAttachmentList: array location variations', async () => {
      const testCase = (input: any) => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({data: [input]});
        return documentApi.list({companionId: 'c', accessToken: 't'});
      };

      // payload.attachments
      let list = await testCase({attachments: [{key: 'k'}]});
      expect(list[0].files).toHaveLength(1);

      // payload.files
      list = await testCase({files: [{key: 'k'}]});
      expect(list[0].files).toHaveLength(1);

      // payload.data (as array)
      list = await testCase({data: [{key: 'k'}]});
      expect(list[0].files).toHaveLength(1);

      // payload.results
      list = await testCase({results: [{key: 'k'}]});
      expect(list[0].files).toHaveLength(1);

      // payload is itself an attachment array
      list = await testCase([{key: 'k'}]);
      expect(list[0].files).toHaveLength(1);
    });

    it('formatAppointmentId: variations', async () => {
      const doc1 = {appointmentId: 123};
      const doc2 = {appointment_id: 456};
      const doc3 = {};

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [doc1, doc2, doc3],
      });
      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].appointmentId).toBe('123');
      expect(list[1].appointmentId).toBe('456');
      expect(list[2].appointmentId).toBe('');
    });

    it('serializeSubcategoryForApi: branches', async () => {
      const {create} = documentApi;
      const callCreate = (cat: string, sub: string | null) =>
        create({
          companionId: '1',
          category: cat,
          subcategory: sub,
          visitType: null,
          title: 't',
          businessName: 'b',
          issueDate: '',
          files: [{key: 'k'}] as any,
          accessToken: 't',
        });

      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

      // Missing subcategory
      await callCreate('health', null);
      expect(apiClient.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({subcategory: ''}),
        expect.any(Object),
      );

      // Category is "others"
      await callCreate('others', 'something');
      expect(apiClient.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({subcategory: ''}),
        expect.any(Object),
      );

      // Subcategory is "other"
      await callCreate('health', 'other');
      expect(apiClient.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({subcategory: ''}),
        expect.any(Object),
      );
    });

    it('normalizeViewResponse: fallback to existing file matching key', async () => {
      const existing = [{key: 'k1', name: 'OriginalName', size: 500}] as any;
      const apiData = {key: 'k1', viewUrl: 'http://new'};

      (apiClient.get as jest.Mock).mockResolvedValue({data: apiData});
      const files = await documentApi.fetchView({
        documentId: 'd',
        accessToken: 't',
        existingFiles: existing,
      });

      expect(files[0].viewUrl).toBe('http://new'); // Check mapped property
      expect(files[0].name).toBe('OriginalName');
      expect(files[0].size).toBe(500);
    });

    it('normalizes visit type and fallback business fields from alternate API keys', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'doc-visit',
            category: 'HEALTH',
            subType: 'LAB_TESTS',
            visit_type_name: 'FOLLOW_UP_VISIT',
            issuing_business_name: 'Clinic Alias',
            attachments: [{storageKey: 'stored-key'}],
          },
        ],
      });

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].subcategory).toBe('lab-tests');
      expect(list[0].visitType).toBe('follow-up-visit');
      expect(list[0].businessName).toBe('Clinic Alias');
      expect(list[0].files[0].key).toBe('stored-key');
    });

    it('normalizes slugs, pdf documents, nested collections, and fallback file urls', async () => {
      (buildCdnUrlFromKey as jest.Mock).mockImplementation(key =>
        key ? `cdn/${key}` : null,
      );
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            data: [
              {
                id: 'nested-doc',
                category: 'HEALTH',
                subcategory: '___PASSPORT___',
                pdfUrl: 'https://example.com/doc.pdf',
                title: 'PDF title',
              },
            ],
          },
        },
      });

      let list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].subcategory).toBe('passport');
      expect(list[0].files[0]).toEqual(
        expect.objectContaining({
          id: 'nested-doc-pdf',
          name: 'PDF title',
          type: 'application/pdf',
          viewUrl: 'https://example.com/doc.pdf',
        }),
      );

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: 'not-a-collection',
          documents: [{id: 'root-documents'}],
        },
      });
      list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list[0].id).toBe('root-documents');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: 'not-a-collection',
          results: [{id: 'root-results'}],
        },
      });
      list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list[0].id).toBe('root-results');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: 'not-a-collection',
          items: [{id: 'root-items'}],
        },
      });
      list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list[0].id).toBe('root-items');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          data: 'not-a-collection',
        },
      });
      list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list).toEqual([]);

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          files: [
            {
              fileKey: 'k1',
              url: {not: 'a-string'},
            },
          ],
        },
      });
      const files = await documentApi.fetchView({
        documentId: 'd',
        accessToken: 't',
        existingFiles: [
          {
            key: 'k1',
            uri: 'file://local',
            s3Url: 'https://fallback.example/file.pdf',
          },
        ] as any,
      });

      expect(files[0]).toEqual(
        expect.objectContaining({
          uri: 'file://local',
          s3Url: 'https://fallback.example/file.pdf',
          viewUrl: 'cdn/k1',
          downloadUrl: 'cdn/k1',
        }),
      );
    });

    it('uses trimmed API base URLs and rejects failed appointment packet downloads', async () => {
      (apiClient.defaults as any).baseURL = 'https://api.example.com///';
      (RNFS.downloadFile as jest.Mock).mockReturnValueOnce({
        promise: Promise.resolve({statusCode: 500}),
      });

      await expect(
        documentApi.listForAppointment({
          appointmentId: 'apt-1',
          companionId: 'comp-1',
          encounterId: '/enc-1/',
          accessToken: mockToken,
        }),
      ).rejects.toThrow('Unable to load appointment document packet.');

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl:
            'https://api.example.com/v1/workspace/mobile/encounters/%2Fenc-1%2F/document-packet/pdf',
        }),
      );
    });

    it('falls back to CachesDirectoryPath when TemporaryDirectoryPath is unavailable', async () => {
      const original = (RNFS as any).TemporaryDirectoryPath;
      (RNFS as any).TemporaryDirectoryPath = undefined;

      await documentApi.listForAppointment({
        appointmentId: 'apt-2',
        companionId: 'comp-1',
        encounterId: 'enc-2',
        accessToken: mockToken,
      });

      expect(RNFS.mkdir).toHaveBeenCalledWith('/tmp');
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({toFile: '/tmp/clinical-packet-apt-2.pdf'}),
      );

      (RNFS as any).TemporaryDirectoryPath = original;
    });
  });

  describe('search results', () => {
    it('normalizes non-empty search results', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [{id: 'search-doc', category: 'HEALTH'}],
      });

      const results = await documentApi.search({
        companionId: 'c1',
        query: 'foo',
        accessToken: mockToken,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('search-doc');
    });
  });

  describe('uploadAttachment fallback branches', () => {
    it('uses default mime type and falls back to file.key in the error message when name is missing', async () => {
      const file = {key: '', uri: undefined} as any;
      await expect(
        documentApi.uploadAttachment({
          file,
          companionId: mockCompanionId,
          accessToken: mockToken,
        }),
      ).rejects.toThrow('unknown file');
    });

    it('falls back to file.key in the error message when only key is present', async () => {
      const file = {key: undefined, name: undefined, uri: undefined} as any;
      await expect(
        documentApi.uploadAttachment({
          file,
          companionId: mockCompanionId,
          accessToken: mockToken,
        }),
      ).rejects.toThrow('unknown file');
    });

    it('defaults mimeType to application/octet-stream when file.type is missing', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {uploadUrl: 'http://put', key: 'new-key'},
      });

      await documentApi.uploadAttachment({
        file: {uri: 'file://path', name: 'test'} as any,
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({mimeType: 'application/octet-stream'}),
        expect.any(Object),
      );
      expect(uploadFileToPresignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({mimeType: 'application/octet-stream'}),
      );
    });

    it('preserves original file s3Url/downloadUrl/viewUrl when upload response has no fileUrl and no cdn url', async () => {
      (buildCdnUrlFromKey as jest.Mock).mockReturnValue(null);
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: {uploadUrl: 'http://put', key: 'new-key'},
      });

      const res = await documentApi.uploadAttachment({
        file: {
          uri: 'file://path',
          name: 'test.jpg',
          type: 'image/jpeg',
          size: 10,
          s3Url: 'https://original.example/s3',
          downloadUrl: 'https://original.example/download',
          viewUrl: 'https://original.example/view',
        } as any,
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(res.s3Url).toBe('https://original.example/s3');
      expect(res.downloadUrl).toBe('https://original.example/download');
      expect(res.viewUrl).toBe('https://original.example/view');
    });
  });

  describe('create/update attachments filtering', () => {
    it('excludes files without a key from the attachments payload on create', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});
      const files = [{key: 'k1'}, {key: undefined}] as any;

      await documentApi.create({
        companionId: mockCompanionId,
        category: 'health',
        subcategory: null,
        visitType: null,
        title: 't',
        businessName: 'b',
        issueDate: '',
        files,
        accessToken: mockToken,
      });

      const callArg = (apiClient.post as jest.Mock).mock.calls[0][1];
      expect(callArg.attachments).toHaveLength(1);
      expect(callArg.attachments[0].key).toBe('k1');
    });

    it('excludes files without a key from the attachments payload on update', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: {id: 'doc-1'},
      });
      const files = [{key: 'k1'}, {key: undefined}] as any;

      await documentApi.update({
        documentId: 'doc-1',
        category: 'admin',
        subcategory: null,
        visitType: null,
        title: 't',
        businessName: 'b',
        issueDate: '',
        files,
        accessToken: mockToken,
      });

      const callArg = (apiClient.patch as jest.Mock).mock.calls[0][1];
      expect(callArg.attachments).toHaveLength(1);
      expect(callArg.attachments[0].key).toBe('k1');
    });
  });

  describe('mapAttachmentFromApi deep fallback chains', () => {
    it('derives cdnUrl from the raw key when buildCdnUrlFromKey returns null', async () => {
      (buildCdnUrlFromKey as jest.Mock).mockReturnValue(null);
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [{id: '1', attachments: [{key: 'local/photo.jpg'}]}],
      });

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].files[0].viewUrl).toBe('local/photo.jpg');
    });

    it('falls back through fallback.s3Url and fallback.uri when candidate has no identifying fields or url', async () => {
      (buildCdnUrlFromKey as jest.Mock).mockImplementation(k =>
        k ? `cdn/${k}` : null,
      );
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {attachments: [{}]},
      });

      const withS3Fallback = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: 't',
        existingFiles: [
          {uri: 'file://local', s3Url: 'https://fallback.example/original.jpg'},
        ] as any,
      });

      expect(withS3Fallback[0].viewUrl).toBe(
        'https://fallback.example/original.jpg',
      );

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {attachments: [{}]},
      });

      const withUriFallback = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: 't',
        existingFiles: [{uri: 'file://only-local'}] as any,
      });

      expect(withUriFallback[0].uri).toBe('file://only-local');
    });

    it('returns null cdnUrl and empty uri when no key, url, or fallback fields are present', async () => {
      (buildCdnUrlFromKey as jest.Mock).mockReturnValue(null);
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [{id: '1', attachments: [{}]}],
      });

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].files[0].uri).toBe('');
      expect(list[0].files[0].viewUrl).toBeUndefined();
    });
  });

  describe('pdfUrl document id/name fallback chain', () => {
    it('falls back to payload.documentId then the literal "document" for the pdf id, and documentTitle then literal name', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            documentId: 'doc-alt-id',
            pdfUrl: 'https://example.com/a.pdf',
            documentTitle: 'Alt Title',
          },
        ],
      });
      let list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list[0].files[0].id).toBe('doc-alt-id-pdf');
      expect(list[0].files[0].name).toBe('Alt Title');

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [{pdfUrl: 'https://example.com/b.pdf'}],
      });
      list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list[0].files[0].id).toBe('document-pdf');
      expect(list[0].files[0].name).toBe('Rendered document');
    });
  });

  describe('serializeSubcategoryForApi and normalizeSubcategoryFromApi edge branches', () => {
    it('maps to weight-logs when both category and subcategory normalize to "others"', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [{category: 'others', subcategory: 'others'}],
      });
      const list = await documentApi.list({companionId: 'c', accessToken: 't'});
      expect(list[0].subcategory).toBe('weight-logs');
    });

    it('serializes an empty subcategory when category is null', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({data: {}});
      await documentApi.create({
        companionId: '1',
        category: null as any,
        subcategory: 'prescription',
        visitType: null,
        title: 't',
        businessName: 'b',
        issueDate: '',
        files: [{key: 'k'}] as any,
        accessToken: 't',
      });
      expect(apiClient.post).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({subcategory: 'PRESCRIPTION'}),
        expect.any(Object),
      );
    });
  });

  describe('buildApiUrl with an unset baseURL', () => {
    it('builds the endpoint URL when apiClient.defaults.baseURL is undefined', async () => {
      (apiClient.defaults as any).baseURL = undefined;

      await documentApi.listForAppointment({
        appointmentId: 'apt-3',
        companionId: 'comp-1',
        encounterId: 'enc-3',
        accessToken: mockToken,
      });

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: '/v1/workspace/mobile/encounters/enc-3/document-packet/pdf',
        }),
      );
    });
  });

  describe('deriveNameFromKey and id resolution edge branches', () => {
    it('falls back to the default document name when the key has no segments after trimming slashes', async () => {
      (buildCdnUrlFromKey as jest.Mock).mockReturnValue(null);
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [{id: '1', attachments: [{key: '///'}]}],
      });

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].files[0].name).toContain('document-');
    });

    it('resolves the file id from _id when id is absent', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [{id: '1', attachments: [{_id: 'mongo-id-1'}]}],
      });

      const list = await documentApi.list({companionId: 'c', accessToken: 't'});

      expect(list[0].files[0].id).toBe('mongo-id-1');
    });
  });

  describe('normalizeViewResponse object payload without url fields', () => {
    it('falls back to existing files when the object payload has no attachments or url-like fields', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: {}});
      const existing = [{id: 'f1', uri: 'local'}] as any;

      const files = await documentApi.fetchView({
        documentId: 'd1',
        accessToken: 't',
        existingFiles: existing,
      });

      expect(files).toEqual([{id: 'f1', uri: 'local'}]);
    });
  });
});
