import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 2 levels to src from test/controllers/
// ----------------------------------------------------------------------
import { UserProfileController } from "../../src/controllers/web/user-profile.controller";
import { UserProfileService } from "../../src/services/user-profile.service";
import * as UploadMiddleware from "../../src/middlewares/upload";
import logger from "../../src/utils/logger";

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock("../../src/services/user-profile.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../src/services/user-profile.service",
  ) as any;
  return {
    ...actual,
    UserProfileService: {
      create: jest.fn(),
      update: jest.fn(),
      getByUserId: jest.fn(),
    },
  };
});

jest.mock("../../src/middlewares/upload");
jest.mock("../../src/utils/logger");

// Retrieve REAL Error class
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { UserProfileServiceError } = jest.requireActual(
  "../../src/services/user-profile.service",
) as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedProfileService = jest.mocked(UserProfileService);
const mockedUpload = jest.mocked(UploadMiddleware);
const mockedLogger = jest.mocked(logger);

describe("UserProfileController", () => {
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
      params: {},
      body: {},
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
  // 4. ERROR HELPERS
  // ----------------------------------------------------------------------
  const mockServiceError = (
    method: keyof typeof UserProfileService,
    status = 400,
    msg = "Service Error",
  ) => {
    const error = new UserProfileServiceError(msg, status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedProfileService[method] as any).mockRejectedValue(error);
  };

  const mockGenericError = (method: keyof typeof UserProfileService) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedProfileService[method] as any).mockRejectedValue(new Error("Boom"));
  };

  /* ========================================================================
   * TESTS
   * ======================================================================*/

  describe("create", () => {
    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.params = { organizationId: "org1" };
      req.body = { firstName: "John" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.create as any).mockResolvedValue({ id: "p1" });

      await UserProfileController.create(req as any, res as Response);
      expect(mockedProfileService.create).toHaveBeenCalledWith({
        firstName: "John",
        userId: "u1",
        organizationId: "org1",
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should throw 400 if body invalid (array)", async () => {
      req.body = []; // Array is invalid
      await UserProfileController.create(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body.",
      });
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.body = { firstName: "John" };
      mockServiceError("create", 409);
      await UserProfileController.create(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.body = { firstName: "John" };
      mockGenericError("create");
      await UserProfileController.create(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("update", () => {
    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { organizationId: "org1" };
      req.body = { firstName: "Updated" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.update as any).mockResolvedValue({ id: "p1" });

      await UserProfileController.update(req as any, res as Response);
      expect(mockedProfileService.update).toHaveBeenCalledWith(
        "u1",
        "org1",
        req.body,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should 404 if not found", async () => {
      (req as any).userId = "u1";
      req.body = { firstName: "Updated" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.update as any).mockResolvedValue(null);

      await UserProfileController.update(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.body = { firstName: "Updated" };
      mockServiceError("update", 400);
      await UserProfileController.update(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.body = { firstName: "Updated" };
      mockGenericError("update");
      await UserProfileController.update(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getByUserId", () => {
    it("should success (200) using header user-id", async () => {
      req.headers = { "x-user-id": "headerUser" };
      req.params = { organizationId: "org1" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.getByUserId as any).mockResolvedValue({ id: "p1" });

      await UserProfileController.getByUserId(req as any, res as Response);
      expect(mockedProfileService.getByUserId).toHaveBeenCalledWith(
        "headerUser",
        "org1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should success (200) using req.userId", async () => {
      (req as any).userId = "reqUser";
      req.params = { organizationId: "org1" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.getByUserId as any).mockResolvedValue({ id: "p1" });

      await UserProfileController.getByUserId(req as any, res as Response);
      expect(mockedProfileService.getByUserId).toHaveBeenCalledWith(
        "reqUser",
        "org1",
      );
    });

    it("should 404 if not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.getByUserId as any).mockResolvedValue(null);
      await UserProfileController.getByUserId(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle service error", async () => {
      mockServiceError("getByUserId", 400);
      await UserProfileController.getByUserId(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      mockGenericError("getByUserId");
      await UserProfileController.getByUserId(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getUserProfileById", () => {
    it("should success (200) using path param userId", async () => {
      req.params = { userId: "pathUser", organizationId: "org1" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.getByUserId as any).mockResolvedValue({ id: "p1" });

      await UserProfileController.getUserProfileById(
        req as any,
        res as Response,
      );
      expect(mockedProfileService.getByUserId).toHaveBeenCalledWith(
        "pathUser",
        "org1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should 404 if not found", async () => {
      req.params = { userId: "pathUser" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedProfileService.getByUserId as any).mockResolvedValue(null);
      await UserProfileController.getUserProfileById(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should handle service error", async () => {
      req.params = { userId: "pathUser" };
      mockServiceError("getByUserId", 400);
      await UserProfileController.getUserProfileById(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { userId: "pathUser" };
      mockGenericError("getByUserId");
      await UserProfileController.getUserProfileById(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getProfilePictureUploadUrl", () => {
    it("should 400 if orgId missing", async () => {
      (req as any).userId = "u1";
      req.params = {}; // Missing organizationId
      await UserProfileController.getProfilePictureUploadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 400 if mimeType missing", async () => {
      (req as any).userId = "u1";
      req.params = { organizationId: "org1" };
      req.body = {}; // missing mimeType
      await UserProfileController.getProfilePictureUploadUrl(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { organizationId: "org1" };
      req.body = { mimeType: "image/png" };
      // FIX: Cast to any/jest.Mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedUpload.generatePresignedUrl as any).mockResolvedValue({
        url: "http://s3",
        key: "k",
      });

      await UserProfileController.getProfilePictureUploadUrl(
        req as any,
        res as Response,
      );
      expect(mockedUpload.generatePresignedUrl).toHaveBeenCalledWith(
        "image/png",
        "user-org",
        "u1-org1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.params = { organizationId: "org1" };
      req.body = { mimeType: "image/png" };
      // FIX: Cast to any/jest.Mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedUpload.generatePresignedUrl as any).mockRejectedValue(
        new Error("S3 fail"),
      );

      await UserProfileController.getProfilePictureUploadUrl(
        req as any,
        res as Response,
      );
      expect(logger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
