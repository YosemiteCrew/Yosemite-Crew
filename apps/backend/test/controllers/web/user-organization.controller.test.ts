import { Request, Response } from "express";
import logger from "../../../src/utils/logger";
import { resolveUserIdFromRequest } from "../../../src/utils/request";
import { UserOrganizationController } from "../../../src/controllers/web/user-organization.controller";
import { UserOrganizationService } from "../../../src/services/user-organization.service";

jest.mock("../../../src/utils/logger");
jest.mock("../../../src/utils/request", () => ({
  resolveUserIdFromRequest: jest.fn(),
}));

jest.mock("../../../src/services/user-organization.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/user-organization.service",
  );
  return {
    ...actual,
    UserOrganizationService: {
      upsert: jest.fn(),
      getById: jest.fn(),
      listAll: jest.fn(),
      deleteById: jest.fn(),
      update: jest.fn(),
      listByUserId: jest.fn(),
      listByOrganisationId: jest.fn(),
      getMappingByUserAndOrganization: jest.fn(),
    },
  };
});

type MockResponse = Partial<Response> & {
  status: jest.Mock;
  json: jest.Mock;
};

const createMockReq = (data: Partial<any> = {}): any => ({
  params: {},
  body: {},
  ...data,
});

const createMockRes = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("UserOrganizationController", () => {
  let mockRes: MockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = createMockRes();
  });

  describe("listMappings", () => {
    it("returns the current user's mappings", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        { id: "mapping-1" },
      ]);

      await UserOrganizationController.listMappings(
        createMockReq(),
        mockRes as Response,
      );

      expect(UserOrganizationService.listByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([{ id: "mapping-1" }]);
    });

    it("returns 401 when the token user id is missing", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.listMappings(
        createMockReq(),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unauthorized: missing user id.",
      });
      expect(UserOrganizationService.listByUserId).not.toHaveBeenCalled();
    });
  });

  describe("upsertMapping", () => {
    it("returns 401 when the token user id is missing", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: { resourceType: "PractitionerRole" },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid payload", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");

      await UserOrganizationController.upsertMapping(
        createMockReq({ body: {} }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR PractitionerRole resource.",
      });
    });

    it("returns service data on success", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockResolvedValue({
        id: "mapping-1",
      });
      (UserOrganizationService.upsert as jest.Mock).mockResolvedValue({
        response: { id: "mapping-1" },
        created: true,
      });

      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: {
            resourceType: "PractitionerRole",
            // Real FHIR PractitionerRole payload shape emitted by the frontend.
            organization: { reference: "Organization/org-1" },
          },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ id: "mapping-1" });
    });

    it("rejects an upsert whose payload carries no organisation reference", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");

      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: { resourceType: "PractitionerRole" },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.upsert).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns 401 when the token user id is missing", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.getById).not.toHaveBeenCalled();
    });

    it("returns the mapping on success", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockResolvedValue({
        id: "mapping-1",
      });
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        organizationReference: "Organization/org-1",
      });

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(UserOrganizationService.getById).toHaveBeenCalledWith("mapping-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("returns 403 when the user is not linked to the organisation", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockResolvedValue(null);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You do not have access to this organisation.",
      });
      expect(UserOrganizationService.getById).toHaveBeenCalledWith("mapping-1");
    });
  });

  describe("deleteMappingById", () => {
    it("returns 401 when the token user id is missing", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.deleteById).not.toHaveBeenCalled();
    });
  });

  describe("updateMappingById", () => {
    it("returns 401 when the token user id is missing", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.updateMappingById(
        createMockReq({
          params: { id: "mapping-1" },
          body: { resourceType: "PractitionerRole" },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.update).not.toHaveBeenCalled();
    });
  });
});
