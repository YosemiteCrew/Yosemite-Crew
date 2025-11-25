import { Types } from "mongoose";
import CompanionOrganisationModel from "../../src/models/companion-organisation";
import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../src/services/companion-organisation.service";

jest.mock("../../src/models/companion-organisation", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
  },
}));

type MockedCompanionOrganisationModel = {
  findOne: jest.Mock;
  create: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  find: jest.Mock;
};

const mockedModel =
  CompanionOrganisationModel as unknown as MockedCompanionOrganisationModel;

describe("CompanionOrganisationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("linkByParent", () => {
    it("returns existing link when found", async () => {
      const existing = { id: "existing" };
      mockedModel.findOne.mockResolvedValueOnce(existing);

      const result = await CompanionOrganisationService.linkByParent({
        parentId: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        organisationId: new Types.ObjectId(),
        organisationType: "HOSPITAL",
      });

      expect(result).toBe(existing);
      expect(mockedModel.create).not.toHaveBeenCalled();
    });

    it("throws when ids are invalid", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "bad-id",
          companionId: "cmp-1",
          organisationId: "org-1",
          organisationType: "BREEDER",
        }),
      ).rejects.toThrow(CompanionOrganisationServiceError);
    });
  });

  describe("linkByPmsUser", () => {
    it("creates link when no existing link is present", async () => {
      mockedModel.findOne.mockResolvedValueOnce(null);
      const created = { id: "new-link" };
      mockedModel.create.mockResolvedValueOnce(created);

      const result = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "user-1",
        companionId: new Types.ObjectId(),
        organisationId: new Types.ObjectId(),
        organisationType: "GROOMER",
      });

      expect(result).toBe(created);
      expect(mockedModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedByPmsUserId: "user-1",
          organisationType: "GROOMER",
          status: "ACTIVE",
        }),
      );
    });
  });

  describe("sendInvite", () => {
    it("creates a pending invite with token", async () => {
      const created = { id: "invite-1" };
      mockedModel.create.mockResolvedValueOnce(created);

      const result = await CompanionOrganisationService.sendInvite({
        parentId: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        organisationType: "BOARDER",
        email: "test@example.com",
      });

      expect(result).toBe(created);
      expect(mockedModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invitedViaEmail: "test@example.com",
          inviteToken: expect.any(String),
          organisationId: null,
          organisationType: "BOARDER",
          status: "PENDING",
        }),
      );
    });

    it("throws when email is missing", async () => {
      await expect(
        CompanionOrganisationService.sendInvite({
          parentId: new Types.ObjectId(),
          companionId: new Types.ObjectId(),
          organisationType: "BOARDER",
          email: "",
        }),
      ).rejects.toThrow(CompanionOrganisationServiceError);
    });
  });

  describe("acceptInvite", () => {
    it("throws when invite token is invalid", async () => {
      mockedModel.findOne.mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.acceptInvite({
          token: "missing",
          organisationId: new Types.ObjectId(),
        }),
      ).rejects.toThrow("Invalid invite token");
    });

    it("activates invite when found", async () => {
      const save = jest.fn();
      const invite: any = { save, inviteToken: "t-1", status: "PENDING" };
      mockedModel.findOne.mockResolvedValueOnce(invite);
      const organisationId = new Types.ObjectId();

      const result = await CompanionOrganisationService.acceptInvite({
        token: "t-1",
        organisationId,
      });

      expect(invite.organisationId).toEqual(organisationId);
      expect(invite.status).toBe("ACTIVE");
      expect(invite.inviteToken).toBeNull();
      expect(invite.acceptedAt).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalledTimes(1);
      expect(result).toBe(invite);
    });
  });

  describe("parentApproveLink", () => {
    it("throws when pending link does not exist", async () => {
      mockedModel.findOne.mockResolvedValueOnce(null);
      const linkId = new Types.ObjectId().toHexString();

      await expect(
        CompanionOrganisationService.parentApproveLink(
          new Types.ObjectId(),
          linkId,
        ),
      ).rejects.toThrow("Pending link not found.");
    });

    it("activates pending link", async () => {
      const save = jest.fn();
      const link: any = { status: "PENDING", save };
      mockedModel.findOne.mockResolvedValueOnce(link);
      const parentId = new Types.ObjectId();
      const linkId = new Types.ObjectId().toHexString();

      const result = await CompanionOrganisationService.parentApproveLink(
        parentId,
        linkId,
      );

      expect(link.status).toBe("ACTIVE");
      expect(link.linkedByParentId).toEqual(parentId);
      expect(link.acceptedAt).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalledTimes(1);
      expect(result).toBe(link);
    });
  });

  describe("getLinksForCompanion", () => {
    it("returns links for companion", async () => {
      const links = [{ id: "l1" }];
      mockedModel.find.mockResolvedValueOnce(links);
      const companionId = new Types.ObjectId().toHexString();

      const result =
        await CompanionOrganisationService.getLinksForCompanion(companionId);

      expect(result).toBe(links);
      expect(mockedModel.find).toHaveBeenCalledWith({
        companionId: expect.any(Types.ObjectId),
      });
    });
  });
});
