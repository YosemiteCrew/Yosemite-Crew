import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { ParentController } from "../../../src/controllers/app/parent.controller";
import { ParentService } from "../../../src/services/parent.service";
import * as UploadMiddleware from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

// ----------------------------------------------------------------------
// 1. Mock Setup (Preserving Error Class)
// ----------------------------------------------------------------------
jest.mock("../../../src/services/parent.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/parent.service",
  ) as unknown as any;
  return {
    ...actual,
    ParentService: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByName: jest.fn(),
    },
  };
});

jest.mock("../../../src/middlewares/upload");
jest.mock("../../../src/utils/logger");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ParentServiceError } = jest.requireActual(
  "../../../src/services/parent.service",
) as unknown as any;

// ----------------------------------------------------------------------
// 2. Typed Mocks
// ----------------------------------------------------------------------
const mockedParentService = jest.mocked(ParentService);
const mockedUpload = jest.mocked(UploadMiddleware);
const mockedLogger = jest.mocked(logger);

describe("ParentController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  const validFhirPayload = {
    resourceType: "RelatedPerson",
    name: [{ given: ["John"] }],
  };

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
  // 3. Error Helpers (Fixed Type Casting)
  // ----------------------------------------------------------------------
  const mockServiceError = (
    method: keyof typeof ParentService,
    status = 400,
    msg = "Error",
  ) => {
    mockedParentService[method].mockRejectedValue(
      new ParentServiceError(msg, status),
    );
  };

  const mockGenericError = (method: keyof typeof ParentService) => {
    mockedParentService[method].mockRejectedValue(new Error("Boom"));
  };

  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe("Helper: extractFHIRPayload", () => {
    it("should 400 if body is missing", async () => {
      req.body = null;
      (req as any).userId = "u1";
      await ParentController.createParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Request body is required.",
      });
    });

    it("should 400 if resourceType is invalid", async () => {
      req.body = { resourceType: "Patient" }; // Should be RelatedPerson
      (req as any).userId = "u1";
      await ParentController.createParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid FHIR RelatedPerson payload.",
      });
    });

    it("should handle wrapped payload", async () => {
      req.body = { payload: validFhirPayload };
      (req as any).userId = "u1";
      mockedParentService.create.mockResolvedValue({ response: {} } as any);

      await ParentController.createParentMobile(req as any, res as Response);
      expect(mockedParentService.create).toHaveBeenCalledWith(
        validFhirPayload,
        expect.anything(),
      );
    });
  });

  // --- MOBILE CONTROLLERS ---

  describe("createParentMobile", () => {
    it("should 401 if not authenticated", async () => {
      req.body = validFhirPayload;
      await ParentController.createParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.body = validFhirPayload;
      mockedParentService.create.mockResolvedValue({
        response: { id: "p1" },
      } as any);

      await ParentController.createParentMobile(req as any, res as Response);
      expect(mockedParentService.create).toHaveBeenCalledWith(
        validFhirPayload,
        expect.objectContaining({ source: "mobile", authUserId: "u1" }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.body = validFhirPayload;
      mockServiceError("create", 409);
      await ParentController.createParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.body = validFhirPayload;
      mockGenericError("create");
      await ParentController.createParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getParentMobile", () => {
    it("should 401 if not authenticated", async () => {
      await ParentController.getParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if id missing", async () => {
      (req as any).userId = "u1";
      req.params = {};
      await ParentController.getParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if not found", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockedParentService.get.mockResolvedValue(null);
      await ParentController.getParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockedParentService.get.mockResolvedValue({
        response: { id: "p1" },
      } as any);
      await ParentController.getParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockServiceError("get", 403);
      await ParentController.getParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockGenericError("get");
      await ParentController.getParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateParentMobile", () => {
    it("should 401 if not authenticated", async () => {
      await ParentController.updateParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if id missing", async () => {
      (req as any).userId = "u1";
      req.params = {};
      await ParentController.updateParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if result null", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockedParentService.update.mockResolvedValue(null);
      await ParentController.updateParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockedParentService.update.mockResolvedValue({
        response: { id: "p1" },
      } as any);
      await ParentController.updateParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockServiceError("update", 400);
      await ParentController.updateParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockGenericError("update");
      await ParentController.updateParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteParentMobile", () => {
    it("should 401 if not authenticated", async () => {
      await ParentController.deleteParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 400 if id missing", async () => {
      (req as any).userId = "u1";
      req.params = {};
      await ParentController.deleteParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if result null", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockedParentService.delete.mockResolvedValue(null);
      await ParentController.deleteParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (204)", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockedParentService.delete.mockResolvedValue({} as any);
      await ParentController.deleteParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(204);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockServiceError("delete", 403);
      await ParentController.deleteParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.params = { id: "p1" };
      mockGenericError("delete");
      await ParentController.deleteParentMobile(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // --- PMS CONTROLLERS ---

  describe("createParentPMS", () => {
    it("should success (201)", async () => {
      req.body = validFhirPayload;
      mockedParentService.create.mockResolvedValue({
        response: { id: "p1" },
      } as any);
      await ParentController.createParentPMS(req as any, res as Response);
      expect(mockedParentService.create).toHaveBeenCalledWith(
        validFhirPayload,
        expect.objectContaining({ source: "pms" }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      req.body = validFhirPayload;
      mockServiceError("create", 400);
      await ParentController.createParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.body = validFhirPayload;
      mockGenericError("create");
      await ParentController.createParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getParentPMS", () => {
    it("should 400 if id missing", async () => {
      req.params = {};
      await ParentController.getParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if not found", async () => {
      req.params = { id: "p1" };
      mockedParentService.get.mockResolvedValue(null);
      await ParentController.getParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { id: "p1" };
      mockedParentService.get.mockResolvedValue({
        response: { id: "p1" },
      } as any);
      await ParentController.getParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { id: "p1" };
      mockServiceError("get", 400);
      await ParentController.getParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { id: "p1" };
      mockGenericError("get");
      await ParentController.getParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateParentPMS", () => {
    it("should 400 if id missing", async () => {
      await ParentController.updateParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if result null", async () => {
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockedParentService.update.mockResolvedValue(null);
      await ParentController.updateParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockedParentService.update.mockResolvedValue({
        response: { id: "p1" },
      } as any);
      await ParentController.updateParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockServiceError("update", 400);
      await ParentController.updateParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { id: "p1" };
      req.body = validFhirPayload;
      mockGenericError("update");
      await ParentController.updateParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteParentPMS", () => {
    it("should 400 if id missing", async () => {
      await ParentController.deleteParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if result null", async () => {
      req.params = { id: "p1" };
      mockedParentService.delete.mockResolvedValue(null);
      await ParentController.deleteParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (204)", async () => {
      req.params = { id: "p1" };
      mockedParentService.delete.mockResolvedValue({} as any);
      await ParentController.deleteParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(204);
    });

    it("should handle service error", async () => {
      req.params = { id: "p1" };
      mockServiceError("delete", 400);
      await ParentController.deleteParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { id: "p1" };
      mockGenericError("delete");
      await ParentController.deleteParentPMS(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // --- MISC ---

  describe("searchByName", () => {
    it("should 400 if name missing or invalid", async () => {
      req.query = {};
      await ParentController.searchByName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);

      req.query = { name: ["array"] as any };
      await ParentController.searchByName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.query = { name: "John" };
      mockedParentService.getByName.mockResolvedValue({ responses: [] } as any);
      await ParentController.searchByName(req as any, res as Response);
      expect(mockedParentService.getByName).toHaveBeenCalledWith("John");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.query = { name: "John" };
      mockServiceError("getByName", 400);
      await ParentController.searchByName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.query = { name: "John" };
      mockGenericError("getByName");
      await ParentController.searchByName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getProfileUploadUrl", () => {
    it("should 400 if mimeType missing", async () => {
      req.body = {};
      await ParentController.getProfileUploadUrl(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.body = { mimeType: "image/jpeg" };
      mockedUpload.generatePresignedUrl.mockResolvedValue({
        url: "http://s3",
        key: "key",
      });
      await ParentController.getProfileUploadUrl(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle generic error", async () => {
      req.body = { mimeType: "image/jpeg" };
      mockedUpload.generatePresignedUrl.mockRejectedValue(new Error("Fail"));
      await ParentController.getProfileUploadUrl(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
