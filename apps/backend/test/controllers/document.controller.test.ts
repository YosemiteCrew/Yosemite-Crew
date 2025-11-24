import { DocumentController } from "../../src/controllers/app/document.controller";
import {
  DocumentService,
  DocumentServiceError,
} from "../../src/services/document.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import {
  generatePresignedUrl,
  generatePresignedDownloadUrl,
} from "src/middlewares/upload";

jest.mock("../../src/services/document.service", () => {
  const actual = jest.requireActual("../../src/services/document.service");
  return {
    ...actual,
    DocumentService: {
      create: jest.fn(),
      listForParent: jest.fn(),
      listForPms: jest.fn(),
      listForAppointmentParent: jest.fn(),
      update: jest.fn(),
      getAllAttachmentUrls: jest.fn(),
      getByIdForParent: jest.fn(),
      getByIdForPms: jest.fn(),
      deleteForParent: jest.fn(),
    },
  };
});

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("src/middlewares/upload", () => ({
  generatePresignedUrl: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
}));

const mockedDocumentService = DocumentService as unknown as {
  create: jest.Mock;
  listForParent: jest.Mock;
  listForPms: jest.Mock;
  listForAppointmentParent: jest.Mock;
  update: jest.Mock;
  getAllAttachmentUrls: jest.Mock;
  getByIdForParent: jest.Mock;
  getByIdForPms: jest.Mock;
  deleteForParent: jest.Mock;
};

const mockedAuthUserService = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockedUpload = {
  generatePresignedUrl: generatePresignedUrl as jest.Mock,
  generatePresignedDownloadUrl: generatePresignedDownloadUrl as jest.Mock,
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
};

const sampleBody = {
  title: "Doc",
  category: "ADMIN",
  subcategory: "PASSPORT",
  attachments: [{ key: "file.pdf", mimeType: "application/pdf" }],
};

