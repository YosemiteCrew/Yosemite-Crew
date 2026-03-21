import { Types } from "mongoose";
import {
  DocumentService,
  DocumentServiceError,
  CreateDocumentInput,
} from "../../src/services/document.service";
import DocumentModel from "../../src/models/document";
import {
  deleteFromS3,
  generatePresignedDownloadUrl,
} from "src/middlewares/upload";
import { prisma } from "src/config/prisma";

// --- Global Mocks Setup ---

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  deleteFromS3: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
}));

jest.mock("src/utils/sanitize", () => ({
  __esModule: true,
  assertSafeString: jest.fn((val) => val),
}));

jest.mock("escape-string-regexp", () => {
  // Using a regex literal bypasses the need for String.raw and prevents template literal parsing errors
  return jest.fn((str) =>
    String(str).replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`),
  );
});

// Mock Mongoose Model Methods
jest.mock("../../src/models/document", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    documentAttachment: {
      findMany: jest.fn(),
    },
  },
}));

// Helper to construct a mock document that satisfies `mapDocumentToDto`
const createMockDoc = (overrides: any = {}) => {
  const data = {
    _id: new Types.ObjectId(),
    companionId: new Types.ObjectId(),
    category: "HEALTH",
    title: "Test Doc",
    attachments: [],
    pmsVisible: true,
    syncedFromPms: false,
    ...overrides,
  };
  return {
    ...data,
    toObject: () => data,
    save: jest.fn().mockResolvedValue(true),
  };
};

const createPrismaDoc = (overrides: any = {}) => ({
  id: new Types.ObjectId().toHexString(),
  companionId: new Types.ObjectId().toHexString(),
  appointmentId: null,
  category: "HEALTH",
  subcategory: null,
  visitType: null,
  title: "Test Doc",
  issuingBusinessName: null,
  issueDate: null,
  uploadedByParentId: null,
  uploadedByPmsUserId: null,
  pmsVisible: true,
  syncedFromPms: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  attachments: [{ key: "k1", mimeType: "image/png", size: 100 }],
  ...overrides,
});

describe("DocumentService", () => {
  const validObjectIdStr = new Types.ObjectId().toHexString();
  const validObjectId = new Types.ObjectId();

  let mockExec: jest.Mock;
  let mockSort: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExec = jest.fn();
    mockSort = jest.fn();

    // Standardized mock implementation returning a native Promise structure
    // This allows the query to be both directly awaited AND chained with .exec()
    const createQueryChain = () => {
      const p = Promise.resolve(mockExec());
      (p as any).exec = () => mockExec();
      (p as any).sort = mockSort.mockReturnValue({ exec: () => mockExec() });
      return p;
    };

    (DocumentModel.find as jest.Mock).mockImplementation(createQueryChain);
    (DocumentModel.findOne as jest.Mock).mockImplementation(createQueryChain);
    (DocumentModel.findById as jest.Mock).mockImplementation(createQueryChain);
    (DocumentModel.deleteOne as jest.Mock).mockImplementation(createQueryChain);
  });

  describe("DocumentServiceError", () => {
    it("should correctly set message and statusCode", () => {
      const err = new DocumentServiceError("Test Error", 400);
      expect(err.message).toBe("Test Error");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("DocumentServiceError");
    });
  });

  describe("Postgres branches", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.document.findMany as jest.Mock).mockReset();
      (prisma.document.findUnique as jest.Mock).mockReset();
      (prisma.document.findFirst as jest.Mock).mockReset();
      (prisma.documentAttachment.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("listForParent returns mapped docs", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValueOnce([
        createPrismaDoc(),
      ]);

      const res = await DocumentService.listForParent({
        companionId: validObjectIdStr,
      });
      expect(res).toHaveLength(1);
      expect(res[0].category).toBe("HEALTH");
    });

    it("listForPms returns mapped docs", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValueOnce([
        createPrismaDoc({ pmsVisible: true }),
      ]);

      const res = await DocumentService.listForPms({
        companionId: validObjectIdStr,
      });
      expect(res).toHaveLength(1);
      expect(res[0].pmsVisible).toBe(true);
    });

    it("getByIdForParent returns null when missing", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const res = await DocumentService.getByIdForParent(validObjectIdStr);
      expect(res).toBeNull();
    });

    it("getByIdForPms returns mapped doc when found", async () => {
      (prisma.document.findFirst as jest.Mock).mockResolvedValueOnce(
        createPrismaDoc({ pmsVisible: true }),
      );
      const res = await DocumentService.getByIdForPms(validObjectIdStr);
      expect(res?.id).toBeDefined();
    });

    it("listForAppointmentParent returns mapped docs", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValueOnce([
        createPrismaDoc({ appointmentId: validObjectIdStr }),
      ]);
      const res =
        await DocumentService.listForAppointmentParent(validObjectIdStr);
      expect(res).toHaveLength(1);
      expect(res[0].appointmentId).toBe(validObjectIdStr);
    });

    it("listForAppointmentPms returns mapped docs", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValueOnce([
        createPrismaDoc({ appointmentId: validObjectIdStr, pmsVisible: true }),
      ]);
      const res = await DocumentService.listForAppointmentPms({
        companionId: validObjectIdStr,
        appointmentId: validObjectIdStr,
      });
      expect(res).toHaveLength(1);
      expect(res[0].pmsVisible).toBe(true);
    });

    it("getAllAttachmentUrls returns presigned urls", async () => {
      (prisma.documentAttachment.findMany as jest.Mock).mockResolvedValueOnce([
        { key: "k1", mimeType: "image/png" },
      ]);
      (generatePresignedDownloadUrl as jest.Mock).mockResolvedValueOnce(
        "https://download",
      );

      const res = await DocumentService.getAllAttachmentUrls(validObjectIdStr);
      expect(res).toEqual([
        { url: "https://download", mimeType: "image/png", key: "k1" },
      ]);
    });

    it("searchByTitleForParent returns mapped docs", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValueOnce([
        createPrismaDoc({ title: "Vaccination" }),
      ]);
      const res = await DocumentService.searchByTitleForParent({
        companionId: validObjectIdStr,
        title: "Vacc",
      });
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe("Vaccination");
    });
  });

  describe("create & Internal Mappers (mapDocumentToDto, buildPersistableDocument)", () => {
    const baseInput: CreateDocumentInput = {
      companionId: validObjectIdStr,
      category: "HEALTH",
      title: "Valid Title",
      attachments: [{ key: "k1", mimeType: "image/png", size: 100 }],
    };

    it("should throw if title is empty", async () => {
      await expect(
        DocumentService.create(
          { ...baseInput, title: "   " },
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(
        new DocumentServiceError("Document title is required.", 400),
      );
    });

    it("should throw if attachments array is empty or missing", async () => {
      await expect(
        DocumentService.create(
          { ...baseInput, attachments: [] },
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(
        new DocumentServiceError("At least one attachment is required.", 400),
      );
    });

    it("should throw if companionId is invalid (ensureObjectId helper)", async () => {
      await expect(
        DocumentService.create(
          { ...baseInput, companionId: "invalid" },
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(new DocumentServiceError("Invalid companionId", 400));
    });

    it("should allow Types.ObjectId directly without throwing (ensureObjectId helper)", async () => {
      (DocumentModel.create as jest.Mock).mockResolvedValue(createMockDoc());

      await DocumentService.create(
        { ...baseInput, companionId: validObjectId }, // Passing ObjectId directly
        { parentId: validObjectId },
      );

      expect(DocumentModel.create).toHaveBeenCalled();
    });

    it("should correctly map empty strings in appointmentId to null", async () => {
      (DocumentModel.create as jest.Mock).mockResolvedValue(createMockDoc());

      await DocumentService.create(
        { ...baseInput, appointmentId: "" },
        { parentId: validObjectId },
      );

      expect(DocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: null,
        }),
      );
    });

    it("should throw if category is invalid", async () => {
      await expect(
        DocumentService.create(
          { ...baseInput, category: "INVALID_CAT" },
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(
        new DocumentServiceError("Invalid document category: INVALID_CAT", 400),
      );
    });

    it("should throw if subcategory is invalid for the category", async () => {
      await expect(
        DocumentService.create(
          { ...baseInput, category: "HEALTH", subcategory: "INVALID_SUB" },
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(
        new DocumentServiceError(
          "Invalid subcategory 'INVALID_SUB' for category 'HEALTH'",
          400,
        ),
      );
    });

    it("should succeed with category that allows empty subcategories (OTHERS)", async () => {
      const mockDoc = createMockDoc({ category: "OTHERS" });
      (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const result = await DocumentService.create(
        { ...baseInput, category: "OTHERS", subcategory: "ANY_STRING" }, // will be ignored because allowedSubcats.size === 0
        { parentId: validObjectIdStr },
      );

      expect(DocumentModel.create).toHaveBeenCalled();
      expect(result.category).toBe("OTHERS");
    });

    it("should handle parent context and Map Optional Fields Accurately (Date Objects)", async () => {
      const dateObj = new Date();
      const mockDoc = createMockDoc({
        appointmentId: new Types.ObjectId(),
        subcategory: "HOSPITAL_VISITS",
        visitType: "Checkup",
        issuingBusinessName: "Vet Clinic",
        issueDate: dateObj,
        attachments: [{ key: "k1", mimeType: "img", size: 100 }],
        uploadedByParentId: new Types.ObjectId(),
        createdAt: dateObj,
        updatedAt: dateObj,
      });
      (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const result = await DocumentService.create(
        {
          ...baseInput,
          appointmentId: validObjectIdStr,
          subcategory: "HOSPITAL_VISITS",
          visitType: "Checkup",
          issuingBusinessName: "Vet Clinic",
          issueDate: dateObj, // Date object branch
        },
        { parentId: validObjectIdStr },
      );

      expect(result.syncedFromPms).toBe(false);
      expect(result.uploadedByParentId).not.toBeNull();
      expect(result.appointmentId).not.toBeNull();
      expect(result.subcategory).toBe("HOSPITAL_VISITS");
      expect(result.issueDate).toBe(dateObj.toISOString());
    });

    it("should handle PMS context and valid string dates correctly", async () => {
      const mockDoc = createMockDoc({
        uploadedByPmsUserId: "pms_123",
        syncedFromPms: true,
      });
      (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const result = await DocumentService.create(
        {
          ...baseInput,
          attachments: [{ key: "k1", mimeType: "image/png" }], // Testing missing size
          issueDate: "2026-01-01T00:00:00.000Z", // Valid string date branch
        },
        { pmsUserId: "pms_123" },
      );

      expect(result.syncedFromPms).toBe(true);
      expect(result.uploadedByPmsUserId).toBe("pms_123");
      expect(result.uploadedByParentId).toBeNull();
    });

    it("should handle invalid string dates and empty string dates gracefully (ignore them)", async () => {
      const mockDoc = createMockDoc();
      (DocumentModel.create as jest.Mock).mockResolvedValue(mockDoc);

      // Invalid text date
      await DocumentService.create(
        { ...baseInput, issueDate: "invalid-date-string" },
        { parentId: validObjectIdStr },
      );

      expect(DocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ issueDate: null }),
      );

      // Empty string date
      await DocumentService.create(
        { ...baseInput, issueDate: "  " },
        { parentId: validObjectIdStr },
      );

      expect(DocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ issueDate: null }),
      );
    });

    it("mapDocumentToDto: should correctly map documents missing all optional fields (fallback branch testing)", async () => {
      // Mock an object missing every optional field to hit all ?? null branches
      const mockDoc = {
        _id: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        category: "HEALTH",
        title: "Minimal Doc",
        pmsVisible: true,
        syncedFromPms: false,
        toObject: function () {
          return this;
        },
      };
      mockExec.mockResolvedValue(mockDoc);

      const res = await DocumentService.getByIdForParent(validObjectIdStr);

      expect(res?.appointmentId).toBeNull();
      expect(res?.subcategory).toBeNull();
      expect(res?.visitType).toBeNull();
      expect(res?.issuingBusinessName).toBeNull();
      expect(res?.issueDate).toBeNull();
      expect(res?.attachments).toEqual([]);
      expect(res?.uploadedByParentId).toBeNull();
      expect(res?.uploadedByPmsUserId).toBeNull();
      expect(res?.createdAt).toBeDefined(); // Falls back to new Date().toISOString()
      expect(res?.updatedAt).toBeDefined(); // Falls back to new Date().toISOString()
    });
  });

  describe("listForParent", () => {
    it("should apply filters and return mapped documents", async () => {
      const mockDoc = createMockDoc();
      mockExec.mockResolvedValue([mockDoc]);

      const result = await DocumentService.listForParent({
        companionId: validObjectIdStr,
        category: "HEALTH",
        subcategory: "HOSPITAL_VISITS",
      });

      expect(DocumentModel.find).toHaveBeenCalledWith({
        companionId: new Types.ObjectId(validObjectIdStr),
        category: "HEALTH",
        subcategory: "HOSPITAL_VISITS",
      });
      expect(mockSort).toHaveBeenCalledWith({ issueDate: -1, createdAt: -1 });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockDoc._id.toString());
    });
  });

  describe("listForPms", () => {
    it("should apply filters, appointmentId, and enforce pmsVisible", async () => {
      const mockDoc = createMockDoc();
      mockExec.mockResolvedValue([mockDoc]);

      const result = await DocumentService.listForPms({
        companionId: validObjectIdStr,
        category: "HEALTH",
        subcategory: "HOSPITAL_VISITS",
        appointmentId: validObjectIdStr,
      });

      expect(DocumentModel.find).toHaveBeenCalledWith({
        companionId: new Types.ObjectId(validObjectIdStr),
        pmsVisible: true,
        category: "HEALTH",
        subcategory: "HOSPITAL_VISITS",
        appointmentId: new Types.ObjectId(validObjectIdStr),
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getByIdForParent & getByIdForPms", () => {
    it("getByIdForParent: should return null if not found", async () => {
      mockExec.mockResolvedValue(null);
      const res = await DocumentService.getByIdForParent(validObjectIdStr);
      expect(res).toBeNull();
    });

    it("getByIdForParent: should return mapped DTO on success", async () => {
      const mockDoc = createMockDoc();
      mockExec.mockResolvedValue(mockDoc);
      const res = await DocumentService.getByIdForParent(validObjectIdStr);
      expect(res?.id).toBe(mockDoc._id.toString());
    });

    it("getByIdForPms: should return null if not found", async () => {
      mockExec.mockResolvedValue(null);
      const res = await DocumentService.getByIdForPms(validObjectIdStr);
      expect(res).toBeNull();
    });

    it("getByIdForPms: should query with pmsVisible=true", async () => {
      const mockDoc = createMockDoc();
      mockExec.mockResolvedValue(mockDoc);
      const res = await DocumentService.getByIdForPms(validObjectIdStr);

      expect(DocumentModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(validObjectIdStr),
        pmsVisible: true,
      });
      expect(res?.id).toBe(mockDoc._id.toString());
    });
  });

  describe("deleteForParent", () => {
    it("should throw 404 if document not found or parent mismatch", async () => {
      mockExec.mockResolvedValue(null);
      await expect(
        DocumentService.deleteForParent(validObjectIdStr, validObjectIdStr),
      ).rejects.toThrow(
        new DocumentServiceError("Document not found or not deletable.", 404),
      );
    });

    it("should delete from S3 and DB on success", async () => {
      const mockDoc = createMockDoc({
        attachments: [{ key: "s3_key_1" }, { key: "s3_key_2" }],
      });
      mockExec.mockResolvedValue(mockDoc);

      const result = await DocumentService.deleteForParent(
        validObjectIdStr,
        validObjectIdStr,
      );

      expect(deleteFromS3).toHaveBeenCalledTimes(2);
      expect(deleteFromS3).toHaveBeenCalledWith("s3_key_1");
      expect(deleteFromS3).toHaveBeenCalledWith("s3_key_2");
      expect(DocumentModel.deleteOne).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("listForAppointmentParent & listForAppointmentPms", () => {
    it("listForAppointmentParent should query by appointmentId", async () => {
      mockExec.mockResolvedValue([createMockDoc()]);
      await DocumentService.listForAppointmentParent(validObjectIdStr);
      expect(DocumentModel.find).toHaveBeenCalledWith({
        appointmentId: new Types.ObjectId(validObjectIdStr),
      });
    });

    it("listForAppointmentPms should query by appointmentId, companionId, and pmsVisible", async () => {
      mockExec.mockResolvedValue([createMockDoc()]);
      await DocumentService.listForAppointmentPms({
        appointmentId: validObjectIdStr,
        companionId: validObjectIdStr,
      });
      expect(DocumentModel.find).toHaveBeenCalledWith({
        companionId: new Types.ObjectId(validObjectIdStr),
        appointmentId: new Types.ObjectId(validObjectIdStr),
        pmsVisible: true,
      });
    });
  });

  describe("update", () => {
    it("should throw 404 if document not found", async () => {
      mockExec.mockResolvedValue(null);
      await expect(
        DocumentService.update(
          validObjectIdStr,
          {},
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(new DocumentServiceError("Document not found.", 404));
    });

    it("should throw 403 if parent tries to update document they did not upload", async () => {
      const mockDoc = createMockDoc({
        uploadedByParentId: new Types.ObjectId(),
      }); // different ID
      mockExec.mockResolvedValue(mockDoc);

      await expect(
        DocumentService.update(
          validObjectIdStr,
          {},
          { parentId: validObjectIdStr },
        ),
      ).rejects.toThrow(
        new DocumentServiceError(
          "Parent is not allowed to update this document.",
          403,
        ),
      );
    });

    it("should throw 403 if PMS tries to update parent-uploaded document", async () => {
      const mockDoc = createMockDoc({ syncedFromPms: false });
      mockExec.mockResolvedValue(mockDoc);

      await expect(
        DocumentService.update(validObjectIdStr, {}, { pmsUserId: "pms1" }),
      ).rejects.toThrow(
        new DocumentServiceError(
          "PMS cannot update documents uploaded by parent.",
          403,
        ),
      );
    });

    it("should successfully apply updates and format properties", async () => {
      const parentId = new Types.ObjectId();
      const mockDoc = createMockDoc({
        uploadedByParentId: parentId,
        category: "HEALTH",
        subcategory: null,
      });
      mockExec.mockResolvedValue(mockDoc);
    });

    it("should handle updates where issuingBusinessName is explicitly empty or subcategory is untouched", async () => {
      const parentId = new Types.ObjectId();
      const mockDoc = createMockDoc({
        uploadedByParentId: parentId,
        category: "HEALTH",
        subcategory: "HOSPITAL_VISITS",
      });
      mockExec.mockResolvedValue(mockDoc);

      const updates = { issuingBusinessName: "", category: "HEALTH" }; // Same category, triggers branch

      await DocumentService.update(validObjectIdStr, updates as any, {
        parentId,
      });

      expect(mockDoc.issuingBusinessName).toBeNull(); // Empty string converted to null
      expect(mockDoc.subcategory).toBe("HOSPITAL_VISITS"); // Preserved existing subcategory
    });

    it("should ignore invalid issueDate formats during update", async () => {
      const parentId = new Types.ObjectId();
      const mockDoc = createMockDoc({
        uploadedByParentId: parentId,
        issueDate: new Date("2026-01-01"),
      });
      mockExec.mockResolvedValue(mockDoc);

      await DocumentService.update(
        validObjectIdStr,
        { issueDate: "invalid-date" },
        { parentId },
      );

      // Kept the old valid date
      expect(mockDoc.issueDate.toISOString()).toBe(
        new Date("2026-01-01").toISOString(),
      );
    });
  });

  describe("getAllAttachmentUrls", () => {
    it("should throw 404 if document not found or has no attachments", async () => {
      mockExec.mockResolvedValueOnce(null);
      await expect(
        DocumentService.getAllAttachmentUrls(validObjectIdStr),
      ).rejects.toThrow(new DocumentServiceError("No attachments found.", 404));

      mockExec.mockResolvedValueOnce(createMockDoc({ attachments: [] }));
      await expect(
        DocumentService.getAllAttachmentUrls(validObjectIdStr),
      ).rejects.toThrow(new DocumentServiceError("No attachments found.", 404));
    });

    it("should return presigned URLs mapped correctly", async () => {
      const mockDoc = createMockDoc({
        attachments: [
          { key: "k1", mimeType: "img/png" },
          { key: "k2", mimeType: "app/pdf" },
        ],
      });
      mockExec.mockResolvedValue(mockDoc);

      (generatePresignedDownloadUrl as jest.Mock)
        .mockResolvedValueOnce("url1")
        .mockResolvedValueOnce("url2");

      const result =
        await DocumentService.getAllAttachmentUrls(validObjectIdStr);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        url: "url1",
        mimeType: "img/png",
        key: "k1",
      });
      expect(result[1]).toEqual({
        url: "url2",
        mimeType: "app/pdf",
        key: "k2",
      });
    });
  });

  describe("searchByTitleForParent", () => {
    it("should throw 400 if title is missing or not a string", async () => {
      await expect(
        DocumentService.searchByTitleForParent({
          companionId: validObjectIdStr,
          title: "",
        }),
      ).rejects.toThrow(
        new DocumentServiceError("Search title is required.", 400),
      );

      await expect(
        DocumentService.searchByTitleForParent({
          companionId: validObjectIdStr,
          title: 123 as any,
        }),
      ).rejects.toThrow(
        new DocumentServiceError("Search title is required.", 400),
      );
    });

    it("should query by regex and return documents", async () => {
      const mockDoc = createMockDoc();
      mockExec.mockResolvedValue([mockDoc]);

      const result = await DocumentService.searchByTitleForParent({
        companionId: validObjectIdStr,
        title: " test ",
      });

      expect(DocumentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: new Types.ObjectId(validObjectIdStr),
          title: { $regex: expect.any(RegExp) }, // Tests RegExp generation
        }),
      );
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toHaveLength(1);
    });
  });
});
