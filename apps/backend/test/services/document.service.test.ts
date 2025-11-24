import { Types } from "mongoose";
import DocumentModel from "../../src/models/document";
import {
  DocumentService,
  DocumentServiceError,
} from "../../src/services/document.service";
import { generatePresignedDownloadUrl } from "src/middlewares/upload";

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

jest.mock("src/middlewares/upload", () => ({
  generatePresignedDownloadUrl: jest.fn(),
}));

const mockedDocumentModel = DocumentModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  findById: jest.Mock;
  deleteOne: jest.Mock;
};

const mockedUpload = {
  generatePresignedDownloadUrl: generatePresignedDownloadUrl as jest.Mock,
};

const makeDoc = (overrides: Record<string, any> = {}) => {
  const doc: any = {
    _id: overrides._id ?? new Types.ObjectId(),
    companionId: overrides.companionId ?? new Types.ObjectId(),
    appointmentId: overrides.appointmentId ?? null,
    category: overrides.category ?? "ADMIN",
    subcategory: overrides.subcategory ?? null,
    visitType: overrides.visitType ?? null,
    title: overrides.title ?? "My Document",
    issuingBusinessName: overrides.issuingBusinessName ?? null,
    issueDate: overrides.issueDate ?? null,
    attachments:
      overrides.attachments ??
      [
        {
          key: "file.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
      ],
    uploadedByParentId: overrides.uploadedByParentId ?? null,
    uploadedByPmsUserId: overrides.uploadedByPmsUserId,
    pmsVisible: overrides.pmsVisible ?? false,
    syncedFromPms: overrides.syncedFromPms ?? false,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2024-01-02"),
    toObject() {
      const { toObject, save, ...rest } = this as any;
      return { ...rest };
    },
    save: jest.fn().mockResolvedValue(undefined),
  };

  return doc;
};

describe("DocumentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates a document for parent uploads and maps dto", async () => {
      const parentId = new Types.ObjectId();
      const companionId = new Types.ObjectId();

      mockedDocumentModel.create.mockImplementationOnce(async (payload) =>
        makeDoc({
          ...payload,
          companionId,
          uploadedByParentId: payload.uploadedByParentId,
        }),
      );

      const result = await DocumentService.create(
        {
          companionId: companionId.toHexString(),
          category: "ADMIN",
          subcategory: "PASSPORT",
          title: "Vet Papers",
          attachments: [{ key: "file.pdf", mimeType: "application/pdf" }],
        },
        { parentId: parentId.toHexString() },
      );

      expect(mockedDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: expect.any(Types.ObjectId),
          uploadedByParentId: expect.any(Types.ObjectId),
          syncedFromPms: false,
          pmsVisible: false,
        }),
      );
      expect(result.uploadedByParentId).toBe(parentId.toHexString());
      expect(result.pmsVisible).toBe(false);
      expect(result.attachments).toEqual([
        expect.objectContaining({ key: "file.pdf", mimeType: "application/pdf" }),
      ]);
    });

    it("rejects invalid categories", async () => {
      await expect(
        DocumentService.create(
          {
            companionId: new Types.ObjectId().toHexString(),
            category: "UNKNOWN",
            title: "Bad",
            attachments: [{ key: "f", mimeType: "application/pdf" }],
          },
          { parentId: new Types.ObjectId().toHexString() },
        ),
      ).rejects.toThrow(DocumentServiceError);
    });

    it("marks PMS uploads as synced and visible when category allows", async () => {
      mockedDocumentModel.create.mockImplementationOnce(async (payload) =>
        makeDoc(payload),
      );

      const result = await DocumentService.create(
        {
          companionId: new Types.ObjectId().toHexString(),
          category: "HEALTH",
          subcategory: "LAB_TESTS",
          title: "Lab Report",
          attachments: [{ key: "lab.pdf", mimeType: "application/pdf" }],
        },
        { pmsUserId: "pms-user-1" },
      );

      expect(mockedDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedByPmsUserId: "pms-user-1",
          syncedFromPms: true,
          pmsVisible: true,
        }),
      );
      expect(result.syncedFromPms).toBe(true);
      expect(result.pmsVisible).toBe(true);
    });
  });

  describe("update", () => {
    it("blocks parent updates when not owner", async () => {
      const docOwner = new Types.ObjectId();
      const doc = makeDoc({ uploadedByParentId: docOwner });
      mockedDocumentModel.findById.mockResolvedValueOnce(doc);

      await expect(
        DocumentService.update(
          doc._id.toHexString(),
          { title: "New" },
          { parentId: new Types.ObjectId().toHexString() },
        ),
      ).rejects.toThrow("Parent is not allowed to update this document.");

      expect(doc.save).not.toHaveBeenCalled();
    });

    it("updates category, visibility, and attachments for parent owner", async () => {
      const parentId = new Types.ObjectId();
      const doc = makeDoc({
        category: "ADMIN",
        pmsVisible: false,
        uploadedByParentId: parentId,
      });
      mockedDocumentModel.findById.mockResolvedValueOnce(doc);

      const result = await DocumentService.update(
        doc._id,
        {
          category: "health",
          attachments: [{ key: "new.png", mimeType: "image/png" }],
          title: "  Updated Title ",
        },
        { parentId: parentId.toHexString() },
      );

      expect(doc.category).toBe("HEALTH");
      expect(doc.pmsVisible).toBe(true);
      expect(doc.attachments).toEqual([
        expect.objectContaining({ key: "new.png", mimeType: "image/png" }),
      ]);
      expect(doc.title).toBe("Updated Title");
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(result.category).toBe("HEALTH");
      expect(result.pmsVisible).toBe(true);
    });
  });

  describe("getAllAttachmentUrls", () => {
    it("builds download URLs for stored attachments", async () => {
      const doc = makeDoc();
      mockedDocumentModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });
      mockedUpload.generatePresignedDownloadUrl.mockResolvedValueOnce(
        "https://cdn/key",
      );

      const result = await DocumentService.getAllAttachmentUrls(
        doc._id.toHexString(),
      );

      expect(mockedUpload.generatePresignedDownloadUrl).toHaveBeenCalledWith(
        "file.pdf",
      );
      expect(result).toEqual([
        {
          url: "https://cdn/key",
          mimeType: "application/pdf",
          key: "file.pdf",
        },
      ]);
    });
  });
});
