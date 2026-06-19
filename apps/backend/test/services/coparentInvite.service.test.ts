import { randomUUID } from "node:crypto";

import {
  CoParentInviteService,
  CoParentInviteServiceError,
} from "../../src/services/coparentInvite.service";
import { ParentService } from "../../src/services/parent.service";
import { prisma } from "src/config/prisma";

jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    coParentInvite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    parentPatient: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/parent.service", () => ({
  ParentService: {
    findByLinkedUserId: jest.fn(),
  },
}));

describe("CoParentInviteService", () => {
  const validCompanionId = "comp-1";
  const validParentId = "parent-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CoParentInviteServiceError", () => {
    it("sets message, statusCode, and name", () => {
      const error = new CoParentInviteServiceError("Test error", 400);

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("CoParentInviteServiceError");
    });
  });

  describe("sendInvite", () => {
    it("throws if email is missing", async () => {
      await expect(
        CoParentInviteService.sendInvite({
          email: "",
          patientId: validCompanionId,
          invitedByParentId: validParentId,
        }),
      ).rejects.toThrow("Email is required.");
    });

    it("throws if patientId is invalid", async () => {
      await expect(
        CoParentInviteService.sendInvite({
          email: "test@test.com",
          patientId: "",
          invitedByParentId: validParentId,
        }),
      ).rejects.toThrow("Invalid patientId.");
    });

    it("throws if invitedByParentId is invalid", async () => {
      await expect(
        CoParentInviteService.sendInvite({
          email: "test@test.com",
          patientId: validCompanionId,
          invitedByParentId: "",
        }),
      ).rejects.toThrow("Invalid invitedByParentId.");
    });

    it("throws if inviter is not the primary parent for the companion", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.sendInvite({
          email: "test@test.com",
          patientId: validCompanionId,
          invitedByParentId: validParentId,
        }),
      ).rejects.toThrow(
        "You are not authorized to invite a co-parent for this companion.",
      );
    });

    it("creates and returns an invite with a trimmed inviteeName", async () => {
      (randomUUID as jest.Mock).mockReturnValue("mock-uuid-token");
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });

      const result = await CoParentInviteService.sendInvite({
        email: "TEST@example.com",
        patientId: validCompanionId,
        invitedByParentId: validParentId,
        inviteeName: "  John Doe  ",
      });

      expect(prisma.coParentInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@example.com",
          inviteToken: "mock-uuid-token",
          inviteeName: "  John Doe  ",
          patientId: validCompanionId,
          invitedByParentId: validParentId,
          consumed: false,
        }),
      });
      expect(result.email).toBe("test@example.com");
      expect(result.inviteeName).toBe("John Doe");
      expect(result.inviteToken).toBe("mock-uuid-token");
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns null inviteeName when it is omitted", async () => {
      (randomUUID as jest.Mock).mockReturnValue("mock-uuid-token");
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });
      (prisma.coParentInvite.create as jest.Mock).mockResolvedValue({
        id: "invite-1",
      });

      const result = await CoParentInviteService.sendInvite({
        email: "test2@example.com",
        patientId: validCompanionId,
        invitedByParentId: validParentId,
      });

      expect(result.inviteeName).toBeNull();
    });
  });

  describe("validateInvite", () => {
    it("throws if token is missing", async () => {
      await expect(CoParentInviteService.validateInvite("")).rejects.toThrow(
        "Invite token is required.",
      );
      await expect(
        CoParentInviteService.validateInvite(null as unknown as string),
      ).rejects.toThrow("Invite token is required.");
    });

    it("throws if invite does not exist", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("Invalid invite token.");
    });

    it("throws if invite is consumed", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        consumed: true,
      });

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("This invite has already been used.");
    });

    it("throws if invite is expired", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("This invite has expired.");
    });

    it("throws if inviter parent is missing", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "test@test.com",
        inviteeName: null,
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
        patientId: validCompanionId,
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("Inviter parent not found.");
    });

    it("throws if companion is missing", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "test@test.com",
        inviteeName: null,
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
        patientId: validCompanionId,
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: validParentId,
        firstName: "John",
        lastName: "Doe",
        profileImageUrl: null,
      });
      (prisma.patient.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.validateInvite("token"),
      ).rejects.toThrow("Companion not found.");
    });

    it("returns mapped invite data", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        email: "test@test.com",
        inviteeName: "Invitee",
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        invitedByParentId: validParentId,
        patientId: validCompanionId,
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: validParentId,
        firstName: "John",
        lastName: "Doe",
        profileImageUrl: "url",
      });
      (prisma.patient.findUnique as jest.Mock).mockResolvedValue({
        id: validCompanionId,
        name: "Child",
        photoUrl: "photo",
      });

      const result = await CoParentInviteService.validateInvite("token");

      expect(result.invitedBy.fullName).toBe("John Doe");
      expect(result.companion.photoUrl).toBe("photo");
      expect(result.patient.id).toBe(validCompanionId);
    });
  });

  describe("acceptInvite", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("throws if token is missing", async () => {
      await expect(
        CoParentInviteService.acceptInvite("", "user-1"),
      ).rejects.toThrow("Invite token is required.");
    });

    it("throws if authUserId is missing", async () => {
      await expect(
        CoParentInviteService.acceptInvite("token", ""),
      ).rejects.toThrow("Authenticated user required.");
    });

    it("throws if the parent profile is missing", async () => {
      jest.spyOn(CoParentInviteService, "validateInvite").mockResolvedValue({
        id: "invite-1",
        email: "test@test.com",
        inviteeName: null,
        expiresAt: new Date(Date.now() + 10000),
        invitedBy: {
          id: validParentId,
          firstName: "John",
          lastName: null,
          profileImageUrl: null,
        },
        companion: { id: validCompanionId, name: "Child", photoUrl: null },
        patient: { id: validCompanionId, name: "Child", photoUrl: null },
      } as any);
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.acceptInvite("token", "user-1"),
      ).rejects.toThrow("Parent profile not found");
    });

    it("throws if the parent is already linked", async () => {
      jest.spyOn(CoParentInviteService, "validateInvite").mockResolvedValue({
        id: "invite-1",
        email: "test@test.com",
        inviteeName: null,
        expiresAt: new Date(Date.now() + 10000),
        invitedBy: {
          id: validParentId,
          firstName: "John",
          lastName: null,
          profileImageUrl: null,
        },
        companion: { id: validCompanionId, name: "Child", photoUrl: null },
        patient: { id: validCompanionId, name: "Child", photoUrl: null },
      } as any);
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        id: "parent-2",
      });
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });

      await expect(
        CoParentInviteService.acceptInvite("token", "user-1"),
      ).rejects.toThrow("You are already linked to this companion.");
    });

    it("creates a parent-patient link and marks the invite consumed", async () => {
      jest.spyOn(CoParentInviteService, "validateInvite").mockResolvedValue({
        id: "invite-1",
        email: "test@test.com",
        inviteeName: null,
        expiresAt: new Date(Date.now() + 10000),
        invitedBy: {
          id: validParentId,
          firstName: "John",
          lastName: null,
          profileImageUrl: null,
        },
        companion: { id: validCompanionId, name: "Child", photoUrl: null },
        patient: { id: validCompanionId, name: "Child", photoUrl: null },
      } as any);
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        id: "parent-2",
      });
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await CoParentInviteService.acceptInvite(
        "token",
        "user-1",
      );

      expect(prisma.parentPatient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: "parent-2",
          patientId: validCompanionId,
          role: "CO_PARENT",
          status: "ACTIVE",
          invitedByParentId: validParentId,
        }),
      });
      expect(prisma.coParentInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: expect.objectContaining({
          consumed: true,
        }),
      });
      expect(result.message).toBe("Invite accepted successfully.");
    });
  });

  describe("declineInvite", () => {
    it("throws if token is missing", async () => {
      await expect(CoParentInviteService.declineInvite("")).rejects.toThrow(
        "Invite token is required.",
      );
    });

    it("throws if invite is missing", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CoParentInviteService.declineInvite("token"),
      ).rejects.toThrow("Invalid invite token.");
    });

    it("throws if invite is consumed", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        consumed: true,
      });

      await expect(
        CoParentInviteService.declineInvite("token"),
      ).rejects.toThrow("This invite has already been used.");
    });

    it("throws if invite is expired", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        consumed: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        CoParentInviteService.declineInvite("token"),
      ).rejects.toThrow("This invite has expired.");
    });

    it("marks the invite consumed and returns success", async () => {
      (prisma.coParentInvite.findUnique as jest.Mock).mockResolvedValue({
        id: "invite-1",
        consumed: false,
        expiresAt: new Date(Date.now() + 10000),
        email: "t@t.com",
        patientId: "c1",
        invitedByParentId: "p1",
      });
      (prisma.coParentInvite.update as jest.Mock).mockResolvedValue({
        email: "t@t.com",
        patientId: "c1",
        invitedByParentId: "p1",
      });

      const result = await CoParentInviteService.declineInvite("token");

      expect(prisma.coParentInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: expect.objectContaining({
          consumed: true,
        }),
      });
      expect(result.message).toBe("Invite declined successfully.");
    });
  });

  describe("getPendingInvitesForEmail", () => {
    it("throws if email is missing", async () => {
      await expect(
        CoParentInviteService.getPendingInvitesForEmail(""),
      ).rejects.toThrow("Email is required.");
    });

    it("returns an empty array when there are no invites", async () => {
      (prisma.coParentInvite.findMany as jest.Mock).mockResolvedValue([]);

      const result =
        await CoParentInviteService.getPendingInvitesForEmail("test@test.com");

      expect(result.pendingInvites).toEqual([]);
    });

    it("skips invites with missing relations and maps valid ones", async () => {
      (prisma.coParentInvite.findMany as jest.Mock).mockResolvedValue([
        {
          inviteToken: "t1",
          email: "test@test.com",
          invitedByParentId: "p1",
          patientId: "c1",
          inviteeName: null,
          expiresAt: new Date(Date.now() + 10000),
        },
        {
          inviteToken: "t2",
          email: "test@test.com",
          invitedByParentId: "p2",
          patientId: "c2",
          inviteeName: null,
          expiresAt: new Date(Date.now() + 10000),
        },
        {
          inviteToken: "t3",
          email: "test@test.com",
          invitedByParentId: "p3",
          patientId: "c3",
          inviteeName: "Test Name",
          expiresAt: new Date(Date.now() + 10000),
        },
      ]);

      (prisma.parent.findUnique as jest.Mock).mockImplementation(
        async ({ where }: { where: { id: string } }) => {
          if (where.id === "p1") return null;
          return {
            id: where.id,
            firstName: "First",
            lastName: null,
            profileImageUrl: null,
          };
        },
      );

      (prisma.patient.findUnique as jest.Mock).mockImplementation(
        async ({ where }: { where: { id: string } }) => {
          if (where.id === "c2") return null;
          return {
            id: where.id,
            name: "Child",
            photoUrl: null,
          };
        },
      );

      const result =
        await CoParentInviteService.getPendingInvitesForEmail("test@test.com");

      expect(result.pendingInvites).toHaveLength(1);
      expect(result.pendingInvites[0].token).toBe("t3");
      expect(result.pendingInvites[0].inviteeName).toBe("Test Name");
      expect(result.pendingInvites[0].invitedBy.firstName).toBe("First");
      expect(result.pendingInvites[0].companion.name).toBe("Child");
    });
  });
});