describe("DocumentController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUploadUrl", () => {
    it("returns 400 when required fields are missing", async () => {
      const res = createResponse();
      await DocumentController.getUploadUrl({ body: {} } as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "companionId and mimeType are required.",
      });
    });

    it("returns generated upload url", async () => {
      const res = createResponse();
      mockedUpload.generatePresignedUrl.mockResolvedValueOnce({
        url: "https://upload",
        key: "k",
      });

      await DocumentController.getUploadUrl(
        {
          body: { companionId: "cmp-1", mimeType: "image/png" },
        } as any,
        res as any,
      );

      expect(mockedUpload.generatePresignedUrl).toHaveBeenCalledWith(
        "image/png",
        "companion",
        "cmp-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "https://upload", key: "k" });
    });
  });

  describe("createDocument", () => {
    it("requires authentication", async () => {
      const res = createResponse();
      await DocumentController.createDocument(
        { params: { companionId: "cmp-1" }, body: sampleBody } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not authenticated.",
      });
      expect(mockedDocumentService.create).not.toHaveBeenCalled();
    });

    it("requires parent profile for authenticated user", async () => {
      const res = createResponse();
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce(null);

      await DocumentController.createDocument(
        {
          params: { companionId: "cmp-1" },
          body: sampleBody,
          userId: "user-1",
        } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Parent profile not found.",
      });
    });

    it("creates document when parent is found", async () => {
      const res = createResponse();
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      });
      mockedDocumentService.create.mockResolvedValueOnce({ id: "doc-1" });

      await DocumentController.createDocument(
        {
          params: { companionId: "cmp-1" },
          body: sampleBody,
          userId: "user-1",
        } as any,
        res as any,
      );

      expect(mockedDocumentService.create).toHaveBeenCalledWith(
        expect.objectContaining({ companionId: "cmp-1" }),
        { parentId: "parent-1" },
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "doc-1" });
    });

    it("maps DocumentServiceError", async () => {
      const res = createResponse();
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      });
      mockedDocumentService.create.mockRejectedValueOnce(
        new DocumentServiceError("bad", 422),
      );

      await DocumentController.createDocument(
        {
          params: { companionId: "cmp-1" },
          body: sampleBody,
          userId: "user-1",
        } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "bad" });
    });
  });

  describe("createDocumentPms", () => {
    it("requires authentication", async () => {
      const res = createResponse();
      await DocumentController.createDocumentPms(
        { params: { companionId: "cmp-1" }, body: sampleBody } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "PMS user not authenticated.",
      });
    });

    it("creates document for PMS user", async () => {
      const res = createResponse();
      mockedDocumentService.create.mockResolvedValueOnce({ id: "doc-2" });

      await DocumentController.createDocumentPms(
        {
          params: { companionId: "cmp-1" },
          body: { ...sampleBody, appointmentId: "appt-1" },
          userId: "pms-user",
        } as any,
        res as any,
      );

      expect(mockedDocumentService.create).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: "appt-1" }),
        { pmsUserId: "pms-user" },
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "doc-2" });
    });
  });

  describe("listForPms", () => {
    it("requires companionId", async () => {
      const res = createResponse();
      await DocumentController.listForPms(
        { params: {}, query: {}, userId: "pms-user" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Companion ID is required.",
      });
    });

    it("passes query params safely", async () => {
      const res = createResponse();
      mockedDocumentService.listForPms.mockResolvedValueOnce([]);

      await DocumentController.listForPms(
        {
          params: { companionId: "cmp-1" },
          query: {
            category: ["HEALTH", "ADMIN"],
            subcategory: ["LAB_TESTS"],
            appointmentId: ["appt-1"],
          },
          userId: "pms-user",
        } as any,
        res as any,
      );

      expect(mockedDocumentService.listForPms).toHaveBeenCalledWith({
        companionId: "cmp-1",
        category: "HEALTH",
        subcategory: "LAB_TESTS",
        appointmentId: "appt-1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe("updateDocument", () => {
    it("requires authentication", async () => {
      const res = createResponse();
      await DocumentController.updateDocument(
        { params: { documentId: "doc-1" }, body: {} } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "User not authenticated." });
    });

    it("uses parent context when available", async () => {
      const res = createResponse();
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      });
      mockedDocumentService.update.mockResolvedValueOnce({ id: "doc-1" });

      await DocumentController.updateDocument(
        {
          params: { documentId: "doc-1" },
          body: { title: "Updated" },
          userId: "user-1",
        } as any,
        res as any,
      );

      expect(mockedDocumentService.update).toHaveBeenCalledWith(
        "doc-1",
        { title: "Updated" },
        { parentId: "parent-1" },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "doc-1" });
    });

    it("falls back to PMS context when parent not found", async () => {
      const res = createResponse();
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce(null);
      mockedDocumentService.update.mockResolvedValueOnce({ id: "doc-3" });

      await DocumentController.updateDocument(
        {
          params: { documentId: "doc-3" },
          body: { title: "Updated" },
          userId: "user-2",
        } as any,
        res as any,
      );

      expect(mockedDocumentService.update).toHaveBeenCalledWith(
        "doc-3",
        { title: "Updated" },
        { pmsUserId: "user-2" },
      );
    });
  });

  describe("getSignedDownloadUrl", () => {
    it("requires key in body", async () => {
      const res = createResponse();
      await DocumentController.getSignedDownloadUrl(
        { body: {} } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Key is required." });
    });

    it("returns signed url", async () => {
      const res = createResponse();
      mockedUpload.generatePresignedDownloadUrl.mockResolvedValueOnce(
        "https://download",
      );

      await DocumentController.getSignedDownloadUrl(
        { body: { key: "file.pdf" } } as any,
        res as any,
      );

      expect(mockedUpload.generatePresignedDownloadUrl).toHaveBeenCalledWith(
        "file.pdf",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("https://download");
    });
  });

  describe("getDocumentDownloadUrl", () => {
    it("maps service errors", async () => {
      const res = createResponse();
      mockedDocumentService.getAllAttachmentUrls.mockRejectedValueOnce(
        new DocumentServiceError("missing", 404),
      );

      await DocumentController.getDocumentDownloadUrl(
        { params: { documentId: "doc-1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "missing" });
    });
  });
});
