import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import {
  CoParentInviteService,
  CoParentInviteServiceError,
} from "../../src/services/coparentInvite.service";

// Import the actual modules so we can assert and configure them (they will be mocked by Jest)
import { CoParentInviteModel } from "../../src/models/coparentInvite";
import { ParentModel } from "src/models/parent";
import CompanionModel from "../../src/models/companion";
import ParentCompanionModel from "src/models/parent-companion";
import { ParentCompanionService } from "../../src/services/parent-companion.service";
import { ParentService } from "../../src/services/parent.service";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

// --- Global Mocks Setup (Inline definitions to prevent TDZ / initialization errors) ---
jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(),
}));

jest.mock("../../src/models/coparentInvite", () => ({
  __esModule: true,
  CoParentInviteModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("src/models/parent", () => ({
  __esModule: true,
  ParentModel: { findById: jest.fn() },
}));

jest.mock("../../src/models/companion", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock("src/models/parent-companion", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("../../src/services/parent-companion.service", () => ({
  ParentCompanionService: { linkParent: jest.fn() },
}));

jest.mock("../../src/services/parent.service", () => ({
  ParentService: { findByLinkedUserId: jest.fn() },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    coParentInvite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
    },
    companion: {
      findUnique: jest.fn(),
    },
    parentCompanion: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

// Helper to simulate Mongoose query objects that can be both awaited directly OR chained with .lean()
const createMockQuery = (result: any) => ({
  lean: jest.fn().mockResolvedValue(result),
  then: function (resolve: any, reject: any) {
    Promise.resolve(result).then(resolve).catch(reject);
  },
});

describe("CoParentInviteService", () => {
  const validCompanionId = new Types.ObjectId().toString();
  const validParentId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  describe("CoParentInviteServiceError", () => {
    it("should correctly set message, statusCode, and name", () => {
      const error = new CoParentInviteServiceError("Test error", 400);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("CoParentInviteServiceError");
    });
  });

  describe("sendInvite", () => {
    it("should throw if email is missing", async () => {
      await expect(
        CoParentInviteService.sendInvite({
          email: "",
          companionId: validCompanionId,
          invitedByParentId: validParentId,
        }),
      ).rejects.toThrow(
        new CoParentInviteServiceError("Email is required.", 400),
      );
    });

    it("should throw if companionId is invalid", async () => {
      await expect(
        CoParentInviteService.sendInvite({
          email: "test@test.com",
          companionId: "invalid",
          invitedByParentId: validParentId,
        }),
      ).rejects.toThrow(
        new CoParentInviteServiceError("Invalid companionId.", 400),
      );
    });

    it("should throw if invitedByParentId is invalid", async () => {
      await expect(
        CoParentInviteService.sendInvite({
          email: "test@test.com",
          companionId: validCompanionId,
          invitedByParentId: "invalid",
        }),
      ).rejects.toThrow(
        new CoParentInviteServiceError("Invalid invitedByParentId.", 400),
      );
    });

    it("should create and return an invite with trimmed inviteeName", async () => {
      (randomUUID as jest.Mock).mockReturnValue("mock-uuid-token");

      const res = await CoParentInviteService.sendInvite({
        email: "TEST@example.com",
        companionId: validCompanionId,
        invitedByParentId: validParentId,
        inviteeName: "  John Doe  ",
      });

      expect(CoParentInviteModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          inviteToken: "mock-uuid-token",
          inviteeName: "  John Doe  ", // saved exactly as passed
        }),
      );

      expect(res.email).toBe("test@example.com");
      expect(res.inviteToken).toBe("mock-uuid-token");
      expect(res.inviteeName).toBe("John Doe"); // Trimmed in response
      expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should create and return an invite when inviteeName is missing (null fallback)", async () => {
      const res = await CoParentInviteService.sendInvite({
        email: "test2@example.com",
        companionId: validCompanionId,
        invitedByParentId: validParentId,
      });
      expect(res.inviteeName).toBeNull();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (randomUUID as jest.Mock).mockReturnValue("mock-uuid-token");
      (prisma.coParentInvite.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const res = await CoParentInviteService.sendInvite({
        email: "TEST@example.com",
        companionId: "comp-1",
        invitedByParentId: "parent-1",
      });

      expect(prisma.coParentInvite.create).toHaveBeenCalled();
      expect(res.inviteToken).toBe("mock-uuid-token");
    });

    it("handles dual-write errors", async () => {
      (randomUUID as jest.Mock).mockReturnValue("mock-uuid-token");
      (CoParentInviteModel.create as jest.Mock).mockResolvedValue({
        _id: { toString: () => "mongo-1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.coParentInvite.create as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await CoParentInviteService.sendInvite({
        email: "test@example.com",
        companionId: validCompanionId,
        invitedByParentId: validParentId,
      });

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "CoParentInvite",
        expect.any(Error),
      );
    });
  });

  describe("validateInvite", () => {
    it("should throw if token is missing or not a string", async () => {
      await expect(CoParentInviteService.validateInvite("")).rejects.toThrow(
        "Invite token is required.",
      );
      await expect(
        CoParentInviteService.validateInvite(null as any),
      ).rejects.toThrow("Invite token is required.");
    });

    it("should throw if invite not found", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("Invalid invite token.");
    });

    it("should throw if invite is consumed", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: true,
      });
      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("This invite has already been used.");
    });

    it("should throw if invite is expired", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() - 10000),
      });
      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("This invite has expired.");
    });

    it("should throw if inviter parent not found", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
      });
      (ParentModel.findById as jest.Mock).mockReturnValue(
        createMockQuery(null),
      );

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("Inviter parent not found.");
    });

    it("should throw if companion not found", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
        companionId: validCompanionId,
      });
      (ParentModel.findById as jest.Mock).mockReturnValue(
        createMockQuery({ _id: validParentId }),
      );
      (CompanionModel.findById as jest.Mock).mockReturnValue(
        createMockQuery(null),
      );

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("Companion not found.");
    });

    it("should return fully mapped data when optionals are present", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        _id: "invite_id",
        email: "test@test.com",
        inviteeName: "Invitee",
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
        companionId: validCompanionId,
      });
      (ParentModel.findById as jest.Mock).mockReturnValue(
        createMockQuery({
          _id: validParentId,
          firstName: "John",
          lastName: "Doe",
          profileImageUrl: "url",
        }),
      );
      (CompanionModel.findById as jest.Mock).mockReturnValue(
        createMockQuery({
          _id: validCompanionId,
          name: "Child",
          photoUrl: "photo",
        }),
      );

      const res = await CoParentInviteService.validateInvite("token");
      expect(res.invitedBy.fullName).toBe("John Doe");
      expect(res.invitedBy.profileImageUrl).toBe("url");
      expect(res.companion.photoUrl).toBe("photo");
    });

    it("should return mapped data falling back to null for optionals", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        _id: "invite_id",
        email: "test@test.com",
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
        companionId: validCompanionId,
      });
      (ParentModel.findById as jest.Mock).mockReturnValue(
        createMockQuery({
          _id: validParentId,
          firstName: "John", // Missing last name & image
        }),
      );
      (CompanionModel.findById as jest.Mock).mockReturnValue(
        createMockQuery({
          _id: validCompanionId,
          name: "Child", // Missing photoUrl
        }),
      );

      const res = await CoParentInviteService.validateInvite("token");
      expect(res.inviteeName).toBeNull();
      expect(res.invitedBy.lastName).toBeNull();
      expect(res.invitedBy.fullName).toBe("John"); // Only first name joined
      expect(res.invitedBy.profileImageUrl).toBeNull();
      expect(res.companion.photoUrl).toBeNull();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "pg-1",
        inviteToken: "token",
        email: "test@test.com",
        inviteeName: null,
        expiresAt: new Date(Date.now() + 10000),
        consumed: false,
        invitedByParentId: "parent-1",
        companionId: "comp-1",
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: "parent-1",
        firstName: "John",
        lastName: "Doe",
        profileImageUrl: null,
      });
      (prisma.companion.findUnique as jest.Mock).mockResolvedValue({
        id: "comp-1",
        name: "Child",
        photoUrl: null,
      });

      const res = await CoParentInviteService.validateInvite("token");

      expect(res.invitedBy.fullName).toBe("John Doe");
      expect(res.companion.id).toBe("comp-1");
    });
  });

  describe("acceptInvite", () => {
    let validateSpy: jest.SpyInstance;

    beforeEach(() => {
      validateSpy = jest.spyOn(CoParentInviteService, "validateInvite");
    });

    afterEach(() => {
      validateSpy.mockRestore();
    });

    it("should throw if token is missing", async () => {
      await expect(
        CoParentInviteService.acceptInvite("", "user1"),
      ).rejects.toThrow("Invite token is required.");
    });

    it("should throw if authUserId is missing", async () => {
      await expect(
        CoParentInviteService.acceptInvite("token", ""),
      ).rejects.toThrow("Authenticated user required.");
    });

    it("should throw if inviteDoc is not found after validation", async () => {
      validateSpy.mockResolvedValue({
        id: "inv_id",
        companion: { id: "c1" },
        invitedBy: { id: "p1" },
      } as any);
      (CoParentInviteModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.acceptInvite("token", "user1"),
      ).rejects.toThrow("Invalid invite");
    });

    it("should throw if parent profile not found for accepting user", async () => {
      validateSpy.mockResolvedValue({
        id: "inv_id",
        companion: { id: "c1" },
        invitedBy: { id: "p1" },
      } as any);
      (CoParentInviteModel.findById as jest.Mock).mockResolvedValue({});
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.acceptInvite("token", "user1"),
      ).rejects.toThrow("Parent profile not found");
    });

    it("should throw if an existing link already exists", async () => {
      validateSpy.mockResolvedValue({
        id: "inv_id",
        companion: { id: "c1" },
        invitedBy: { id: "p1" },
      } as any);
      (CoParentInviteModel.findById as jest.Mock).mockResolvedValue({});
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: "p2",
      });
      (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue({
        _id: "link1",
      }); // Link exists

      await expect(
        CoParentInviteService.acceptInvite("token", "user1"),
      ).rejects.toThrow("You are already linked to this companion.");
    });

    it("should create link, mark as consumed, save and return success", async () => {
      validateSpy.mockResolvedValue({
        id: "inv_id",
        companion: { id: validCompanionId },
        invitedBy: { id: validParentId },
      } as any);

      const mockSave = jest.fn();
      const mockInviteDoc = { consumed: false, save: mockSave };
      (CoParentInviteModel.findById as jest.Mock).mockResolvedValue(
        mockInviteDoc,
      );

      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: "p2",
      });
      (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue(null); // No link exists

      const res = await CoParentInviteService.acceptInvite("token", "user1");

      expect(ParentCompanionService.linkParent).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "p2",
          role: "CO_PARENT",
          status: "ACTIVE",
        }),
      );
      expect(mockInviteDoc.consumed).toBe(true);
      expect(mockSave).toHaveBeenCalled();
      expect(res.message).toBe("Invite accepted successfully.");
      expect(res.companionId).toBe(validCompanionId);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      const validateSpyLocal = jest.spyOn(
        CoParentInviteService,
        "validateInvite",
      );
      validateSpyLocal.mockResolvedValue({
        id: "pg-invite",
        email: "test@test.com",
        inviteeName: null,
        expiresAt: new Date(Date.now() + 10000),
        invitedBy: { id: "parent-1" },
        companion: { id: "comp-1" },
      } as any);
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        id: "parent-2",
      });
      (prisma.parentCompanion.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await CoParentInviteService.acceptInvite("token", "user1");

      expect(prisma.parentCompanion.create).toHaveBeenCalled();
      expect(prisma.coParentInvite.update).toHaveBeenCalled();
      expect(res.message).toBe("Invite accepted successfully.");
      validateSpyLocal.mockRestore();
    });
  });

  describe("declineInvite", () => {
    it("should throw if token missing", async () => {
      await expect(CoParentInviteService.declineInvite("")).rejects.toThrow(
        "Invite token is required.",
      );
    });

    it("should throw if invite not found", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CoParentInviteService.declineInvite("token"),
      ).rejects.toThrow("Invalid invite token.");
    });

    it("should throw if already consumed", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: true,
      });
      await expect(
        CoParentInviteService.declineInvite("token"),
      ).rejects.toThrow("This invite has already been used.");
    });

    it("should throw if expired", async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        CoParentInviteService.declineInvite("token"),
      ).rejects.toThrow("This invite has expired.");
    });

    it("should mark consumed and return success", async () => {
      const mockSave = jest.fn();
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        email: "t@t.com",
        companionId: "c1",
        invitedByParentId: "p1",
        save: mockSave,
      });

      const res = await CoParentInviteService.declineInvite("token");

      expect(mockSave).toHaveBeenCalled();
      expect(res.message).toBe("Invite declined successfully.");
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "pg-1",
        inviteToken: "token",
        email: "t@t.com",
        companionId: "c1",
        invitedByParentId: "p1",
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
      });
      (prisma.coParentInvite.update as jest.Mock).mockResolvedValue({
        email: "t@t.com",
        companionId: "c1",
        invitedByParentId: "p1",
      });

      const res = await CoParentInviteService.declineInvite("token");
      expect(res.message).toBe("Invite declined successfully.");
    });
  });

  describe("getPendingInvitesForEmail", () => {
    it("should throw if email is missing", async () => {
      await expect(
        CoParentInviteService.getPendingInvitesForEmail(""),
      ).rejects.toThrow("Email is required.");
    });

    it("should return empty array if no invites found", async () => {
      (CoParentInviteModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      const res =
        await CoParentInviteService.getPendingInvitesForEmail("test@test.com");
      expect(res.pendingInvites).toEqual([]);
    });

    it("should skip invite if inviter or companion is not found and map valid ones", async () => {
      const mockInvites = [
        {
          inviteToken: "t1",
          email: "test@test.com",
          invitedByParentId: "p1",
          companionId: "c1",
        }, // Missing inviter
        {
          inviteToken: "t2",
          email: "test@test.com",
          invitedByParentId: "p2",
          companionId: "c2",
        }, // Missing companion
        {
          inviteToken: "t3",
          email: "test@test.com",
          invitedByParentId: "p3",
          companionId: "c3",
          inviteeName: "Test Name",
        }, // Valid
      ];

      (CoParentInviteModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockInvites),
      });

      // Setup finding parents/companions based on IDs
      (ParentModel.findById as jest.Mock).mockImplementation((id) => {
        if (id === "p1") return createMockQuery(null); // Missing
        return createMockQuery({ _id: id, firstName: "First" });
      });

      (CompanionModel.findById as jest.Mock).mockImplementation((id) => {
        if (id === "c2") return createMockQuery(null); // Missing
        return createMockQuery({ _id: id, name: "Child" });
      });

      const res =
        await CoParentInviteService.getPendingInvitesForEmail("test@test.com");

      expect(res.pendingInvites).toHaveLength(1);
      expect(res.pendingInvites[0].token).toBe("t3");
      expect(res.pendingInvites[0].inviteeName).toBe("Test Name");
      expect(res.pendingInvites[0].invitedBy.firstName).toBe("First");
      expect(res.pendingInvites[0].invitedBy.lastName).toBeNull();
      expect(res.pendingInvites[0].companion.name).toBe("Child");
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.coParentInvite.findMany as jest.Mock).mockResolvedValue([
        {
          inviteToken: "t1",
          email: "test@test.com",
          inviteeName: "Name",
          expiresAt: new Date(Date.now() + 10000),
          invitedByParentId: "p1",
          companionId: "c1",
        },
      ]);
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        firstName: "First",
        lastName: null,
        profileImageUrl: null,
      });
      (prisma.companion.findUnique as jest.Mock).mockResolvedValue({
        id: "c1",
        name: "Child",
        photoUrl: null,
      });

      const res =
        await CoParentInviteService.getPendingInvitesForEmail("test@test.com");
      expect(res.pendingInvites).toHaveLength(1);
      expect(res.pendingInvites[0].token).toBe("t1");
    });
  });
});
