import { CompanionOrganisationController } from "../../src/controllers/app/companion-organisation.controller";
import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../src/services/companion-organisation.service";
import { ParentService } from "src/services/parent.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import OrganizationModel from "src/models/organization";
import logger from "../../src/utils/logger";

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---

jest.mock("../../src/services/companion-organisation.service", () => {
  class MockCompanionOrganisationServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "CompanionOrganisationServiceError";
    }
  }

  return {
    __esModule: true,
    CompanionOrganisationServiceError: MockCompanionOrganisationServiceError,
    CompanionOrganisationService: {
      linkByParent: jest.fn(),
      linkByPmsUser: jest.fn(),
      parentApproveLink: jest.fn(),
      sendInvite: jest.fn(),
      parentRejectLink: jest.fn(),
      acceptInvite: jest.fn(),
      rejectInvite: jest.fn(),
      revokeLink: jest.fn(),
      getLinksForCompanion: jest.fn(),
      getLinksForOrganisation: jest.fn(),
      getLinksForCompanionByOrganisationTye: jest.fn(), // Typo matching the controller code
    },
  };
});

jest.mock("src/services/parent.service", () => ({
  __esModule: true,
  ParentService: {
    findByLinkedUserId: jest.fn(),
  },
}));

jest.mock("src/services/authUserMobile.service", () => ({
  __esModule: true,
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("CompanionOrganisationController", () => {
  let req: any;
  let res: any;
  const validObjectId = "507f1f77bcf86cd799439011";

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
    };
  });

  describe("resolveUserIdFromRequest & Payload Parsers (Implicitly Tested)", () => {
    it("should use x-user-id if available", async () => {
      req.headers["x-user-id"] = "header_id";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      req.body = {
        companionId: "c1",
        organisationId: "o1",
        organisationType: "HOSPITAL",
      };

      await CompanionOrganisationController.linkByParent(req, res);
      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "header_id",
      );
    });

    it("should fall back to authReq.userId if headers missing or not string", async () => {
      req.headers = undefined; // Force branch coverage for `req.headers?.`
      req.userId = "auth_id";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      req.body = {
        companionId: "c1",
        organisationId: "o1",
        organisationType: "HOSPITAL",
      };

      await CompanionOrganisationController.linkByParent(req, res);
      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "auth_id",
      );
    });

    it("should handle falsy authReq.userId properly (hits final return)", async () => {
      req.headers = {};
      req.userId = undefined;
      await CompanionOrganisationController.linkByParent(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("parseLinkPayload: should reject null body", async () => {
      req.body = null;
      req.userId = "u1";
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      await CompanionOrganisationController.linkByParent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("linkByParent", () => {
    it("should return 401 if parent not found", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue(null);
      await CompanionOrganisationController.linkByParent(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Parent not found" });
    });

    it("should return 400 if link payload is invalid", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      req.body = {
        companionId: "c1",
        organisationId: "o1",
        organisationType: "INVALID_TYPE",
      };

      await CompanionOrganisationController.linkByParent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should successfully link by parent", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      req.body = {
        companionId: "c1",
        organisationId: "o1",
        organisationType: "HOSPITAL",
      };
      (
        CompanionOrganisationService.linkByParent as jest.Mock
      ).mockResolvedValue("link_data");

      await CompanionOrganisationController.linkByParent(req, res);
      expect(CompanionOrganisationService.linkByParent).toHaveBeenCalledWith({
        parentId: "pid",
        ...req.body,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith("link_data");
    });

    it("should handle custom CompanionOrganisationServiceError", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      req.body = {
        companionId: "c1",
        organisationId: "o1",
        organisationType: "HOSPITAL",
      };
      (
        CompanionOrganisationService.linkByParent as jest.Mock
      ).mockRejectedValue(
        new CompanionOrganisationServiceError("Custom Error", 409),
      );

      await CompanionOrganisationController.linkByParent(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: "Custom Error" });
    });

    it("should handle generic errors", async () => {
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({ parentId: "pid" });
      req.body = {
        companionId: "c1",
        organisationId: "o1",
        organisationType: "HOSPITAL",
      };
      (
        CompanionOrganisationService.linkByParent as jest.Mock
      ).mockRejectedValue(new Error("DB Error"));

      await CompanionOrganisationController.linkByParent(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("linkByPmsUser", () => {
    it("should return 401 if user not authenticated", async () => {
      req.userId = null;
      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if params are missing", async () => {
      req.params = { companionId: "c1" }; // missing orgId
      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 if org not found or invalid type", async () => {
      req.params = { companionId: "c1", organisationId: "o1" };
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);
      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      // Invalid type
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({
        type: "INVALID",
      });
      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should successfully link by PMS user", async () => {
      req.params = { companionId: "c1", organisationId: "o1" };
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({
        type: "BREEDER",
      });
      (
        CompanionOrganisationService.linkByPmsUser as jest.Mock
      ).mockResolvedValue("link_data");

      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(CompanionOrganisationService.linkByPmsUser).toHaveBeenCalledWith({
        pmsUserId: "auth_user_123",
        companionId: "c1",
        organisationId: "o1",
        organisationType: "BREEDER",
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should handle errors", async () => {
      req.params = { companionId: "c1", organisationId: "o1" };
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({
        type: "BREEDER",
      });

      // Generic
      (
        CompanionOrganisationService.linkByPmsUser as jest.Mock
      ).mockRejectedValue(new Error("Test error"));
      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      // Custom
      (
        CompanionOrganisationService.linkByPmsUser as jest.Mock
      ).mockRejectedValue(new CompanionOrganisationServiceError("Custom", 400));
      await CompanionOrganisationController.linkByPmsUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("approvePendingLink", () => {
    it("should return 401 if unauthenticated", async () => {
      req.userId = null;
      await CompanionOrganisationController.approvePendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 if parent not found", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);
      await CompanionOrganisationController.approvePendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should approve link on success", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });
      req.params.linkId = "link_1";
      (
        CompanionOrganisationService.parentApproveLink as jest.Mock
      ).mockResolvedValue("approved_data");

      await CompanionOrganisationController.approvePendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("approved_data");
    });

    it("should handle errors", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });

      (
        CompanionOrganisationService.parentApproveLink as jest.Mock
      ).mockRejectedValue(new Error("err"));
      await CompanionOrganisationController.approvePendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (
        CompanionOrganisationService.parentApproveLink as jest.Mock
      ).mockRejectedValue(new CompanionOrganisationServiceError("err", 403));
      await CompanionOrganisationController.approvePendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("sendInvite", () => {
    it("should return 401 if unauthenticated or parent missing", async () => {
      req.userId = null;
      await CompanionOrganisationController.sendInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(401);

      req.userId = "u1";
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);
      await CompanionOrganisationController.sendInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if invite payload is invalid (tests parseInvitePayload branches)", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });

      // Missing all optional fields
      req.body = { companionId: "c1", organisationType: "HOSPITAL" };
      await CompanionOrganisationController.sendInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      // Not an object
      req.body = "string";
      await CompanionOrganisationController.sendInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should succeed when email is provided", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });
      req.body = {
        companionId: "c1",
        organisationType: "HOSPITAL",
        email: " test@test.com ",
      };
      await CompanionOrganisationController.sendInvite(req, res);
      expect(CompanionOrganisationService.sendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@test.com" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should succeed when name is provided", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });
      req.body = {
        companionId: "c1",
        organisationType: "HOSPITAL",
        name: " OrgName ",
      };
      await CompanionOrganisationController.sendInvite(req, res);
      expect(CompanionOrganisationService.sendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ name: "OrgName" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should succeed when placesId is provided", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });
      req.body = {
        companionId: "c1",
        organisationType: "HOSPITAL",
        placesId: " place123 ",
      };
      await CompanionOrganisationController.sendInvite(req, res);
      expect(CompanionOrganisationService.sendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ placesId: "place123" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should handle errors", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });
      req.body = {
        companionId: "c1",
        organisationType: "HOSPITAL",
        email: "e",
      };

      (CompanionOrganisationService.sendInvite as jest.Mock).mockRejectedValue(
        new Error("err"),
      );
      await CompanionOrganisationController.sendInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (CompanionOrganisationService.sendInvite as jest.Mock).mockRejectedValue(
        new CompanionOrganisationServiceError("err", 400),
      );
      await CompanionOrganisationController.sendInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("denyPendingLink", () => {
    it("should return 401 if unauthenticated or parent missing", async () => {
      req.userId = null;
      await CompanionOrganisationController.denyPendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(401);

      req.userId = "u1";
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);
      await CompanionOrganisationController.denyPendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should deny link on success", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });
      req.params.linkId = "link_1";
      (
        CompanionOrganisationService.parentRejectLink as jest.Mock
      ).mockResolvedValue("denied_data");

      await CompanionOrganisationController.denyPendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validObjectId,
      });

      (
        CompanionOrganisationService.parentRejectLink as jest.Mock
      ).mockRejectedValue(new Error("err"));
      await CompanionOrganisationController.denyPendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (
        CompanionOrganisationService.parentRejectLink as jest.Mock
      ).mockRejectedValue(new CompanionOrganisationServiceError("err", 404));
      await CompanionOrganisationController.denyPendingLink(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("acceptInvite & rejectInvite (testing parseInviteResolutionPayload)", () => {
    it("should return 400 for invalid payloads on accept/reject", async () => {
      req.body = { token: "t" }; // missing org
      await CompanionOrganisationController.acceptInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.body = "not-object";
      await CompanionOrganisationController.rejectInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should accept invite on success", async () => {
      req.body = { token: "t1", organisationId: "o1" };
      (
        CompanionOrganisationService.acceptInvite as jest.Mock
      ).mockResolvedValue("acc_data");
      await CompanionOrganisationController.acceptInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors in acceptInvite", async () => {
      req.body = { token: "t1", organisationId: "o1" };
      (
        CompanionOrganisationService.acceptInvite as jest.Mock
      ).mockRejectedValue(new Error("Test error"));
      await CompanionOrganisationController.acceptInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (
        CompanionOrganisationService.acceptInvite as jest.Mock
      ).mockRejectedValue(new CompanionOrganisationServiceError("e", 400));
      await CompanionOrganisationController.acceptInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reject invite on success", async () => {
      req.body = { token: "t1", organisationId: "o1" };
      await CompanionOrganisationController.rejectInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors in rejectInvite", async () => {
      req.body = { token: "t1", organisationId: "o1" };
      (
        CompanionOrganisationService.rejectInvite as jest.Mock
      ).mockRejectedValue(new Error("Test error"));
      await CompanionOrganisationController.rejectInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (
        CompanionOrganisationService.rejectInvite as jest.Mock
      ).mockRejectedValue(new CompanionOrganisationServiceError("e", 400));
      await CompanionOrganisationController.rejectInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("revokeLink", () => {
    it("should revoke link on success", async () => {
      req.params.linkId = "l1";
      (CompanionOrganisationService.revokeLink as jest.Mock).mockResolvedValue(
        "revoked",
      );
      await CompanionOrganisationController.revokeLink(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("revoked");
    });

    it("should handle errors", async () => {
      (CompanionOrganisationService.revokeLink as jest.Mock).mockRejectedValue(
        new Error("Test error"),
      );
      await CompanionOrganisationController.revokeLink(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      (CompanionOrganisationService.revokeLink as jest.Mock).mockRejectedValue(
        new CompanionOrganisationServiceError("Test error", 403),
      );
      await CompanionOrganisationController.revokeLink(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("getLinksForCompanion", () => {
    it("should fetch links successfully", async () => {
      req.params.companionId = "c1";
      (
        CompanionOrganisationService.getLinksForCompanion as jest.Mock
      ).mockResolvedValue([]);
      await CompanionOrganisationController.getLinksForCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      (
        CompanionOrganisationService.getLinksForCompanion as jest.Mock
      ).mockRejectedValue(new Error("Test error"));
      await CompanionOrganisationController.getLinksForCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getLinksForOrganisation", () => {
    it("should fetch links successfully", async () => {
      req.params.organisationId = "o1";
      (
        CompanionOrganisationService.getLinksForOrganisation as jest.Mock
      ).mockResolvedValue([]);
      await CompanionOrganisationController.getLinksForOrganisation(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle errors", async () => {
      (
        CompanionOrganisationService.getLinksForOrganisation as jest.Mock
      ).mockRejectedValue(new Error("Test error"));
      await CompanionOrganisationController.getLinksForOrganisation(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getLinksForCompanionByOrganisationType", () => {
    it("should return 400 if companionId missing", async () => {
      req.query.type = "HOSPITAL";
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 if type is invalid", async () => {
      req.params.companionId = "c1";
      req.query.type = "INVALID";
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should fetch links successfully", async () => {
      req.params.companionId = "c1";
      req.query.type = "HOSPITAL";
      (
        CompanionOrganisationService.getLinksForCompanionByOrganisationTye as jest.Mock
      ).mockResolvedValue([]);

      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(
        CompanionOrganisationService.getLinksForCompanionByOrganisationTye,
      ).toHaveBeenCalledWith("c1", "HOSPITAL");
    });

    it("should handle errors", async () => {
      req.params.companionId = "c1";
      req.query.type = "HOSPITAL";

      (
        CompanionOrganisationService.getLinksForCompanionByOrganisationTye as jest.Mock
      ).mockRejectedValue(new Error("Test error"));
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);

      (
        CompanionOrganisationService.getLinksForCompanionByOrganisationTye as jest.Mock
      ).mockRejectedValue(new CompanionOrganisationServiceError("err", 404));
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
