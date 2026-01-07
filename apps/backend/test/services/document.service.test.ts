import { Types } from 'mongoose';
import { DocumentService } from '../../src/services/document.service';
import DocumentModel from '../../src/models/document';
import * as UploadMiddleware from '../../src/middlewares/upload';

// --- Mocks ---
jest.mock('../../src/models/document');
jest.mock('../../src/middlewares/upload');

describe('DocumentService', () => {
  const validObjectId = new Types.ObjectId().toString();
  const validParentId = new Types.ObjectId().toString();
  const validCompanionId = new Types.ObjectId().toString();

  const mockDate = new Date('2023-01-01T00:00:00.000Z');

  // Helper to create a mock document structure
  const createMockDoc = (overrides = {}) => {
    const data = {
      _id: new Types.ObjectId(validObjectId),
      companionId: new Types.ObjectId(validCompanionId),
      uploadedByParentId: new Types.ObjectId(validParentId),
      category: 'HEALTH',
      subcategory: 'HOSPITAL_VISITS',
      title: 'Test Doc',
      attachments: [{ key: 'k1', mimeType: 'application/pdf', size: 1024 }],
      pmsVisible: true,
      syncedFromPms: false,
      createdAt: mockDate,
      updatedAt: mockDate,
      ...overrides,
    };
    return {
      ...data,
      toObject: () => data,
      save: jest.fn().mockResolvedValue(true),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Validation & Input Handling
  describe('Input Validation', () => {
    const validInput: any = {
      companionId: validCompanionId,
      category: 'HEALTH',
      subcategory: 'HOSPITAL_VISITS',
      title: 'Report',
      attachments: [{ key: 'k1', mimeType: 'pdf' }],
      issueDate: '2023-01-01'
    };

    it('should throw if title is empty', async () => {
      await expect(DocumentService.create({ ...validInput, title: ' ' }, { parentId: validParentId }))
        .rejects.toThrow('Document title is required.');
    });

    it('should throw if attachments are empty', async () => {
      await expect(DocumentService.create({ ...validInput, attachments: [] }, { parentId: validParentId }))
        .rejects.toThrow('At least one attachment is required.');
    });

    it('should throw if ID is invalid format', async () => {
      await expect(DocumentService.create({ ...validInput, companionId: 'invalid' }, { parentId: validParentId }))
        .rejects.toThrow('Invalid companionId');
    });

    it('should throw if category is invalid', async () => {
      await expect(DocumentService.create({ ...validInput, category: 'INVALID' }, { parentId: validParentId }))
        .rejects.toThrow('Invalid document category: INVALID');
    });

    it('should throw if subcategory is invalid for category', async () => {
      await expect(DocumentService.create({
          ...validInput,
          category: 'HEALTH',
          subcategory: 'PASSPORT' // PASSPORT is ADMIN, not HEALTH
        }, { parentId: validParentId }))
        .rejects.toThrow("Invalid subcategory 'PASSPORT' for category 'HEALTH'");
    });
  });

  // 2. Create Document
  describe('create', () => {
    const input: any = {
        companionId: validCompanionId,
        category: 'HEALTH',
        subcategory: 'HOSPITAL_VISITS',
        title: 'Report',
        attachments: [{ key: 'k1', mimeType: 'pdf' }],
        issueDate: mockDate
    };

    it('should create document from Parent source', async () => {
        const mockDoc = createMockDoc();
        (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

        const res = await DocumentService.create(input, { parentId: validParentId });

        expect(DocumentModel.create).toHaveBeenCalledWith(expect.objectContaining({
            uploadedByParentId: expect.any(Types.ObjectId),
            syncedFromPms: false
        }));
        expect(res.id).toBe(validObjectId);
    });

    it('should create document from PMS source', async () => {
        const mockDoc = createMockDoc({ uploadedByPmsUserId: 'pms1', uploadedByParentId: null });
        (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

        const res = await DocumentService.create(input, { pmsUserId: 'pms1' });

        expect(DocumentModel.create).toHaveBeenCalledWith(expect.objectContaining({
            uploadedByPmsUserId: 'pms1',
            syncedFromPms: true
        }));
        expect(res.uploadedByPmsUserId).toBe('pms1');
    });

    it('should handle string date input', async () => {
        const mockDoc = createMockDoc();
        (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

        await DocumentService.create({ ...input, issueDate: '2023-01-01' }, { parentId: validParentId });

        expect(DocumentModel.create).toHaveBeenCalledWith(expect.objectContaining({
            issueDate: new Date('2023-01-01')
        }));
    });
  });

  // 3. List Methods
  describe('List Operations', () => {
    const mockFindChain = (docs: any[]) => ({
        sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(docs)
        })
    });

    it('listForParent: should filter by companion and optional categories', async () => {
        (DocumentModel.find as jest.Mock).mockReturnValue(mockFindChain([createMockDoc()]));

        await DocumentService.listForParent({
            companionId: validCompanionId,
            category: 'HEALTH',
            subcategory: 'HOSPITAL_VISITS'
        });

        expect(DocumentModel.find).toHaveBeenCalledWith({
            companionId: expect.any(Types.ObjectId),
            category: 'HEALTH',
            subcategory: 'HOSPITAL_VISITS'
        });
    });

    it('listForPms: should filter only pmsVisible documents', async () => {
        (DocumentModel.find as jest.Mock).mockReturnValue(mockFindChain([createMockDoc()]));

        await DocumentService.listForPms({ companionId: validCompanionId });

        expect(DocumentModel.find).toHaveBeenCalledWith(expect.objectContaining({
            pmsVisible: true
        }));
    });

    it('listForAppointmentParent: should filter by appointmentId', async () => {
        (DocumentModel.find as jest.Mock).mockReturnValue(mockFindChain([createMockDoc()]));

        await DocumentService.listForAppointmentParent(validObjectId);

        expect(DocumentModel.find).toHaveBeenCalledWith({ appointmentId: expect.any(Types.ObjectId) });
    });

    it('listForAppointmentPms: should filter by appointmentId AND pmsVisible', async () => {
        (DocumentModel.find as jest.Mock).mockReturnValue(mockFindChain([createMockDoc()]));

        await DocumentService.listForAppointmentPms({
            companionId: validCompanionId,
            appointmentId: validObjectId
        });

        expect(DocumentModel.find).toHaveBeenCalledWith(expect.objectContaining({
            pmsVisible: true,
            appointmentId: expect.any(Types.ObjectId)
        }));
    });
  });

  // 4. Get By ID
  describe('getById', () => {
      it('getByIdForParent: returns null if not found', async () => {
          (DocumentModel.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
          expect(await DocumentService.getByIdForParent(validObjectId)).toBeNull();
      });

      it('getByIdForParent: returns dto if found', async () => {
          (DocumentModel.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(createMockDoc()) });
          const res = await DocumentService.getByIdForParent(validObjectId);
          expect(res?.id).toBe(validObjectId);
      });

      it('getByIdForPms: returns null if not found or not visible', async () => {
        (DocumentModel.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
        expect(await DocumentService.getByIdForPms(validObjectId)).toBeNull();
      });
  });

  // 5. Delete
  describe('deleteForParent', () => {
      it('should throw 404 if document does not exist or parent does not own it', async () => {
          (DocumentModel.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

          await expect(DocumentService.deleteForParent(validObjectId, validParentId))
            .rejects.toThrow('Document not found or not deletable.');
      });

      it('should delete from S3 and DB if valid', async () => {
          const doc = createMockDoc({ attachments: [{ key: 'k1' }, { key: 'k2' }] });
          (DocumentModel.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
          (DocumentModel.deleteOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

          await DocumentService.deleteForParent(validObjectId, validParentId);

          expect(UploadMiddleware.deleteFromS3).toHaveBeenCalledTimes(2);
          expect(DocumentModel.deleteOne).toHaveBeenCalled();
      });
  });

  // 6. Update
  describe('update', () => {
      it('should throw 404 if not found', async () => {
          (DocumentModel.findById as jest.Mock).mockResolvedValue(null);
          await expect(DocumentService.update(validObjectId, {}, {}))
            .rejects.toThrow('Document not found');
      });

      it('should throw 403 if parent tries to update others doc', async () => {
          const doc = createMockDoc({ uploadedByParentId: new Types.ObjectId() }); // different parent
          (DocumentModel.findById as jest.Mock).mockResolvedValue(doc);

          await expect(DocumentService.update(validObjectId, {}, { parentId: validParentId }))
            .rejects.toThrow('Parent is not allowed to update this document');
      });

      it('should throw 403 if PMS tries to update parent doc', async () => {
        const doc = createMockDoc({ syncedFromPms: false });
        (DocumentModel.findById as jest.Mock).mockResolvedValue(doc);

        await expect(DocumentService.update(validObjectId, {}, { pmsUserId: 'pms1' }))
          .rejects.toThrow('PMS cannot update documents uploaded by parent');
      });

      it('should update fields and save', async () => {
          const doc = createMockDoc({ uploadedByParentId: new Types.ObjectId(validParentId) });
          (DocumentModel.findById as jest.Mock).mockResolvedValue(doc);

          const updates: any = {
              title: 'New Title',
              category: 'ADMIN',
              subcategory: 'PASSPORT',
              attachments: [{ key: 'new', mimeType: 'img', size: 10 }]
          };

          await DocumentService.update(validObjectId, updates, { parentId: validParentId });

          expect(doc.title).toBe('New Title');
          expect(doc.category).toBe('ADMIN');
          expect(doc.attachments[0].key).toBe('new');
          expect(doc.save).toHaveBeenCalled();
      });
  });

  // 7. Search & Attachments
  describe('Misc', () => {
      it('getAllAttachmentUrls: should throw if no attachments', async () => {
          const doc = createMockDoc({ attachments: [] });
          (DocumentModel.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

          await expect(DocumentService.getAllAttachmentUrls(validObjectId)).rejects.toThrow('No attachments found');
      });

      it('getAllAttachmentUrls: should return presigned urls', async () => {
          const doc = createMockDoc();
          (DocumentModel.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
          (UploadMiddleware.generatePresignedDownloadUrl as jest.Mock).mockResolvedValue('http://url');

          const res = await DocumentService.getAllAttachmentUrls(validObjectId);
          expect(res[0].url).toBe('http://url');
      });

      it('searchByTitleForParent: should return matching docs', async () => {
          const mockChain = {
             sort: jest.fn().mockReturnValue({
                 exec: jest.fn().mockResolvedValue([createMockDoc()])
             })
          };
          (DocumentModel.find as jest.Mock).mockReturnValue(mockChain);

          const res = await DocumentService.searchByTitleForParent({ companionId: validCompanionId, title: 'Test' });
          expect(res).toHaveLength(1);
      });

      it('searchByTitleForParent: should throw if title missing', async () => {
         await expect(DocumentService.searchByTitleForParent({ companionId: validCompanionId, title: '' }))
            .rejects.toThrow('Search title is required');
      });
  });
});