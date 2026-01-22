import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 3 levels to root
// ----------------------------------------------------------------------
import { DocumentController } from "../../../src/controllers/app/document.controller";
import { DocumentService } from "../../../src/services/document.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import * as UploadMiddleware from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock("../../../src/services/document.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/document.service",
  ) as unknown as any;
  return {
    ...actual,
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

jest.mock("../../../src/services/authUserMobile.service");
jest.mock("../../../src/middlewares/upload");
jest.mock("../../../src/utils/logger");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DocumentServiceError } = jest.requireActual(
  "../../../src/services/document.service",
) as unknown as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedDocumentService = jest.mocked(DocumentService);
const mockedAuthMobileService = jest.mocked(AuthUserMobileService);
const mockedUpload = jest.mocked(UploadMiddleware);
const mockedLogger = jest.mocked(logger);

describe("DocumentController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

    req = {
      headers: {},
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 4. ERROR HELPERS (Double Cast Fix)
  // ----------------------------------------------------------------------
  const mockServiceError = (
    method: keyof typeof DocumentService,
    status = 400,
    msg = "Error",
  ) => {
    const error = new DocumentServiceError(msg, status);
    mockedDocumentService[method].mockRejectedValue(error);
  };

  const mockGenericError = (method: keyof typeof DocumentService) => {
    mockedDocumentService[method].mockRejectedValue(new Error("Boom"));
  };

  // ----------------------------------------------------------------------
  // 5. TESTS
  // ----------------------------------------------------------------------

  describe("getUploadUrl", () => {
    it("should 400 if companionId or mimeType missing", async () => {
      req.body = { companionId: "c1" }; // missing mimeType
      await DocumentController.getUploadUrl(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.body = { companionId: "c1", mimeType: "image/png" };
      mockedUpload.generatePresignedUrl.mockResolvedValue({
        url: "http://s3",
        key: "key",
      });

      await DocumentController.getUploadUrl(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ url: "http://s3", key: "key" });
    });

    it("should handle generic error", async () => {
      req.body = { companionId: "c1", mimeType: "image/png" };
      mockedUpload.generatePresignedUrl.mockRejectedValue(new Error("Fail"));

      await DocumentController.getUploadUrl(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createDocument (Mobile)", () => {
    it("should 400 if companionId missing", async () => {
      req.params = {};
      (req as any).userId = "u1";
      await DocumentController.createDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 401 if parent profile not found", async () => {
      req.params = { companionId: "c1" };
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: null,
      } as any);

      await DocumentController.createDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (201)", async () => {
      req.params = { companionId: "c1" };
      (req as any).userId = "u1";
      req.body = { title: "Doc", category: "Health" };

      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedDocumentService.create.mockResolvedValue({ id: "d1" } as any);

      await DocumentController.createDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      req.params = { companionId: "c1" };
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      req.body = { title: "Doc", category: "Health" };

      mockServiceError("create", 400);

      await DocumentController.createDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { companionId: "c1" };
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      req.body = { title: "Doc", category: "Health" };

      mockGenericError("create");
      await DocumentController.createDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createDocumentPms", () => {
    it("should 401 if auth missing", async () => {
      req.params = { companionId: "c1" };
      await DocumentController.createDocumentPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if companionId missing", async () => {
      (req as any).userId = "pms1";
      req.params = {};
      await DocumentController.createDocumentPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (201)", async () => {
      (req as any).userId = "pms1";
      req.params = { companionId: "c1" };
      req.body = { title: "Doc", category: "Test" };
      mockedDocumentService.create.mockResolvedValue({ id: "d1" } as any);

      await DocumentController.createDocumentPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      (req as any).userId = "pms1";
      req.params = { companionId: "c1" };
      req.body = { title: "Doc", category: "Test" };
      mockServiceError("create", 400);
      await DocumentController.createDocumentPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "pms1";
      req.params = { companionId: "c1" };
      req.body = { title: "Doc", category: "Test" };
      mockGenericError("create");
      await DocumentController.createDocumentPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listDocumentsForParent", () => {
    it("should 400 if companionId missing", async () => {
      req.params = {};
      await DocumentController.listDocumentsForParent(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.params = { companionId: "c1" };
      req.query = { category: "cat" };
      mockedDocumentService.listForParent.mockResolvedValue([] as any);

      await DocumentController.listDocumentsForParent(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { companionId: "c1" };
      mockServiceError("listForParent", 404);
      await DocumentController.listDocumentsForParent(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      req.params = { companionId: "c1" };
      mockGenericError("listForParent");
      await DocumentController.listDocumentsForParent(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listForAppointment", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "apt1" };
      mockedDocumentService.listForAppointmentParent.mockResolvedValue(
        [] as any,
      );
      await DocumentController.listForAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { appointmentId: "apt1" };
      mockServiceError("listForAppointmentParent", 400);
      await DocumentController.listForAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { appointmentId: "apt1" };
      mockGenericError("listForAppointmentParent");
      await DocumentController.listForAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateDocument", () => {
    it("should 401 if user not authenticated", async () => {
      await DocumentController.updateDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if documentId missing", async () => {
      (req as any).userId = "u1";
      req.params = {};
      await DocumentController.updateDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should update as Parent Context", async () => {
      (req as any).userId = "u1";
      req.params = { documentId: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedDocumentService.update.mockResolvedValue({ id: "d1" } as any);

      await DocumentController.updateDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should update as PMS Context", async () => {
      (req as any).userId = "pms1";
      req.params = { id: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: null,
      } as any);
      mockedDocumentService.update.mockResolvedValue({ id: "d1" } as any);

      await DocumentController.updateDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.params = { documentId: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockServiceError("update", 404);

      await DocumentController.updateDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.params = { documentId: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockGenericError("update");

      await DocumentController.updateDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listForPms", () => {
    it("should 401 if auth missing", async () => {
      await DocumentController.listForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if companionId missing", async () => {
      (req as any).userId = "pms1";
      req.params = {};
      await DocumentController.listForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200) with simple string query", async () => {
      (req as any).userId = "pms1";
      req.params = { companionId: "c1" };
      req.query = { category: "cat1" };
      mockedDocumentService.listForPms.mockResolvedValue([] as any);

      await DocumentController.listForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "pms1";
      req.params = { companionId: "c1" };
      mockServiceError("listForPms", 400);
      await DocumentController.listForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "pms1";
      req.params = { companionId: "c1" };
      mockGenericError("listForPms");
      await DocumentController.listForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getForParent", () => {
    it("should 404 if not found", async () => {
      req.params = { id: "d1" };
      mockedDocumentService.getByIdForParent.mockResolvedValue(null);
      await DocumentController.getForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { id: "d1" };
      mockedDocumentService.getByIdForParent.mockResolvedValue({
        id: "d1",
      } as any);
      await DocumentController.getForParent(req as any, res as Response);
      expect(res.json).toHaveBeenCalledWith({ id: "d1" });
    });

    it("should handle service error", async () => {
      req.params = { id: "d1" };
      mockServiceError("getByIdForParent", 400);
      await DocumentController.getForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { id: "d1" };
      mockGenericError("getByIdForParent");
      await DocumentController.getForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getForPms", () => {
    it("should 404 if not found", async () => {
      req.params = { documentId: "d1" };
      mockedDocumentService.getByIdForPms.mockResolvedValue(null);
      await DocumentController.getForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { documentId: "d1" };
      mockedDocumentService.getByIdForPms.mockResolvedValue({
        id: "d1",
      } as any);
      await DocumentController.getForPms(req as any, res as Response);
      expect(res.json).toHaveBeenCalledWith({ id: "d1" });
    });

    it("should handle service error", async () => {
      req.params = { documentId: "d1" };
      mockServiceError("getByIdForPms", 400);
      await DocumentController.getForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { documentId: "d1" };
      mockGenericError("getByIdForPms");
      await DocumentController.getForPms(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteForParent", () => {
    it("should 401 if user not authenticated", async () => {
      await DocumentController.deleteForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 401 if user not found in mobile service", async () => {
      (req as any).userId = "u1";
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue(null);
      await DocumentController.deleteForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (204)", async () => {
      (req as any).userId = "u1";
      req.params = { documentId: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockedDocumentService.deleteForParent.mockResolvedValue({} as any);

      await DocumentController.deleteForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(204);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.params = { documentId: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockServiceError("deleteForParent", 403);
      await DocumentController.deleteForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.params = { documentId: "d1" };
      mockedAuthMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "p1",
      } as any);
      mockGenericError("deleteForParent");
      await DocumentController.deleteForParent(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getSignedDownloadUrl", () => {
    it("should 400 if key missing", async () => {
      req.body = {};
      await DocumentController.getSignedDownloadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.body = { key: "k1" };
      mockedUpload.generatePresignedDownloadUrl.mockResolvedValue(
        "http://d/k1",
      );
      await DocumentController.getSignedDownloadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith("http://d/k1");
    });

    it("should handle generic error", async () => {
      req.body = { key: "k1" };
      mockedUpload.generatePresignedDownloadUrl.mockRejectedValue(
        new Error("fail"),
      );
      await DocumentController.getSignedDownloadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getDocumentDownloadUrl", () => {
    it("should 400 if doc id missing", async () => {
      req.params = {};
      await DocumentController.getDocumentDownloadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle service error", async () => {
      req.params = { documentId: "d1" };
      mockServiceError("getAllAttachmentUrls", 404);
      await DocumentController.getDocumentDownloadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle generic error", async () => {
      req.params = { documentId: "d1" };
      mockGenericError("getAllAttachmentUrls");
      await DocumentController.getDocumentDownloadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("searchDocument", () => {
    it("should 400 if companionId missing", async () => {
      req.params = {};
      req.query = { title: "doc" };
      await DocumentController.searchDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 400 if title missing", async () => {
      req.params = { companionId: "c1" };
      req.query = {};
      await DocumentController.searchDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.params = { companionId: "c1" };
      req.query = { title: "doc" };
      mockedDocumentService.searchByTitleForParent.mockResolvedValue([]);
      await DocumentController.searchDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { companionId: "c1" };
      req.query = { title: "doc" };
      mockServiceError("searchByTitleForParent", 400);
      await DocumentController.searchDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { companionId: "c1" };
      req.query = { title: "doc" };
      mockGenericError("searchByTitleForParent");
      await DocumentController.searchDocument(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
