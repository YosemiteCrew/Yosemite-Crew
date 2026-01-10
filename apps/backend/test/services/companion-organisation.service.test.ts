import { Types } from "mongoose";
import { CompanionOrganisationService } from "../../src/services/companion-organisation.service";
import CompanionOrganisationModel from "../../src/models/companion-organisation";
import ParentCompanionModel from "../../src/models/parent-companion";
import CompanionModel from "../../src/models/companion";
import { ParentModel } from "../../src/models/parent";
import { toFHIR as toFHIRCompanion } from "../../src/services/companion.service";
import { toFHIR as toFHIRParent } from "../../src/services/parent.service";

// --- Mocks ---
jest.mock("../../src/models/companion-organisation");
jest.mock("../../src/models/parent-companion");
jest.mock("../../src/models/companion");
jest.mock("../../src/models/parent");
jest.mock("../../src/services/companion.service");
jest.mock("../../src/services/parent.service");

describe("CompanionOrganisationService", () => {
  const validObjectId = new Types.ObjectId().toString();
  const validParentId = new Types.ObjectId();
  const validCompanionId = new Types.ObjectId();
  const validOrgId = new Types.ObjectId();

  // Helper to mock mongoose document with save()
  const createMockDoc = (data: any) => ({
    ...data,
    save: jest.fn().mockResolvedValue(true),
    _id: new Types.ObjectId(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Validation (ensureObjectId)", () => {
    it("should throw if ID is invalid string", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "invalid",
          companionId: validCompanionId,
          organisationId: validOrgId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow("Invalid parentId");
    });

    it("should throw if ID contains injection chars ($)", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "$invalid",
          companionId: validCompanionId,
          organisationId: validOrgId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow("Invalid parentId");
    });

    it("should throw if ID is not a string or ObjectId", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: 123 as unknown as Types.ObjectId,
          companionId: validCompanionId,
          organisationId: validOrgId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow("Invalid parentId");
    });
  });

  describe("linkByParent", () => {
    it("should return existing active link if found", async () => {
      const existing = { _id: "1", status: "ACTIVE" };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        existing,
      );

      const result = await CompanionOrganisationService.linkByParent({
        parentId: validParentId,
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
      });

      expect(result).toEqual(existing);
      expect(CompanionOrganisationModel.create).not.toHaveBeenCalled();
    });

    it("should create new link if not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({
        _id: "new",
      });

      const result = await CompanionOrganisationService.linkByParent({
        parentId: validParentId,
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
      });

      expect(CompanionOrganisationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ACTIVE",
          role: "ORGANISATION",
        }),
      );
      expect(result).toEqual({ _id: "new" });
    });
  });

  describe("linkByPmsUser", () => {
    it("should return existing link", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: "1",
      });
      const res = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "pms1",
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
      });
      expect(res._id).toBe("1");
    });

    it("should create pending link if new", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({
        _id: "new",
        status: "PENDING",
      });

      const res = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "pms1",
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
      });

      expect(res.status).toBe("PENDING");
    });
  });

  describe("sendInvite", () => {
    it("should throw if neither email nor name provided", async () => {
      await expect(
        CompanionOrganisationService.sendInvite({
          parentId: validParentId,
          companionId: validCompanionId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow("Email required or Name");
    });

    it("should create invite", async () => {
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({
        inviteToken: "uuid",
      });

      const res = await CompanionOrganisationService.sendInvite({
        parentId: validParentId,
        companionId: validCompanionId,
        organisationType: "HOSPITAL",
        email: "test@example.com",
      });

      expect(res.inviteToken).toBeDefined();
    });
  });

  describe("validateInvite", () => {
    it("should throw if token missing", async () => {
      await expect(
        CompanionOrganisationService.validateInvite(""),
      ).rejects.toThrow("Invite token missing");
    });

    it("should return invite if valid", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: "1",
      });
      const res = await CompanionOrganisationService.validateInvite("token");
      expect(res).toBeDefined();
    });

    it("should throw 404 if invalid", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.validateInvite("token"),
      ).rejects.toThrow("Invalid or expired invite");
    });
  });

  describe("acceptInvite", () => {
    it("should activate invite", async () => {
      const invite = createMockDoc({ status: "PENDING" });
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        invite,
      );

      await CompanionOrganisationService.acceptInvite({
        token: "t",
        organisationId: validOrgId,
      });

      expect(invite.status).toBe("ACTIVE");
      expect(invite.save).toHaveBeenCalled();
    });

    it("should throw 404 if invite not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.acceptInvite({
          token: "t",
          organisationId: validOrgId,
        }),
      ).rejects.toThrow("Invalid invite token");
    });
  });

  describe("rejectInvite", () => {
    it("should revoke invite", async () => {
      const invite = createMockDoc({ status: "PENDING" });
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        invite,
      );

      await CompanionOrganisationService.rejectInvite({
        token: "t",
        organisationId: validOrgId,
      });

      expect(invite.status).toBe("REVOKED");
      expect(invite.save).toHaveBeenCalled();
    });

    it("should throw 404 if invite not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.rejectInvite({
          token: "t",
          organisationId: validOrgId,
        }),
      ).rejects.toThrow("Invalid invite token");
    });
  });

  describe("Helpers (linkOn...)", () => {
    it("linkOnCompanionCreatedByPms should call linkByPmsUser", async () => {
      const spy = jest
        .spyOn(CompanionOrganisationService, "linkByPmsUser")
        .mockResolvedValue({} as any);
      await CompanionOrganisationService.linkOnCompanionCreatedByPms({
        companionId: validCompanionId,
        organisationId: validOrgId,
        pmsUserId: "u1",
        organisationType: "HOSPITAL",
      });
      expect(spy).toHaveBeenCalled();
    });

    it("linkOnAppointmentBooked should create active link if not exists", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      });

      const res = await CompanionOrganisationService.linkOnAppointmentBooked({
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
      });
      expect(res.status).toBe("ACTIVE");
    });

    it("linkOnAppointmentBooked should return existing", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: "exist",
      });
      const res = await CompanionOrganisationService.linkOnAppointmentBooked({
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
      });
      expect(res._id).toBe("exist");
    });
  });

  describe("revokeLink", () => {
    it("should revoke link", async () => {
      const deleted = { _id: validObjectId, status: "ACTIVE" };
      (
        CompanionOrganisationModel.findByIdAndDelete as jest.Mock
      ).mockResolvedValue(deleted);
      const res = await CompanionOrganisationService.revokeLink(validObjectId);
      expect(res).toBe(deleted);
      expect(CompanionOrganisationModel.findByIdAndDelete).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
      );
      const calledWithId = (
        CompanionOrganisationModel.findByIdAndDelete as jest.Mock
      ).mock.calls[0][0];
      expect(calledWithId.toString()).toBe(validObjectId);
    });

    it("should throw if not found", async () => {
      (
        CompanionOrganisationModel.findByIdAndDelete as jest.Mock
      ).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.revokeLink(validObjectId),
      ).rejects.toThrow("Link not found");
    });
  });

  describe("Parent Approval (parentApproveLink / parentRejectLink)", () => {
    it("parentApproveLink: should activate pending link", async () => {
      const link = createMockDoc({ status: "PENDING" });
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(link);

      await CompanionOrganisationService.parentApproveLink(
        validParentId,
        validObjectId,
      );
      expect(link.status).toBe("ACTIVE");
      expect(link.linkedByParentId).toBe(validParentId);
      expect(link.save).toHaveBeenCalled();
    });

    it("parentApproveLink: should throw if not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.parentApproveLink(
          validParentId,
          validObjectId,
        ),
      ).rejects.toThrow("Pending link not found.");
    });

    it("parentRejectLink: should revoke pending link", async () => {
      const link = createMockDoc({ status: "PENDING" });
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(link);

      await CompanionOrganisationService.parentRejectLink(
        validParentId,
        validObjectId,
      );
      expect(link.status).toBe("REVOKED");
    });

    it("parentRejectLink: should throw if not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.parentRejectLink(
          validParentId,
          validObjectId,
        ),
      ).rejects.toThrow("Pending link not found.");
    });
  });

  describe("Getters", () => {
    it("getLinksForCompanion: should find links", async () => {
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([]);
      await CompanionOrganisationService.getLinksForCompanion(validCompanionId);
      expect(CompanionOrganisationModel.find).toHaveBeenCalled();
    });

    it("getLinksForCompanionByOrganisationTye: should return enriched data", async () => {
      // Mock Find with populate
      const mockPopulate = jest.fn().mockReturnValue([]);
      (CompanionOrganisationModel.find as jest.Mock).mockReturnValue({
        populate: mockPopulate,
      });

      // Mock ParentCompanion, Companion, Parent lookups
      const mockExec = jest.fn().mockResolvedValue({ parentId: validParentId });
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue({
        exec: mockExec,
      });
      (CompanionModel.findById as jest.Mock).mockResolvedValue({
        name: "Buddy",
      });
      (ParentModel.findById as jest.Mock).mockResolvedValue({
        firstName: "John",
        lastName: "Doe",
      });

      // FIX: Pass validCompanionId.toString() to satisfy assertSafeString
      const res =
        await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          validCompanionId.toString(),
          "HOSPITAL",
        );

      expect(res.parentName).toBe("John Doe");
      expect(res.companionName).toBe("Buddy");
      expect(res.links).toEqual([]);
    });

    it("getLinksForOrganisation: should return mapped data", async () => {
      // 1. Mock finding links
      const mockLink = {
        _id: "link1",
        companionId: validCompanionId,
        organisationId: validOrgId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      };
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
        mockLink,
      ]);

      // 2. Mock Companion lookup
      (CompanionModel.findById as jest.Mock).mockResolvedValue({
        _id: validCompanionId,
        name: "Dog",
      });

      // 3. Mock Parent Link lookup
      (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue({
        parentId: validParentId,
      });

      // 4. Mock Parent lookup
      (ParentModel.findById as jest.Mock).mockResolvedValue({
        _id: validParentId,
        name: "Parent",
      });

      // 5. Mock Transformers
      (toFHIRCompanion as jest.Mock).mockReturnValue({ id: "c1" });
      (toFHIRParent as jest.Mock).mockReturnValue({ id: "p1" });

      const res =
        await CompanionOrganisationService.getLinksForOrganisation(validOrgId);

      expect(res).toHaveLength(1);
      expect(res[0]!.companion.id).toBe("c1");
      expect(res[0]!.parent?.id).toBe("p1");
    });

    it("getLinksForOrganisation: should filter out orphaned links (no companion)", async () => {
      const mockLink = { companionId: validCompanionId };
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
        mockLink,
      ]);
      (CompanionModel.findById as jest.Mock).mockResolvedValue(null); // Companion deleted

      const res =
        await CompanionOrganisationService.getLinksForOrganisation(validOrgId);
      expect(res).toHaveLength(0); // Filtered out
    });

    it("getLinksForOrganisation: should handle companion with no parent (null parent)", async () => {
      const mockLink = {
        _id: "link1",
        companionId: validCompanionId,
        status: "ACTIVE",
      };
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
        mockLink,
      ]);
      (CompanionModel.findById as jest.Mock).mockResolvedValue({
        _id: validCompanionId,
      });
      (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue(null); // No parent link

      const res =
        await CompanionOrganisationService.getLinksForOrganisation(validOrgId);
      expect(res).toHaveLength(1);
      expect(res[0]!.parent).toBeNull();
    });
  });
});
