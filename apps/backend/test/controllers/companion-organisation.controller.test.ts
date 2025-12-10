import { Types } from "mongoose";
import { CompanionOrganisationController } from "../../src/controllers/app/companion-organisation.controller";
import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../src/services/companion-organisation.service";
import { ParentService } from "../../src/services/parent.service";
import OrganizationModel from "../../src/models/organization";

jest.mock("../../src/services/parent.service", () => ({
  ParentService: {
    findByLinkedUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/companion-organisation.service", () => {
  const actual = jest.requireActual(
    "../../src/services/companion-organisation.service",
  );
  return {
    ...actual,
    CompanionOrganisationService: {
      linkByParent: jest.fn(),
      linkByPmsUser: jest.fn(),
      sendInvite: jest.fn(),
      acceptInvite: jest.fn(),
      rejectInvite: jest.fn(),
      parentRejectLink: jest.fn(),
      parentApproveLink: jest.fn(),
      revokeLink: jest.fn(),
      getLinksForCompanion: jest.fn(),
      getLinksForOrganisation: jest.fn(),
      getLinksForCompanionByOrganisationTye: jest.fn(),
    },
  };
});

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

const mockedParentService = ParentService as unknown as {
  findByLinkedUserId: jest.Mock;
};

const mockedCompanionOrganisationService =
  CompanionOrganisationService as unknown as Record<string, jest.Mock>;

const mockedOrganizationModel = OrganizationModel as unknown as {
  findById: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("CompanionOrganisationController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("linkByParent", () => {
    it("returns 400 when payload is missing", async () => {
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
      });
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {},
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.linkByParent(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "companionId, organisationId and organisationType are required.",
      });
      expect(
        mockedCompanionOrganisationService.linkByParent,
      ).not.toHaveBeenCalled();
    });

    it("returns 401 when parent is not found", async () => {
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce(null);
      const req = {
        headers: { "x-user-id": "user-2" },
        body: {
          companionId: "cmp-1",
          organisationId: "org-1",
          organisationType: "HOSPITAL",
        },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.linkByParent(req, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Parent not found" });
    });

    it("links organisation when parent exists and payload is valid", async () => {
      const parentId = new Types.ObjectId();
      const link = { id: "link-1" };
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: parentId,
      });
      mockedCompanionOrganisationService.linkByParent.mockResolvedValueOnce(
        link,
      );
      const req = {
        headers: { "x-user-id": "user-3" },
        body: {
          companionId: "cmp-2",
          organisationId: "org-2",
          organisationType: "GROOMER",
        },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.linkByParent(req, res as any);

      expect(
        mockedCompanionOrganisationService.linkByParent,
      ).toHaveBeenCalledWith({
        parentId,
        companionId: "cmp-2",
        organisationId: "org-2",
        organisationType: "GROOMER",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(link);
    });
  });

  describe("linkByPmsUser", () => {
    it("validates required params", async () => {
      const req = {
        headers: { "x-user-id": "user-4" },
        params: {},
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.linkByPmsUser(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "CompanionId and OrganisationId is required.",
      });
    });

    it("returns 404 when organisation is missing", async () => {
      mockedOrganizationModel.findById.mockResolvedValueOnce(null);
      const req = {
        headers: { "x-user-id": "user-5" },
        params: { companionId: "cmp-3", organisationId: "org-3" },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.linkByPmsUser(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation not found or invalid.",
      });
    });

    it("creates link when inputs are valid", async () => {
      mockedOrganizationModel.findById.mockResolvedValueOnce({
        type: "BREEDER",
      });
      mockedCompanionOrganisationService.linkByPmsUser.mockResolvedValueOnce({
        id: "link-2",
      });
      const req = {
        headers: { "x-user-id": "user-6" },
        params: { companionId: "cmp-4", organisationId: "org-4" },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.linkByPmsUser(req, res as any);

      expect(
        mockedCompanionOrganisationService.linkByPmsUser,
      ).toHaveBeenCalledWith({
        pmsUserId: "user-6",
        companionId: "cmp-4",
        organisationId: "org-4",
        organisationType: "BREEDER",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "link-2" });
    });
  });

  describe("sendInvite", () => {
    it("validates invite payload", async () => {
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
      });
      const req = {
        headers: { "x-user-id": "user-7" },
        body: {},
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.sendInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "companionId, email and organisationType are required to send an invite.",
      });
      expect(
        mockedCompanionOrganisationService.sendInvite,
      ).not.toHaveBeenCalled();
    });

    it("returns 401 when parent is not found", async () => {
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce(null);
      const req = {
        headers: { "x-user-id": "user-8" },
        body: {
          companionId: "cmp-5",
          email: "person@example.com",
          organisationType: "HOSPITAL",
        },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.sendInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Parent not found" });
    });

    it("sends invite when valid data is provided", async () => {
      const parentId = new Types.ObjectId();
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: parentId,
      });
      const req = {
        headers: { "x-user-id": "user-9" },
        body: {
          companionId: "cmp-6",
          email: "hello@example.com",
          organisationType: "BOARDER",
        },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.sendInvite(req, res as any);

      expect(
        mockedCompanionOrganisationService.sendInvite,
      ).toHaveBeenCalledWith({
        parentId,
        companionId: "cmp-6",
        email: "hello@example.com",
        organisationType: "BOARDER",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invite sent successfully",
      });
    });
  });

  describe("acceptInvite / rejectInvite", () => {
    it("validates acceptInvite payload", async () => {
      const req = { body: {} } as any;
      const res = createResponse();

      await CompanionOrganisationController.acceptInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "token and organisationId are required to accept invite.",
      });
    });

    it("maps CompanionOrganisationServiceError for acceptInvite", async () => {
      mockedCompanionOrganisationService.acceptInvite.mockRejectedValueOnce(
        new CompanionOrganisationServiceError("bad", 422),
      );
      const req = {
        body: { token: "t1", organisationId: "org-6" },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.acceptInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "bad" });
    });

    it("rejects invite when payload is valid", async () => {
      mockedCompanionOrganisationService.rejectInvite.mockResolvedValueOnce(
        undefined,
      );
      const req = {
        body: { token: "t2", organisationId: "org-7" },
      } as any;
      const res = createResponse();

      await CompanionOrganisationController.rejectInvite(req, res as any);

      expect(
        mockedCompanionOrganisationService.rejectInvite,
      ).toHaveBeenCalledWith({
        token: "t2",
        organisationId: "org-7",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invite rejected successfully.",
      });
    });
  });
});
