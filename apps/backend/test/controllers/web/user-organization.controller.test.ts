import { Request, Response } from "express";
import logger from "../../../src/utils/logger";
import { resolveUserIdFromRequest } from "../../../src/utils/request";
import { UserOrganizationController } from "../../../src/controllers/web/user-organization.controller";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
} from "../../../src/services/user-organization.service";

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
    // clearAllMocks keeps implementations, so a `mockResolvedValue` from one
    // test would otherwise still answer the next one's calls and make the
    // suite order-dependent. Every test states the service answers it needs.
    for (const stub of Object.values(UserOrganizationService)) {
      (stub as jest.Mock).mockReset();
    }
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
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        organizationReference: "Organization/org-1",
      });
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

  // The controller is the only place the organisation a request *addresses* is
  // reconciled with the organisations the caller belongs to, so both the
  // reference-shape parsing and the membership check are exercised directly.
  describe("organisation reference resolution", () => {
    const grantOnly = (allowedOrganisationId: string) => {
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockImplementation(async (_userId: string, organisationId: string) =>
        organisationId === allowedOrganisationId ? { id: "mapping-1" } : null,
      );
    };

    beforeEach(() => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      grantOnly("org-1");
    });

    it("strips the Organization/ prefix before checking membership", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        organizationReference: "Organization/org-1",
      });

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("passes an unprefixed organisation reference through unchanged", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        organizationReference: "  org-1  ",
      });

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("reads the organisation from the first element of a mapping list", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue([
        { id: "mapping-1", organizationReference: "Organization/org-1" },
        { id: "mapping-2", organizationReference: "Organization/org-2" },
      ]);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "Practitioner/user-1" } }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("unwraps a nested mapping envelope inside a list", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue([
        { mapping: { organizationReference: "Organization/org-1" } },
      ]);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "Practitioner/user-1" } }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("unwraps a nested mapping envelope on a single resource", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        mapping: { organizationReference: "Organization/org-1" },
      });

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("denies access when a listed resource carries no organisation reference", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue([
        { id: "mapping-1", mapping: { organizationReference: 42 } },
      ]);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "Practitioner/user-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).not.toHaveBeenCalled();
    });

    it("denies access when a single resource carries no organisation reference", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        mapping: { organizationReference: null },
      });

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You do not have access to this organisation.",
      });
    });

    it("rejects a mapping that belongs to another tenant even though the caller is a member somewhere", async () => {
      // The caller legitimately belongs to org-1, but the mapping being read
      // lives in org-2 — membership somewhere must never authorise everywhere.
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-9",
        organizationReference: "Organization/org-2",
      });

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-9" } }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-2");
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("accepts a flat organizationReference on the payload when no nested organization is sent", async () => {
      (UserOrganizationService.upsert as jest.Mock).mockResolvedValue({
        response: { id: "mapping-1" },
        created: false,
      });

      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: {
            resourceType: "PractitionerRole",
            organizationReference: "Organization/org-1",
          },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ id: "mapping-1" });
    });

    it("falls back to the flat reference when the nested organization reference is blank", async () => {
      (UserOrganizationService.upsert as jest.Mock).mockResolvedValue({
        response: { id: "mapping-1" },
        created: false,
      });

      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: {
            resourceType: "PractitionerRole",
            organization: { reference: "   " },
            organizationReference: "org-1",
          },
        }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("rejects an upsert whose organisation reference is not a string", async () => {
      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: {
            resourceType: "PractitionerRole",
            organization: { reference: 7 },
            organizationReference: 7,
          },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.upsert).not.toHaveBeenCalled();
    });

    it("rejects an upsert that addresses a tenant the caller does not belong to", async () => {
      await UserOrganizationController.upsertMapping(
        createMockReq({
          body: {
            resourceType: "PractitionerRole",
            organization: { reference: "Organization/org-2" },
          },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.upsert).not.toHaveBeenCalled();
    });
  });

  describe("upsertMapping error handling", () => {
    beforeEach(() => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockResolvedValue({ id: "mapping-1" });
    });

    const body = {
      resourceType: "PractitionerRole",
      organization: { reference: "Organization/org-1" },
    };

    it("propagates the status code of a service error", async () => {
      (UserOrganizationService.upsert as jest.Mock).mockRejectedValue(
        new UserOrganizationServiceError(
          "Free plan member limit reached.",
          403,
        ),
      );

      await UserOrganizationController.upsertMapping(
        createMockReq({ body }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Free plan member limit reached.",
      });
    });

    it("returns 500 and logs an unexpected failure", async () => {
      const failure = new Error("boom");
      (UserOrganizationService.upsert as jest.Mock).mockRejectedValue(failure);

      await UserOrganizationController.upsertMapping(
        createMockReq({ body }),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to persist user-organization mapping",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to persist user-organization mapping.",
      });
    });
  });

  describe("getMappingById edge cases", () => {
    beforeEach(() => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
    });

    it("returns 400 when no mapping id is supplied", async () => {
      await UserOrganizationController.getMappingById(
        createMockReq({ params: {} }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping ID is required.",
      });
      expect(UserOrganizationService.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when the mapping does not exist", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue(null);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping not found.",
      });
    });

    it("returns 404 when the reference lookup resolves to an empty list", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue([]);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "Practitioner/user-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("propagates the status code of a service error", async () => {
      (UserOrganizationService.getById as jest.Mock).mockRejectedValue(
        new UserOrganizationServiceError("Identifier is required.", 400),
      );

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Identifier is required.",
      });
    });

    it("returns 500 and logs an unexpected failure", async () => {
      const failure = new Error("db down");
      (UserOrganizationService.getById as jest.Mock).mockRejectedValue(failure);

      await UserOrganizationController.getMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to retrieve user-organization mapping",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to retrieve user-organization mapping.",
      });
    });
  });

  describe("listMappings failures", () => {
    it("returns 500 and logs when the listing fails", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      const failure = new Error("db down");
      (UserOrganizationService.listByUserId as jest.Mock).mockRejectedValue(
        failure,
      );

      await UserOrganizationController.listMappings(
        createMockReq(),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to list user-organization mappings",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to list user-organization mappings.",
      });
    });
  });

  describe("deleteMappingById", () => {
    beforeEach(() => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
    });

    it("returns 400 when no mapping id is supplied", async () => {
      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: {} }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping ID is required.",
      });
      expect(UserOrganizationService.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when the mapping does not exist", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue([]);

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(UserOrganizationService.deleteById).not.toHaveBeenCalled();
    });

    it("refuses to delete another tenant's mapping", async () => {
      // Caller is a member of org-1 only; the mapping addressed lives in org-2.
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-9",
        organizationReference: "Organization/org-2",
      });
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockImplementation(async (_userId: string, organisationId: string) =>
        organisationId === "org-1" ? { id: "mapping-1" } : null,
      );

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: "mapping-9" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You do not have access to this organisation.",
      });
      expect(UserOrganizationService.deleteById).not.toHaveBeenCalled();
    });

    it("returns 404 when the mapping vanishes between the read and the delete", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        organizationReference: "Organization/org-1",
      });
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockResolvedValue({ id: "mapping-1" });
      (UserOrganizationService.deleteById as jest.Mock).mockResolvedValue(
        false,
      );

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping not found.",
      });
    });

    it("deletes a mapping the caller may administer", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        organizationReference: "Organization/org-1",
      });
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockResolvedValue({ id: "mapping-1" });
      (UserOrganizationService.deleteById as jest.Mock).mockResolvedValue(true);

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(UserOrganizationService.deleteById).toHaveBeenCalledWith(
        "mapping-1",
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping deleted successfully.",
      });
    });

    it("propagates the status code of a service error", async () => {
      (UserOrganizationService.getById as jest.Mock).mockRejectedValue(
        new UserOrganizationServiceError("Identifier is required.", 400),
      );

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: " " } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Identifier is required.",
      });
    });

    it("returns 500 and logs an unexpected failure", async () => {
      const failure = new Error("db down");
      (UserOrganizationService.getById as jest.Mock).mockRejectedValue(failure);

      await UserOrganizationController.deleteMappingById(
        createMockReq({ params: { id: "mapping-1" } }),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to delete user-organization mapping",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to delete user-organization mapping.",
      });
    });
  });

  describe("updateMappingById", () => {
    const body = {
      resourceType: "PractitionerRole",
      organization: { reference: "Organization/org-1" },
    };

    beforeEach(() => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockImplementation(async (_userId: string, organisationId: string) =>
        organisationId === "org-1" ? { id: "mapping-1" } : null,
      );
    });

    it("returns 400 when no mapping id is supplied", async () => {
      await UserOrganizationController.updateMappingById(
        createMockReq({ params: {}, body }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping ID is required.",
      });
      expect(UserOrganizationService.update).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-PractitionerRole payload", async () => {
      await UserOrganizationController.updateMappingById(
        createMockReq({ params: { id: "mapping-1" }, body: {} }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR PractitionerRole resource.",
      });
    });

    it("returns 403 when the payload names no organisation", async () => {
      await UserOrganizationController.updateMappingById(
        createMockReq({
          params: { id: "mapping-1" },
          body: { resourceType: "PractitionerRole" },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.update).not.toHaveBeenCalled();
    });

    it("refuses an update aimed at another tenant", async () => {
      await UserOrganizationController.updateMappingById(
        createMockReq({
          params: { id: "mapping-1" },
          body: {
            resourceType: "PractitionerRole",
            organization: { reference: "Organization/org-2" },
          },
        }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You do not have access to this organisation.",
      });
      expect(UserOrganizationService.update).not.toHaveBeenCalled();
    });

    it("returns 404 when the mapping does not exist", async () => {
      (UserOrganizationService.update as jest.Mock).mockResolvedValue(null);

      await UserOrganizationController.updateMappingById(
        createMockReq({ params: { id: "mapping-1" }, body }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mapping not found.",
      });
    });

    it("returns the updated mapping", async () => {
      (UserOrganizationService.update as jest.Mock).mockResolvedValue({
        id: "mapping-1",
        roleCode: "OWNER",
      });

      await UserOrganizationController.updateMappingById(
        createMockReq({ params: { id: "mapping-1" }, body }),
        mockRes as Response,
      );

      expect(UserOrganizationService.update).toHaveBeenCalledWith(
        "mapping-1",
        body,
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        id: "mapping-1",
        roleCode: "OWNER",
      });
    });

    it("propagates the status code of a service error", async () => {
      (UserOrganizationService.update as jest.Mock).mockRejectedValue(
        new UserOrganizationServiceError('Invalid roleCode "GHOST".', 400),
      );

      await UserOrganizationController.updateMappingById(
        createMockReq({ params: { id: "mapping-1" }, body }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid roleCode "GHOST".',
      });
    });

    it("returns 500 and logs an unexpected failure", async () => {
      const failure = new Error("db down");
      (UserOrganizationService.update as jest.Mock).mockRejectedValue(failure);

      await UserOrganizationController.updateMappingById(
        createMockReq({ params: { id: "mapping-1" }, body }),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update user-organization mapping",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to update user-organization mapping.",
      });
    });
  });

  describe("listMappingsForUser", () => {
    it("returns 401 when the session carries no user id", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.listMappingsForUser(
        createMockReq(),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unauthorized: missing user id.",
      });
      expect(UserOrganizationService.listByUserId).not.toHaveBeenCalled();
    });

    it("lists the mappings of the session user, never a client-named user", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        { mapping: { id: "mapping-1" } },
      ]);

      await UserOrganizationController.listMappingsForUser(
        createMockReq({ params: { userId: "someone-else" } }),
        mockRes as Response,
      );

      expect(UserOrganizationService.listByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([
        { mapping: { id: "mapping-1" } },
      ]);
    });

    it("propagates the status code of a service error", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (UserOrganizationService.listByUserId as jest.Mock).mockRejectedValue(
        new UserOrganizationServiceError("User Id is required.", 400),
      );

      await UserOrganizationController.listMappingsForUser(
        createMockReq(),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User Id is required.",
      });
    });

    it("returns 500 and logs an unexpected failure", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      const failure = new Error("db down");
      (UserOrganizationService.listByUserId as jest.Mock).mockRejectedValue(
        failure,
      );

      await UserOrganizationController.listMappingsForUser(
        createMockReq(),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to list current user's organization mappings",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to list current user's organization mappings.",
      });
    });
  });

  describe("listByOrganisationId", () => {
    beforeEach(() => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue("user-1");
      (
        UserOrganizationService.getMappingByUserAndOrganization as jest.Mock
      ).mockImplementation(async (_userId: string, organisationId: string) =>
        organisationId === "org-1" ? { id: "mapping-1" } : null,
      );
    });

    it("returns 401 when the session carries no user id", async () => {
      (resolveUserIdFromRequest as jest.Mock).mockReturnValue(undefined);

      await UserOrganizationController.listByOrganisationId(
        createMockReq({ params: { organisationId: "org-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(
        UserOrganizationService.listByOrganisationId,
      ).not.toHaveBeenCalled();
    });

    it("returns 400 when the route carries no organisation id", async () => {
      await UserOrganizationController.listByOrganisationId(
        createMockReq({ params: {} }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Organisation Id is required and type should be string.",
      });
      expect(
        UserOrganizationService.listByOrganisationId,
      ).not.toHaveBeenCalled();
    });

    it("refuses to list the roster of a tenant the caller does not belong to", async () => {
      await UserOrganizationController.listByOrganisationId(
        createMockReq({ params: { organisationId: "org-2" } }),
        mockRes as Response,
      );

      expect(
        UserOrganizationService.getMappingByUserAndOrganization,
      ).toHaveBeenCalledWith("user-1", "org-2");
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "You do not have access to this organisation.",
      });
      expect(
        UserOrganizationService.listByOrganisationId,
      ).not.toHaveBeenCalled();
    });

    it("returns the roster for an organisation the caller belongs to", async () => {
      (
        UserOrganizationService.listByOrganisationId as jest.Mock
      ).mockResolvedValue([{ name: "Jane Doe" }]);

      await UserOrganizationController.listByOrganisationId(
        createMockReq({ params: { organisationId: "org-1" } }),
        mockRes as Response,
      );

      expect(UserOrganizationService.listByOrganisationId).toHaveBeenCalledWith(
        "org-1",
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([{ name: "Jane Doe" }]);
    });

    it("propagates the status code of a service error", async () => {
      (
        UserOrganizationService.listByOrganisationId as jest.Mock
      ).mockRejectedValue(
        new UserOrganizationServiceError("User Id is required.", 400),
      );

      await UserOrganizationController.listByOrganisationId(
        createMockReq({ params: { organisationId: "org-1" } }),
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User Id is required.",
      });
    });

    it("returns 500 and logs an unexpected failure", async () => {
      const failure = new Error("db down");
      (
        UserOrganizationService.listByOrganisationId as jest.Mock
      ).mockRejectedValue(failure);

      await UserOrganizationController.listByOrganisationId(
        createMockReq({ params: { organisationId: "org-1" } }),
        mockRes as Response,
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to list current organization's mappings",
        failure,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to list current user's organization mappings.",
      });
    });
  });
});
