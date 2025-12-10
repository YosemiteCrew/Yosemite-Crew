import { documentApi } from '@/features/documents/services/documentService';
import apiClient from '@/shared/services/apiClient';
import { uploadFileToPresignedUrl } from '@/shared/services/uploadService';
import { generateId } from '@/shared/utils/helpers';
import { buildCdnUrlFromKey } from '@/shared/utils/cdnHelpers';

// --- Mocks ---
jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
  },
  withAuthHeaders: jest.fn((token) => ({ Authorization: `Bearer ${token}` })),
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

jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: jest.fn((uri) => uri),
}));

describe('documentService', () => {
  const mockToken = 'mock-token';
  const mockCompanionId = 'companion-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (generateId as jest.Mock).mockReturnValue('mock-uuid');
    (buildCdnUrlFromKey as jest.Mock).mockImplementation((k) => `cdn/${k}`);
  });

  describe('requestUploadUrl', () => {
    it('should return upload metadata on success', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { uploadUrl: 'http://upload', key: 'file-key', fileUrl: 'http://file' },
      });

      const res = await documentApi.requestUploadUrl({
        mimeType: 'image/jpeg',
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(res).toEqual({ uploadUrl: 'http://upload', key: 'file-key', fileUrl: 'http://file' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/document/mobile/upload-url',
        { mimeType: 'image/jpeg', companionId: mockCompanionId },
        expect.any(Object)
      );
    });

    it('should throw error if response is missing uploadUrl or key', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      await expect(
        documentApi.requestUploadUrl({
          mimeType: 'image/png',
          companionId: mockCompanionId,
          accessToken: mockToken,
        })
      ).rejects.toThrow('Unable to request upload URL');
    });

    it('should handle nested data structure in response', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
            data: { data: { uploadUrl: 'url', key: 'key' } }
        });
        const res = await documentApi.requestUploadUrl({ mimeType: 't', companionId: 'c', accessToken: 't'});
        expect(res.uploadUrl).toBe('url');
    });

    it('should handle alternate key names', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
            data: { signedUrl: 'url', fileKey: 'key' }
        });
        const res = await documentApi.requestUploadUrl({ mimeType: 't', companionId: 'c', accessToken: 't'});
        expect(res.uploadUrl).toBe('url');
        expect(res.key).toBe('key');
    });
  });

  describe('uploadAttachment', () => {
    const fileBase = { uri: 'file://path', name: 'test.jpg', size: 100, type: 'image/jpeg' };

    it('should return file immediately if it already has a key', async () => {
      const file = { ...fileBase, key: 'existing-key' };
      const res = await documentApi.uploadAttachment({ file: file as any, companionId: mockCompanionId, accessToken: mockToken });
      expect(res.key).toBe('existing-key');
      expect(uploadFileToPresignedUrl).not.toHaveBeenCalled();
    });

    it('should throw if file uri is missing', async () => {
      // IMPORTANT: We must mock a successful requestUploadUrl response first,
      // because the service code calls API *before* checking !file.uri
      (apiClient.post as jest.Mock).mockResolvedValue({
          data: { uploadUrl: 'http://url', key: 'k' }
      });

      const file = { name: 'test.jpg' } as any; // No uri
      await expect(
        documentApi.uploadAttachment({ file, companionId: mockCompanionId, accessToken: mockToken })
      ).rejects.toThrow('File path missing');
    });

    it('should perform upload flow and return new file object', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { uploadUrl: 'http://put', key: 'new-key', fileUrl: 'http://view' },
      });

      const res = await documentApi.uploadAttachment({
        file: fileBase as any,
        companionId: mockCompanionId,
        accessToken: mockToken,
      });

      expect(uploadFileToPresignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://put', expectedSize: 100 })
      );
      expect(res.key).toBe('new-key');
      expect(res.viewUrl).toBe('http://view');
    });

    it('should fallback to cdn url if viewUrl is missing', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
            data: { uploadUrl: 'http://put', key: 'new-key' },
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
        })
      ).rejects.toThrow('Please upload at least one document');
    });

    it('should handle successful creation and map response', async () => {
      const files = [{ key: 'k1', type: 'image/png', uri: 'f1' }];
      const apiResponse = {
        id: 'doc-1',
        category: 'HEALTH',
        attachments: [{ key: 'k1', url: 'http://k1' }],
        createdAt: '2023-01-01T00:00:00.000Z'
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: apiResponse });

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
        expect.any(Object)
      );

      expect(res.id).toBe('doc-1');
      expect(res.files[0].viewUrl).toBe('http://k1');
    });

    it('should map alias categories correctly and return enriched input files on empty response', async () => {
        const files = [{ key: 'k1' }];
        (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

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
                subcategory: 'GROOMER_VISIT',
                issueDate: ''
            }),
            expect.any(Object)
        );

        expect(res.files).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: 'k1' })
            ])
        );
    });

    it('should handle "others" category mapping', async () => {
        const files = [{ key: 'k1' }];
        (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
        await documentApi.create({
            companionId: '1', category: 'others', subcategory: null, visitType: null, title: 't', businessName: 'b', issueDate: '', files: files as any, accessToken: 't'
        });
        expect(apiClient.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ category: 'OTHERS' }),
            expect.any(Object)
        );
    });
  });

  describe('update', () => {
    it('should call patch and normalize response', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: { id: 'doc-1', title: 'Updated' }
      });

      const res = await documentApi.update({
        documentId: 'doc-1',
        category: 'admin',
        subcategory: null,
        visitType: null,
        title: 'Updated',
        businessName: 'Biz',
        issueDate: '',
        files: [{ key: 'k1' }] as any,
        accessToken: mockToken
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('doc-1'),
        expect.objectContaining({ title: 'Updated' }),
        expect.any(Object)
      );
      expect(res.title).toBe('Updated');
    });

    it('should handle missing files in update payload', async () => {
        (apiClient.patch as jest.Mock).mockResolvedValue({ data: null });

        await documentApi.update({
            documentId: 'd1', category: 'c', subcategory: null, visitType: null, title: 't', businessName: 'b', issueDate: '',
            files: undefined,
            accessToken: 't'
        });

        const callArg = (apiClient.patch as jest.Mock).mock.calls[0][1];
        expect(callArg.attachments).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should fetch and normalize a list of documents', async () => {
      const mockData = [
        {
          id: '1',
          category: 'ADMIN',
          subcategory: 'PASSPORT',
          attachments: [{ key: 'a1', size: 1024 }]
        }
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: mockData } });

      const list = await documentApi.list({ companionId: 'c1', accessToken: mockToken });

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('1');
      expect(list[0].category).toBe('admin');
      expect(list[0].files[0].size).toBe(1024);
    });

    it('should handle various collection structures (extractDocumentsCollection coverage)', async () => {
       // 1. data.data
       (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { data: [{ id: '1' }] } });
       let list = await documentApi.list({ companionId: 'c1', accessToken: 't' });
       expect(list).toHaveLength(1);

       // 2. root array
       (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [{ id: '1' }] });
       list = await documentApi.list({ companionId: 'c1', accessToken: 't' });
       expect(list).toHaveLength(1);

       // 3. data.documents
       (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { documents: [{ id: '1' }] } });
       list = await documentApi.list({ companionId: 'c1', accessToken: 't' });
       expect(list).toHaveLength(1);

       // 4. data.results
       (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { results: [{ id: '1' }] } });
       list = await documentApi.list({ companionId: 'c1', accessToken: 't' });
       expect(list).toHaveLength(1);

       // 5. data.items
       (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { items: [{ id: '1' }] } });
       list = await documentApi.list({ companionId: 'c1', accessToken: 't' });
       expect(list).toHaveLength(1);

       // 6. Direct object keys (documents)
       (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { documents: [{ id: '1' }], someOtherKey: true } });
       list = await documentApi.list({ companionId: 'c1', accessToken: 't' });
       expect(list).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('should call search endpoint and normalize results', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      await documentApi.search({ companionId: 'c1', query: 'foo', accessToken: mockToken });
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/search/c1?title=foo'),
        expect.any(Object)
      );
    });
  });

  describe('remove', () => {
    it('should call delete endpoint', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});
      const res = await documentApi.remove({ documentId: 'd1', accessToken: mockToken });
      expect(res).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('d1'),
        expect.any(Object)
      );
    });

    it('should propagate error if delete fails', async () => {
        (apiClient.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'));
        await expect(documentApi.remove({ documentId: 'd1', accessToken: mockToken }))
            .rejects.toThrow('Delete failed');
    });
  });

  describe('fetchView', () => {
    it('should fetch view data and normalize response', async () => {
      const apiData = { viewUrl: 'http://view', key: 'k1' };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: apiData });
      const files = await documentApi.fetchView({ documentId: 'd1', accessToken: mockToken });
      expect(files).toHaveLength(1);
      expect(files[0].viewUrl).toBe('http://view');
    });

    it('should fallback to existing files if response is empty', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
        const existing = [{ id: 'f1', uri: 'local' }] as any;
        const files = await documentApi.fetchView({
            documentId: 'd1', accessToken: 't', existingFiles: existing
        });
        expect(files[0].id).toBe('f1');
    });

    it('should handle string response (url)', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: 'http://url' });
        const files = await documentApi.fetchView({ documentId: 'd1', accessToken: 't' });
        expect(files[0].uri).toBe('http://url');
    });

    it('should propagate error', async () => {
        (apiClient.get as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
        await expect(documentApi.fetchView({ documentId: 'd1', accessToken: 't' }))
            .rejects.toThrow('Fetch failed');
    });
  });

  // --- Helper Coverage (via Public Methods) ---
  describe('Helper Coverage via API', () => {

    it('normalizeDocumentFromApi: User Added logic and Pms User', async () => {
        const pmsDoc = { uploadedByPmsUserId: 'pms-1' };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [pmsDoc] });
        const list1 = await documentApi.list({ companionId: 'c', accessToken: 't' });
        expect(list1[0].isUserAdded).toBe(false);

        const parentDoc = { uploadedByParentId: 'parent-1' };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [parentDoc] });
        const list2 = await documentApi.list({ companionId: 'c', accessToken: 't' });
        expect(list2[0].isUserAdded).toBe(true);

        const boolDoc = { isUserAdded: true };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [boolDoc] });
        const list3 = await documentApi.list({ companionId: 'c', accessToken: 't' });
        expect(list3[0].isUserAdded).toBe(true);
    });

    it('normalizeDocumentFromApi: Subcategory normalization', async () => {
        const doc1 = { category: 'others', subcategory: null };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [doc1] });
        const list1 = await documentApi.list({ companionId: 'c', accessToken: 't' });
        expect(list1[0].subcategory).toBe('other');

        const doc2 = { category: 'hygiene', subcategory: 'others' };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [doc2] });
        const list2 = await documentApi.list({ companionId: 'c', accessToken: 't' });
        expect(list2[0].category).toBe('hygiene-maintenance');
        expect(list2[0].subcategory).toBe('other');
    });

    it('mapAttachmentFromApi: Size extraction variants', async () => {
        const variants = [
            { size: 10 },
            { fileSize: 20 },
            { contentLength: 30 },
            { nothing: 0 }
        ];

        const payload = [
            { id: '1', attachments: [variants[0]] },
            { id: '2', attachments: [variants[1]] },
            { id: '3', attachments: [variants[2]] },
            { id: '4', attachments: [variants[3]] }
        ];
        (apiClient.get as jest.Mock).mockResolvedValue({ data: payload });

        const list = await documentApi.list({ companionId: 'c', accessToken: 't' });

        expect(list[0].files[0].size).toBe(10);
        expect(list[1].files[0].size).toBe(20);
        expect(list[2].files[0].size).toBe(30);
        expect(list[3].files[0].size).toBe(0);
    });

    it('mapAttachmentFromApi: Name derivation logic and UUID regex', async () => {
        const payload = [
            { id: '1', attachments: [{ name: 'Explicit' }] },
            { id: '2', attachments: [{ key: 'path/to/derived.jpg' }] },
            // UUID case (starts with 8 hex, dash, 4 hex, dash)
            { id: '3', attachments: [{ key: '12345678-1234-1234-1234-1234567890ab-uuid.pdf' }] },
            { id: '4', attachments: [{ noKey: true }] }
        ];
        (apiClient.get as jest.Mock).mockResolvedValue({ data: payload });

        const list = await documentApi.list({ companionId: 'c', accessToken: 't' });

        expect(list[0].files[0].name).toBe('Explicit');
        expect(list[1].files[0].name).toBe('derived.jpg');
        // Should keep full name if regex matches UUID pattern
        expect(list[2].files[0].name).toBe('12345678-1234-1234-1234-1234567890ab-uuid.pdf');
        expect(list[3].files[0].name).toContain('document-');
    });

    it('toSafeIsoString: fallbacks', async () => {
        const doc = {
            createdAt: 'invalid-date',
            issueDate: 'invalid-date'
        };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [doc] });
        const list = await documentApi.list({ companionId: 'c', accessToken: 't' });

        expect(list[0].issueDate).toBe('');
        expect(list[0].createdAt).not.toBe('');
    });

    it('pickAttachmentList: array location variations', async () => {
        const testCase = (input: any) => {
            (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [input] });
            return documentApi.list({ companionId: 'c', accessToken: 't' });
        };

        // payload.attachments
        let list = await testCase({ attachments: [{ key: 'k' }] });
        expect(list[0].files).toHaveLength(1);

        // payload.files
        list = await testCase({ files: [{ key: 'k' }] });
        expect(list[0].files).toHaveLength(1);

        // payload.data (as array)
        list = await testCase({ data: [{ key: 'k' }] });
        expect(list[0].files).toHaveLength(1);
    });

    it('formatAppointmentId: variations', async () => {
        const doc1 = { appointmentId: 123 };
        const doc2 = { appointment_id: 456 };
        const doc3 = {};

        (apiClient.get as jest.Mock).mockResolvedValue({ data: [doc1, doc2, doc3] });
        const list = await documentApi.list({ companionId: 'c', accessToken: 't' });

        expect(list[0].appointmentId).toBe('123');
        expect(list[1].appointmentId).toBe('456');
        expect(list[2].appointmentId).toBe('');
    });

    it('serializeSubcategoryForApi: branches', async () => {
        const { create } = documentApi;
        const callCreate = (cat: string, sub: string | null) =>
             create({ companionId: '1', category: cat, subcategory: sub, visitType: null, title: 't', businessName: 'b', issueDate: '', files: [{key:'k'}] as any, accessToken: 't' });

        (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

        // Missing subcategory
        await callCreate('health', null);
        expect(apiClient.post).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ subcategory: '' }), expect.any(Object));

        // Category is "others"
        await callCreate('others', 'something');
        expect(apiClient.post).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ subcategory: '' }), expect.any(Object));

        // Subcategory is "other"
        await callCreate('health', 'other');
        expect(apiClient.post).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ subcategory: '' }), expect.any(Object));
    });

    it('normalizeViewResponse: fallback to existing file matching key', async () => {
        const existing = [{ key: 'k1', name: 'OriginalName', size: 500 }] as any;
        const apiData = { key: 'k1', viewUrl: 'http://new' };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: apiData });
        const files = await documentApi.fetchView({ documentId: 'd', accessToken: 't', existingFiles: existing });

        expect(files[0].viewUrl).toBe('http://new'); // Check mapped property
        expect(files[0].name).toBe('OriginalName');
        expect(files[0].size).toBe(500);
    });
  });
});