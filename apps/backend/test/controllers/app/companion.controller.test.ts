import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";

// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Adjusted to go up 3 levels (test/controllers/app -> root)
// ----------------------------------------------------------------------
import { CompanionController } from "../../../src/controllers/app/companion.controller";
import { CompanionService } from "../../../src/services/companion.service";
import { CompanionOrganisationService } from "../../../src/services/companion-organisation.service";
import { prisma } from "src/config/prisma";
import * as UploadMiddleware from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

// ----------------------------------------------------------------------
// 2. MOCK SETUP
// ----------------------------------------------------------------------
// We use a Mock Factory to preserve the actual Error class constructor
jest.mock("../../../src/services/companion.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/companion.service",
  ) as unknown as any;
  return {
    ...actual,
    CompanionService: {
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByName: jest.fn(),
      listByParent: jest.fn(),
      listByParentNotInOrganisation: jest.fn(),
    },
  };
});

jest.mock("../../../src/services/companion-organisation.service");
jest.mock("src/config/prisma", () => ({
  __esModule: true,
  prisma: {
    organization: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("../../../src/utils/logger");
jest.mock("../../../src/middlewares/upload");

// Retrieve the REAL Error class for use in our helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CompanionServiceError } = jest.requireActual(
  "../../../src/services/companion.service",
) as unknown as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedCompanionService = jest.mocked(CompanionService);
const mockedCompOrgService = jest.mocked(CompanionOrganisationService);
const mockedOrgFindFirst = prisma.organization
  .findFirst as unknown as jest.MockedFunction<() => Promise<unknown>>;
const mockedUpload = jest.mocked(UploadMiddleware);

describe("CompanionController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  const validFhirPayload = {
    resourceType: "Patient",
    name: [{ given: ["Fido"] }],
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
  // 4. ERROR HELPERS (FIXED: Type Casting)
  // ----------------------------------------------------------------------
  const mockServiceError = (
    method: keyof typeof CompanionService,
    status = 400,
    msg = "Error",
  ) => {
    const error = new CompanionServiceError(msg, status);
    mockedCompanionService[method].mockRejectedValue(error);
  };

  const mockGenericError = (method: keyof typeof CompanionService) => {
    mockedCompanionService[method].mockRejectedValue(new Error("Boom"));
  };

  // ----------------------------------------------------------------------
  // 5. TESTS
  // ----------------------------------------------------------------------

  describe("Helper: resolveMobileUserId", () => {
    it("should resolve from x-user-id header", async () => {
      req.headers = { "x-user-id": "header-user" };
      req.body = validFhirPayload;
      mockedCompanionService.create.mockResolvedValue({ response: {} } as any);

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );

      expect(mockedCompanionService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ authUserId: "header-user" }),
      );
    });

    it("should resolve from req.userId", async () => {
      (req as any).userId = "req-user";
      req.body = validFhirPayload;
      mockedCompanionService.create.mockResolvedValue({ response: {} } as any);

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );

      expect(mockedCompanionService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ authUserId: "req-user" }),
      );
    });
  });

  describe("Helper: extractFHIRPayload", () => {
    it("should 400 if body is missing", async () => {
      req.body = null;
      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Request body is required.",
      });
    });

    it("should 400 if resourceType != Patient", async () => {
      req.body = { resourceType: "Observation" };
      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid FHIR Patient payload.",
      });
    });

    it("should handle wrapped payload { payload: ... }", async () => {
      (req as any).userId = "u1";
      req.body = { payload: validFhirPayload };
      mockedCompanionService.create.mockResolvedValue({ response: {} } as any);

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );

      expect(mockedCompanionService.create).toHaveBeenCalledWith(
        validFhirPayload,
        expect.anything(),
      );
    });
  });

  describe("createCompanionMobile", () => {
    it("should 401 if no auth", async () => {
      req.body = validFhirPayload;
      (req as any).userId = undefined;
      req.headers = {};

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.body = validFhirPayload;
      const mockResponse = { id: "c1" };
      mockedCompanionService.create.mockResolvedValue({
        response: mockResponse,
      } as any);

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle service error", async () => {
      (req as any).userId = "u1";
      req.body = validFhirPayload;
      mockServiceError("create", 409, "Conflict");

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it("should handle generic error", async () => {
      (req as any).userId = "u1";
      req.body = validFhirPayload;
      mockGenericError("create");

      await CompanionController.createCompanionMobile(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createCompanionPMS", () => {
    it("should 400 if parentId invalid/missing", async () => {
      req.body = { ...validFhirPayload, parentId: "" };
      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Valid parentId"),
        }),
      );
    });

    it("should create successfully without org linking", async () => {
      req.body = { ...validFhirPayload, parentId: "parent-1" };
      mockedCompanionService.create.mockResolvedValue({
        response: { id: "c1" },
      } as any);

      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ id: "c1" });
    });

    // --- Org Linking Path ---
    it("should 401 if org linking requested but no auth user", async () => {
      req.body = { ...validFhirPayload, parentId: "parent-1" };
      req.params = { orgId: "org-1" };
      (req as any).userId = undefined;

      mockedCompanionService.create.mockResolvedValue({
        response: { id: "c1" },
      } as any);

      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should 404 if organisation not found", async () => {
      req.body = { ...validFhirPayload, parentId: "parent-1" };
      req.params = { orgId: "org-1" };
      (req as any).userId = "pmsUser";

      mockedCompanionService.create.mockResolvedValue({
        response: { id: "c1" },
      } as any);
      mockedOrgFindFirst.mockResolvedValue(null);

      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Organisation not found"),
        }),
      );
    });

    it("should success (201) with Org Linking", async () => {
      req.body = { ...validFhirPayload, parentId: "parent-1" };
      req.params = { orgId: "org-1" };
      (req as any).userId = "pmsUser";

      mockedCompanionService.create.mockResolvedValue({
        response: { id: "c1" },
      } as any);
      mockedOrgFindFirst.mockResolvedValue({ type: "HOSPITAL" });
      mockedCompOrgService.linkByPmsUser.mockResolvedValue({} as any);

      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );

      expect(mockedCompOrgService.linkByPmsUser).toHaveBeenCalledWith({
        pmsUserId: "pmsUser",
        organisationId: "org-1",
        organisationType: "HOSPITAL",
        patientId: "c1",
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle service error", async () => {
      req.body = { ...validFhirPayload, parentId: "parent-1" };
      mockServiceError("create", 400);

      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.body = { ...validFhirPayload, parentId: "parent-1" };
      mockGenericError("create");

      await CompanionController.createCompanionPMS(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getCompanionById", () => {
    it("should 400 if id missing", async () => {
      // req.params.id is undefined by default in beforeEach
      await CompanionController.getCompanionById(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if not found", async () => {
      req.params = { id: "c1" };
      mockedCompanionService.getById.mockResolvedValue(null);
      await CompanionController.getCompanionById(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { id: "c1" };
      mockedCompanionService.getById.mockResolvedValue({
        response: { id: "c1" },
      } as any);
      await CompanionController.getCompanionById(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: "c1" });
    });

    it("should handle service error", async () => {
      req.params = { id: "c1" };
      mockServiceError("getById", 403);
      await CompanionController.getCompanionById(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should handle generic error", async () => {
      req.params = { id: "c1" };
      mockGenericError("getById");
      await CompanionController.getCompanionById(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("updateCompanion", () => {
    it("should 400 if id missing", async () => {
      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if result null", async () => {
      req.params = { id: "c1" };
      req.body = validFhirPayload;
      mockedCompanionService.update.mockResolvedValue(null as any);

      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { id: "c1" };
      req.body = validFhirPayload;
      mockedCompanionService.update.mockResolvedValue({
        response: { id: "c1" },
      } as any);

      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("ignores an x-org-id header that no org middleware verified", async () => {
      req.params = { id: "c1" };
      req.body = validFhirPayload;
      req.headers = { "x-org-id": "victim-org", "x-user-id": "spoofed-user" };
      mockedCompanionService.update.mockResolvedValue({
        response: { id: "c1" },
      } as any);

      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );

      expect(mockedCompanionService.update).toHaveBeenCalledWith(
        "c1",
        expect.anything(),
        { organisationId: undefined, authUserId: undefined },
      );
    });

    it("uses the organisation withOrgPermissions resolved", async () => {
      req.params = { id: "c1" };
      req.body = validFhirPayload;
      req.headers = { "x-org-id": "victim-org" };
      (req as any).organisationId = "verified-org";
      (req as any).userId = "session-user";
      mockedCompanionService.update.mockResolvedValue({
        response: { id: "c1" },
      } as any);

      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );

      expect(mockedCompanionService.update).toHaveBeenCalledWith(
        "c1",
        expect.anything(),
        { organisationId: "verified-org", authUserId: "session-user" },
      );
    });

    it("should handle service error", async () => {
      req.params = { id: "c1" };
      req.body = validFhirPayload;
      mockServiceError("update", 400);
      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { id: "c1" };
      req.body = validFhirPayload;
      mockGenericError("update");
      await CompanionController.updateCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteCompanion", () => {
    it("should 400 if id missing", async () => {
      await CompanionController.deleteCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (204)", async () => {
      req.params = { id: "c1" };
      (req as any).userId = "u1";
      mockedCompanionService.delete.mockResolvedValue({} as any);

      await CompanionController.deleteCompanion(
        req as Request,
        res as Response,
      );
      expect(mockedCompanionService.delete).toHaveBeenCalledWith("c1", {
        authUserId: "u1",
      });
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });

    it("should handle service error", async () => {
      req.params = { id: "c1" };
      mockServiceError("delete", 403);
      await CompanionController.deleteCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should handle generic error", async () => {
      req.params = { id: "c1" };
      mockGenericError("delete");
      await CompanionController.deleteCompanion(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("searchCompanionByName", () => {
    it("should 400 if name missing or invalid", async () => {
      req.query = {};
      await CompanionController.searchCompanionByName(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);

      req.query = { name: ["array", "fail"] as any }; // Invalid type check
      await CompanionController.searchCompanionByName(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.query = { name: "fido" };
      mockedCompanionService.getByName.mockResolvedValue({
        responses: [],
      } as any);

      await CompanionController.searchCompanionByName(
        req as Request,
        res as Response,
      );
      expect(mockedCompanionService.getByName).toHaveBeenCalledWith("fido");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.query = { name: "fido" };
      mockServiceError("getByName", 400);
      await CompanionController.searchCompanionByName(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.query = { name: "fido" };
      mockGenericError("getByName");
      await CompanionController.searchCompanionByName(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getProfileUploadUrl", () => {
    it("should 400 if mimeType missing", async () => {
      req.body = {};
      await CompanionController.getProfileUploadUrl(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.body = { mimeType: "image/jpeg" };
      mockedUpload.generatePresignedUrl.mockResolvedValue({
        url: "http://s3",
        key: "key",
      });

      await CompanionController.getProfileUploadUrl(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ url: "http://s3", key: "key" });
    });

    it("should handle error (500)", async () => {
      req.body = { mimeType: "image/jpeg" };
      mockedUpload.generatePresignedUrl.mockRejectedValue(
        new Error("S3 error"),
      );

      await CompanionController.getProfileUploadUrl(
        req as Request,
        res as Response,
      );
      expect(logger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getCompanionsByParentId", () => {
    it("should 400 if missing param", async () => {
      await CompanionController.getCompanionsByParentId(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.params = { parentId: "p1" };
      mockedCompanionService.listByParent.mockResolvedValue({
        responses: [],
      } as any);

      await CompanionController.getCompanionsByParentId(
        req as Request,
        res as Response,
      );
      expect(mockedCompanionService.listByParent).toHaveBeenCalledWith("p1", {
        authUserId: undefined,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("passes the session user id, never the x-user-id header", async () => {
      req.params = { parentId: "p1" };
      (req as any).userId = "session-user";
      req.headers = { "x-user-id": "spoofed-user" };
      mockedCompanionService.listByParent.mockResolvedValue({
        responses: [],
      } as any);

      await CompanionController.getCompanionsByParentId(
        req as Request,
        res as Response,
      );
      expect(mockedCompanionService.listByParent).toHaveBeenCalledWith("p1", {
        authUserId: "session-user",
      });
    });

    it("should handle service error", async () => {
      req.params = { parentId: "p1" };
      mockServiceError("listByParent", 400);
      await CompanionController.getCompanionsByParentId(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { parentId: "p1" };
      mockGenericError("listByParent");
      await CompanionController.getCompanionsByParentId(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listParentCompanionsNotInOrganisation", () => {
    it("should 400 if params missing", async () => {
      req.params = { parentId: "p1" }; // Missing orgId
      await CompanionController.listParentCompanionsNotInOrganisation(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      req.params = { parentId: "p1", organisationId: "o1" };
      mockedCompanionService.listByParentNotInOrganisation.mockResolvedValue({
        responses: [],
      } as any);

      await CompanionController.listParentCompanionsNotInOrganisation(
        req as Request,
        res as Response,
      );
      expect(
        mockedCompanionService.listByParentNotInOrganisation,
      ).toHaveBeenCalledWith("p1", "o1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle service error", async () => {
      req.params = { parentId: "p1", organisationId: "o1" };
      mockServiceError("listByParentNotInOrganisation", 400);
      await CompanionController.listParentCompanionsNotInOrganisation(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should handle generic error", async () => {
      req.params = { parentId: "p1", organisationId: "o1" };
      mockGenericError("listByParentNotInOrganisation");
      await CompanionController.listParentCompanionsNotInOrganisation(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
