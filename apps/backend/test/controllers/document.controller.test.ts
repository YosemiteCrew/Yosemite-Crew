import { DocumentController } from "../../src/controllers/app/document.controller";
import {
  DocumentService,
  DocumentServiceError,
} from "../../src/services/document.service";
import {
  generatePresignedDownloadUrl,
  generatePresignedUrl,
} from "src/middlewares/upload";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "../../src/utils/logger";

// --- Global Mocks Setup ---
jest.mock("../../src/services/document.service", () => {
  class MockDocumentServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "DocumentServiceError";
    }
  }
  return {
    __esModule: true,
    DocumentServiceError: MockDocumentServiceError,
    DocumentService: {
      create: jest.fn(),
      listForParent: jest.fn(),
      listForAppointmentParent: jest.fn(),
      update: jest.fn(),
      listForPms: jest.fn(),
      getByIdForParent: jest.fn(),
      getByIdForPms: jest.fn(),
      deleteForParent: jest.fn(),
      getAllAttachmentUrls: jest.fn(),
      searchByTitleForParent: jest.fn(),
    },
  };
});

jest.mock("src/middlewares/upload", () => ({
  generatePresignedUrl: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
}));

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("DocumentController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      userId: "auth_user_123",
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("Internal Helpers Testing via listForPms", () => {
    it("resolveUserIdFromRequest: should use x-user-id header if present", async () => {
      req.headers["x-user-id"] = "header_id";
      req.params.companionId = "c1";
      await DocumentController.listForPms(req, res);
      expect(DocumentService.listForPms).toHaveBeenCalled(); // Means auth check passed with header_id
    });

    it("resolveUserIdFromRequest: should handle missing headers gracefully", async () => {
      req.headers = undefined;
      req.userId = "auth_id";
      req.params.companionId = "c1";
      await DocumentController.listForPms(req, res);
      expect(DocumentService.listForPms).toHaveBeenCalled(); // Means auth check passed with auth_id
    });

    it("getFirstQueryValue: should extract string from array", async () => {
      req.params.companionId = "c1";
      req.query.category = [123, "valid_string"]; // Tests skipping non-strings in array
      await DocumentController.listForPms(req, res);
    });

    it("getFirstQueryValue: should return undefined for invalid types or arrays with no strings", async () => {
      req.params.companionId = "c1";
      req.query.category = [123, 456]; // Array with no strings
      req.query.subcategory = 12345; // Not a string or array
      await DocumentController.listForPms(req, res);
      expect(DocumentService.listForPms).toHaveBeenCalledWith(
        expect.objectContaining({
          category: undefined,
          subcategory: undefined,
        }),
      );
    });
  });

  describe("getUploadUrl", () => {
    it("should return 400 if companionId or mimeType are missing", async () => {
      req.body = { companionId: "c1" };
      await DocumentController.getUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.body = { mimeType: "image/png" };
      await DocumentController.getUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 200 with url and key on success", async () => {
      req.body = { companionId: "c1", mimeType: "image/png" };
      (generatePresignedUrl as jest.Mock).mockResolvedValue({
        url: "http://url",
        key: "key1",
      });

      await DocumentController.getUploadUrl(req, res);

      expect(generatePresignedUrl).toHaveBeenCalledWith(
        "image/png",
        "companion",
        "c1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "http://url", key: "key1" });
    });

    it("should handle generic errors", async () => {
      req.body = { companionId: "c1", mimeType: "image/png" };
      (generatePresignedUrl as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.getUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("createDocument", () => {
    it("should return 400 if companionId is missing", async () => {
      await DocumentController.createDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 401 if not authenticated", async () => {
      req.params.companionId = "c1";
      req.userId = null;
      await DocumentController.createDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 if parent profile not found", async () => {
      req.params.companionId = "c1";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: null });
      await DocumentController.createDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Parent profile not found.",
      });
    });

    it("should return 201 on successful creation (with defaults)", async () => {
      req.params.companionId = "c1";
      req.body = { title: "T", category: "C" }; // Test defaults like attachments ?? []
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "p1" });
      (DocumentService.create as jest.Mock).mockResolvedValue("created_doc");

      await DocumentController.createDocument(req, res);

      expect(DocumentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: "c1",
          title: "T",
          category: "C",
          attachments: [],
        }),
        { parentId: "p1" },
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith("created_doc");
    });

    it("should handle custom DocumentServiceError", async () => {
      req.params.companionId = "c1";
      req.body = { title: "T", category: "C" };
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "p1" });
      (DocumentService.create as jest.Mock).mockRejectedValue(
        new DocumentServiceError("Custom", 403),
      );

      await DocumentController.createDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Custom" });
    });

    it("should handle generic errors", async () => {
      req.params.companionId = "c1";
      req.body = { title: "T", category: "C" };
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "p1" });
      (DocumentService.create as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );

      await DocumentController.createDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createDocumentPms", () => {
    it("should return 401 if unauthenticated", async () => {
      req.userId = null;
      req.params.companionId = "c1";
      await DocumentController.createDocumentPms(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if companionId missing", async () => {
      await DocumentController.createDocumentPms(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 201 on success (with defaults)", async () => {
      req.params.companionId = "c1";
      req.body = { title: "T", category: "C" };
      (DocumentService.create as jest.Mock).mockResolvedValue(
        "created_pms_doc",
      );

      await DocumentController.createDocumentPms(req, res);
    });

    it("should handle custom DocumentServiceError and generic errors", async () => {
      req.params.companionId = "c1";

      (DocumentService.create as jest.Mock).mockRejectedValue(
        new DocumentServiceError("Custom", 400),
      );
      await DocumentController.createDocumentPms(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (DocumentService.create as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.createDocumentPms(req, res);
    });
  });

  describe("listDocumentsForParent", () => {
    it("should return 400 if companionId is missing", async () => {
      await DocumentController.listDocumentsForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 200 on success", async () => {
      req.params.companionId = "c1";
      req.query = { category: "cat", subcategory: "sub" };
      (DocumentService.listForParent as jest.Mock).mockResolvedValue("docs");

      await DocumentController.listDocumentsForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("docs");
    });

    it("should handle errors", async () => {
      req.params.companionId = "c1";
      (DocumentService.listForParent as jest.Mock).mockRejectedValue(
        new DocumentServiceError("Custom", 404),
      );
      await DocumentController.listDocumentsForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (DocumentService.listForParent as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.listDocumentsForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listForAppointment", () => {
    it("should return 200 on success", async () => {
      req.params.appointmentId = "a1";
      (DocumentService.listForAppointmentParent as jest.Mock).mockResolvedValue(
        "app_docs",
      );
      await DocumentController.listForAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      req.params.appointmentId = "a1";
      (DocumentService.listForAppointmentParent as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 400),
      );
      await DocumentController.listForAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (DocumentService.listForAppointmentParent as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.listForAppointment(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateDocument", () => {
    it("should return 401 if unauthenticated", async () => {
      req.userId = null;
      await DocumentController.updateDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if documentId is missing", async () => {
      await DocumentController.updateDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should update successfully with parentId context", async () => {
      req.params.documentId = "d1";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "p1" });
      (DocumentService.update as jest.Mock).mockResolvedValue("updated");

      await DocumentController.updateDocument(req, res);
      expect(DocumentService.update).toHaveBeenCalledWith("d1", req.body, {
        parentId: "p1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should update successfully with pmsUserId context (fallback param ID)", async () => {
      req.params.id = "d2"; // Testing the documentId ?? id fallback
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: null });

      await DocumentController.updateDocument(req, res);
      expect(DocumentService.update).toHaveBeenCalledWith("d2", req.body, {
        pmsUserId: "auth_user_123",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      req.params.id = "d2";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: null });

      (DocumentService.update as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 404),
      );
      await DocumentController.updateDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (DocumentService.update as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.updateDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listForPms", () => {
    it("should return 401 if unauthenticated", async () => {
      req.userId = null;
      await DocumentController.listForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if companionId missing", async () => {
      await DocumentController.listForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 200 on success", async () => {
      req.params.companionId = "c1";
      (DocumentService.listForPms as jest.Mock).mockResolvedValue("pms_docs");
      await DocumentController.listForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      req.params.companionId = "c1";
      (DocumentService.listForPms as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 400),
      );
      await DocumentController.listForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (DocumentService.listForPms as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.listForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getForParent & getForPms", () => {
    it("getForParent: return 404 if not found", async () => {
      req.params.id = "d1";
      (DocumentService.getByIdForParent as jest.Mock).mockResolvedValue(null);
      await DocumentController.getForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("getForParent: return 200 on success", async () => {
      req.params.id = "d1";
      (DocumentService.getByIdForParent as jest.Mock).mockResolvedValue("doc");
      await DocumentController.getForParent(req, res);
      expect(res.json).toHaveBeenCalledWith("doc");
    });

    it("getForParent: handle errors", async () => {
      req.params.id = "d1";
      (DocumentService.getByIdForParent as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 403),
      );
      await DocumentController.getForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(403);

      (DocumentService.getByIdForParent as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.getForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("getForPms: return 404 if not found", async () => {
      req.params.documentId = "d1";
      (DocumentService.getByIdForPms as jest.Mock).mockResolvedValue(null);
      await DocumentController.getForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("getForPms: return 200 on success", async () => {
      req.params.documentId = "d1";
      (DocumentService.getByIdForPms as jest.Mock).mockResolvedValue("doc");
      await DocumentController.getForPms(req, res);
      expect(res.json).toHaveBeenCalledWith("doc");
    });

    it("getForPms: handle errors", async () => {
      req.params.documentId = "d1";
      (DocumentService.getByIdForPms as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 403),
      );
      await DocumentController.getForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(403);

      (DocumentService.getByIdForPms as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.getForPms(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteForParent", () => {
    it("should return 401 if unauthenticated", async () => {
      req.userId = null;
      await DocumentController.deleteForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 if authUser not found", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue(null);
      await DocumentController.deleteForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 204 on success", async () => {
      req.params.documentId = "d1";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "p1" });
      await DocumentController.deleteForParent(req, res);
      expect(DocumentService.deleteForParent).toHaveBeenCalledWith("d1", "p1");
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it("should handle errors", async () => {
      req.params.documentId = "d1";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "p1" });

      (DocumentService.deleteForParent as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 404),
      );
      await DocumentController.deleteForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (DocumentService.deleteForParent as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.deleteForParent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getSignedDownloadUrl", () => {
    it("should return 400 if key is missing", async () => {
      await DocumentController.getSignedDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 200 and url on success", async () => {
      req.body = { key: "k1" };
      (generatePresignedDownloadUrl as jest.Mock).mockResolvedValue(
        "signed_url",
      );
      await DocumentController.getSignedDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("signed_url");
    });

    it("should handle errors", async () => {
      req.body = { key: "k1" };
      (generatePresignedDownloadUrl as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.getSignedDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getDocumentDownloadUrl", () => {
    it("should return 400 if documentId is missing", async () => {
      await DocumentController.getDocumentDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 200 and urls on success", async () => {
      req.params.documentId = "d1";
      (DocumentService.getAllAttachmentUrls as jest.Mock).mockResolvedValue([
        "url1",
      ]);
      await DocumentController.getDocumentDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(["url1"]);
    });

    it("should handle errors", async () => {
      req.params.documentId = "d1";

      (DocumentService.getAllAttachmentUrls as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 403),
      );
      await DocumentController.getDocumentDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(403);

      (DocumentService.getAllAttachmentUrls as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.getDocumentDownloadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("searchDocument", () => {
    it("should return 400 if companionId missing", async () => {
      req.query.title = "T";
      await DocumentController.searchDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 if title missing or not string", async () => {
      req.params.companionId = "c1";
      req.query.title = ["array"];
      await DocumentController.searchDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 200 and results on success", async () => {
      req.params.companionId = "c1";
      req.query.title = "title";
      (DocumentService.searchByTitleForParent as jest.Mock).mockResolvedValue([
        "doc1",
      ]);
      await DocumentController.searchDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ documents: ["doc1"] });
    });

    it("should handle errors", async () => {
      req.params.companionId = "c1";
      req.query.title = "title";

      (DocumentService.searchByTitleForParent as jest.Mock).mockRejectedValue(
        new DocumentServiceError("C", 400),
      );
      await DocumentController.searchDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      (DocumentService.searchByTitleForParent as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await DocumentController.searchDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
