const mockCreateToken = jest.fn(() => "stream-token");
const mockUpsertUser = jest.fn();
const mockSendMessage = jest.fn();
const mockUpdatePartial = jest.fn();
const mockAddMembers = jest.fn();
const mockRemoveMembers = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const mockWatch = jest.fn();
const mockChannel = jest.fn(() => ({
  create: mockCreate,
  sendMessage: mockSendMessage,
  updatePartial: mockUpdatePartial,
  addMembers: mockAddMembers,
  removeMembers: mockRemoveMembers,
  update: mockUpdate,
  delete: mockDelete,
  watch: mockWatch,
}));

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: () => ({
      channel: mockChannel,
      upsertUser: mockUpsertUser,
      createToken: mockCreateToken,
    }),
  },
}));

jest.mock("src/services/user-profile.service", () => ({
  UserProfileService: { getByUserId: jest.fn() },
}));
jest.mock("src/services/user.service", () => ({
  UserService: { getById: jest.fn() },
}));
jest.mock("src/config/prisma", () => ({
  prisma: {
    userOrganization: { findFirst: jest.fn() },
    chatSession: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    appointment: { findFirst: jest.fn() },
  },
}));

import { ChatService } from "src/services/chat.service";
import { prisma } from "src/config/prisma";
import { UserProfileService } from "src/services/user-profile.service";
import { UserService } from "src/services/user.service";

const mockedPrisma = prisma as unknown as {
  userOrganization: { findFirst: jest.Mock };
  chatSession: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  appointment: { findFirst: jest.Mock };
};
const mockedUserProfile = UserProfileService as unknown as {
  getByUserId: jest.Mock;
};
const mockedUserService = UserService as unknown as { getById: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  // org-membership checks pass by default
  mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "map1" });
  // stream stubs resolve
  mockCreateToken.mockReturnValue("stream-token");
  mockUpsertUser.mockResolvedValue(undefined);
  mockSendMessage.mockResolvedValue({ message: { id: "m1" } });
  mockUpdatePartial.mockResolvedValue(undefined);
  mockAddMembers.mockResolvedValue(undefined);
  mockRemoveMembers.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue(undefined);
  // user profile / user lookups used during stream upserts
  mockedUserProfile.getByUserId.mockResolvedValue({
    profile: { personalDetails: { profilePictureUrl: "http://img" } },
  });
  mockedUserService.getById.mockResolvedValue({
    firstName: "Jane",
    lastName: "Doe",
  });
});

/* ------------------------------- generateToken ----------------------------- */

describe("ChatService.generateToken", () => {
  it("returns a token and an expiry one day out", () => {
    const res = ChatService.generateToken("u1");
    expect(res.token).toBe("stream-token");
    expect(mockCreateToken).toHaveBeenCalledWith("u1");
    expect(res.expiresAt).toBeGreaterThan(Date.now());
  });

  it("throws when userId is missing", () => {
    expect(() => ChatService.generateToken("")).toThrow(/userId is required/);
  });
});

/* ----------------------------- initSystemUserOnce -------------------------- */

describe("ChatService.initSystemUserOnce", () => {
  it("upserts the system user", async () => {
    await ChatService.initSystemUserOnce();
    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "system-yosemite", role: "admin" }),
    );
  });
});

/* --------------------------- ensureAppointmentChat ------------------------- */

describe("ChatService.ensureAppointmentChat", () => {
  it("returns the existing session when one already exists", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: "a1" });
    const existing = { id: "s1", channelId: "appointment-a1" };
    mockedPrisma.chatSession.findFirst.mockResolvedValue(existing);

    const res = await ChatService.ensureAppointmentChat("a1");

    expect(res).toEqual({ ...existing, _id: existing.id });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a channel and session including the vet when assigned", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "a1",
      organisationId: "org1",
      startTime: new Date("2026-06-26T10:00:00Z"),
      patient: { id: "pet1", parent: { id: "parent1", name: "Owner" } },
      lead: { id: "vet1", name: "Dr Vet" },
    });
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    const created = { id: "s-new", channelId: "appointment-a1" };
    mockedPrisma.chatSession.create.mockResolvedValue(created);

    const res = await ChatService.ensureAppointmentChat("a1");

    expect(mockChannel).toHaveBeenCalledWith(
      "messaging",
      "appointment-a1",
      expect.objectContaining({ appointmentId: "a1", organisationId: "org1" }),
    );
    expect(mockCreate).toHaveBeenCalled();
    // parent + vet + system upserts
    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "parent1" }),
    );
    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vet1" }),
    );
    expect(mockedPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: ["parent1", "vet1"],
          type: "APPOINTMENT",
        }),
      }),
    );
    expect(res).toEqual({ ...created, _id: created.id });
  });

  it("creates a session with only the parent when no vet (lead) is set", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "a2",
      organisationId: "org1",
      startTime: new Date("2026-06-26T10:00:00Z"),
      patient: { id: "pet2", parent: { id: "parent2" } },
      lead: null,
    });
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    mockedPrisma.chatSession.create.mockResolvedValue({ id: "s2" });

    await ChatService.ensureAppointmentChat("a2");

    expect(mockedPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ members: ["parent2"] }),
      }),
    );
  });

  it("throws 404 when the appointment is not found", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.ensureAppointmentChat("missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when the appointment has no parent", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "a3",
      organisationId: "org1",
      startTime: new Date(),
      patient: { id: "pet3" },
      lead: null,
    });
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(ChatService.ensureAppointmentChat("a3")).rejects.toMatchObject(
      {
        statusCode: 404,
      },
    );
  });
});

/* ----------------------------- createOrgDirectChat ------------------------- */

describe("ChatService.createOrgDirectChat", () => {
  it("throws when chatting with yourself", async () => {
    await expect(
      ChatService.createOrgDirectChat("org1", "u1", "u1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns the existing direct chat early when one exists", async () => {
    const existing = { id: "s1", channelId: "od_x" };
    mockedPrisma.chatSession.findFirst.mockResolvedValue(existing);

    const res = await ChatService.createOrgDirectChat("org1", "userB", "userA");

    expect(res).toEqual({ ...existing, _id: existing.id });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a new direct chat, upserting both users", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    const created = { id: "s-new", channelId: "od_x" };
    mockedPrisma.chatSession.create.mockResolvedValue(created);

    const res = await ChatService.createOrgDirectChat("org1", "userB", "userA");

    // members are sorted alphabetically
    expect(mockChannel).toHaveBeenCalledWith(
      "team",
      expect.stringMatching(/^od_/),
      expect.objectContaining({ members: ["userA", "userB"] }),
    );
    expect(mockUpsertUser).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ORG_DIRECT",
          members: ["userA", "userB"],
        }),
      }),
    );
    expect(res).toEqual({ ...created, _id: created.id });
  });
});

/* ----------------------------- createOrgGroupChat -------------------------- */

describe("ChatService.createOrgGroupChat", () => {
  it("throws when fewer than 2 distinct members", async () => {
    await expect(
      ChatService.createOrgGroupChat({
        organisationId: "org1",
        createdBy: "owner",
        title: "Solo",
        memberIds: ["owner"],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates a group chat with a team channel", async () => {
    const created = { id: "g1" };
    mockedPrisma.chatSession.create.mockResolvedValue(created);

    const res = await ChatService.createOrgGroupChat({
      organisationId: "org1",
      createdBy: "owner",
      title: "Team",
      memberIds: ["owner", "member2"],
    });

    expect(mockChannel).toHaveBeenCalledWith(
      "team",
      expect.stringMatching(/^org-group-/),
      expect.objectContaining({ name: "Team", created_by_id: "owner" }),
    );
    expect(mockedPrisma.chatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "ORG_GROUP", title: "Team" }),
      }),
    );
    expect(res).toEqual({ ...created, _id: created.id });
  });
});

/* --------------------------- openChatBySessionId --------------------------- */

describe("ChatService.openChatBySessionId", () => {
  it("opens a non-appointment chat for a member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
    });

    const res = await ChatService.openChatBySessionId("s1", "u1");

    expect(res).toMatchObject({ channelId: "ch1", token: "stream-token" });
    expect(res.expiresAt).toBeGreaterThan(Date.now());
  });

  it("opens an appointment chat when inside the window", async () => {
    const now = new Date();
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
      appointmentId: "a1",
      allowedFrom: new Date(now.getTime() - 1000),
      allowedUntil: new Date(now.getTime() + 60000),
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      status: "UPCOMING",
    });

    const res = await ChatService.openChatBySessionId("s1", "u1");
    expect(res.channelId).toBe("ch1");
  });

  it("throws 404 when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.openChatBySessionId("missing", "u1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when the appointment is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
      appointmentId: "a1",
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 403 when the appointment window has closed", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
      appointmentId: "a1",
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      status: "CANCELLED",
    });

    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

/* -------------------------------- closeSession ----------------------------- */

describe("ChatService.closeSession success paths", () => {
  it("closes the session and posts a system message", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      createdBy: "owner",
      status: "ACTIVE",
      members: ["owner", "m2"],
      channelId: "ch1",
    });
    mockedPrisma.chatSession.update.mockResolvedValue({});

    await ChatService.closeSession("s1", "owner");

    expect(mockSendMessage).toHaveBeenCalled();
    expect(mockUpdatePartial).toHaveBeenCalledWith({ set: { frozen: true } });
    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ status: "CLOSED" }),
    });
  });

  it("swallows Stream errors but still updates the DB", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      createdBy: "vet",
      status: "ACTIVE",
      members: ["vet", "parent"],
      channelId: "ch1",
    });
    mockSendMessage.mockRejectedValue(new Error("stream down"));
    mockedPrisma.chatSession.update.mockResolvedValue({});

    await ChatService.closeSession("s1", "parent");

    expect(mockedPrisma.chatSession.update).toHaveBeenCalled();
  });

  it("is a no-op when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.closeSession("s1", "owner"),
    ).resolves.toBeUndefined();
  });
});

/* ------------------------------ addMembersToGroup -------------------------- */

describe("ChatService.addMembersToGroup", () => {
  const baseGroup = {
    id: "s1",
    type: "ORG_GROUP",
    createdBy: "owner",
    status: "ACTIVE",
    members: ["owner", "m2"],
    organisationId: "org1",
    channelId: "ch1",
  };

  it("returns early when there are no new members", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);

    const res = await ChatService.addMembersToGroup("s1", "owner", ["m2"]);

    expect(res).toEqual({ ...baseGroup, _id: baseGroup.id });
    expect(mockAddMembers).not.toHaveBeenCalled();
    expect(mockedPrisma.chatSession.update).not.toHaveBeenCalled();
  });

  it("adds new members", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    const updated = { ...baseGroup, members: ["owner", "m2", "m3"] };
    mockedPrisma.chatSession.update.mockResolvedValue(updated);

    const res = await ChatService.addMembersToGroup("s1", "owner", ["m3"]);

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { members: ["owner", "m2", "m3"] },
    });
    expect(mockAddMembers).toHaveBeenCalledWith(["m3"]);
    expect(res).toEqual({ ...updated, _id: updated.id });
  });

  it("throws 404 when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.addMembersToGroup("s1", "owner", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

/* --------------------------- removeMembersFromGroup ------------------------ */

describe("ChatService.removeMembersFromGroup", () => {
  const baseGroup = {
    id: "s1",
    type: "ORG_GROUP",
    createdBy: "owner",
    status: "ACTIVE",
    members: ["owner", "m2", "m3"],
    organisationId: "org1",
    channelId: "ch1",
  };

  it("removes a member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    const updated = { ...baseGroup, members: ["owner", "m2"] };
    mockedPrisma.chatSession.update.mockResolvedValue(updated);

    const res = await ChatService.removeMembersFromGroup("s1", "owner", ["m3"]);

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { members: ["owner", "m2"] },
    });
    expect(mockRemoveMembers).toHaveBeenCalledWith(["m3"]);
    expect(res).toEqual({ ...updated, _id: updated.id });
  });

  it("throws 400 when removing the owner", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["owner"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when dropping below 2 members", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      ...baseGroup,
      members: ["owner", "m2"],
    });
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["m2"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

/* -------------------------------- updateGroup ------------------------------ */

describe("ChatService.updateGroup", () => {
  const baseGroup = {
    id: "s1",
    type: "ORG_GROUP",
    createdBy: "owner",
    status: "ACTIVE",
    members: ["owner", "m2"],
    organisationId: "org1",
    channelId: "ch1",
    title: "Old",
    isPrivate: true,
  };

  it("updates title and privacy", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    const updated = { ...baseGroup, title: "New", isPrivate: false };
    mockedPrisma.chatSession.update.mockResolvedValue(updated);

    const res = await ChatService.updateGroup("s1", "owner", {
      title: "New",
      isPrivate: false,
    });

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { title: "New", isPrivate: false },
    });
    expect(mockUpdatePartial).toHaveBeenCalledWith({
      set: { name: "New", isPrivate: false },
    });
    expect(res).toEqual({ ...updated, _id: updated.id });
  });

  it("falls back to existing values when updates are omitted", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    mockedPrisma.chatSession.update.mockResolvedValue(baseGroup);

    await ChatService.updateGroup("s1", "owner", {});

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { title: "Old", isPrivate: true },
    });
  });

  it("throws 404 when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.updateGroup("s1", "owner", { title: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

/* -------------------------------- deleteGroup ------------------------------ */

describe("ChatService.deleteGroup", () => {
  const baseGroup = {
    id: "s1",
    type: "ORG_GROUP",
    createdBy: "owner",
    status: "ACTIVE",
    members: ["owner", "m2"],
    organisationId: "org1",
    channelId: "ch1",
  };

  it("deletes the group", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    mockedPrisma.chatSession.deleteMany.mockResolvedValue({ count: 1 });

    await ChatService.deleteGroup("s1", "owner");

    expect(mockDelete).toHaveBeenCalled();
    expect(mockedPrisma.chatSession.deleteMany).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });

  it("swallows Stream delete errors and still cleans the DB", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    mockDelete.mockRejectedValue(new Error("stream down"));
    mockedPrisma.chatSession.deleteMany.mockResolvedValue({ count: 1 });

    await ChatService.deleteGroup("s1", "owner");

    expect(mockedPrisma.chatSession.deleteMany).toHaveBeenCalled();
  });

  it("is a no-op when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.deleteGroup("s1", "owner"),
    ).resolves.toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

/* ---------------------- openChatBySessionId access guards ------------------ */

describe("ChatService.openChatBySessionId access guards", () => {
  it("throws 403 when the session is CLOSED", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      status: "CLOSED",
      members: ["u1"],
      channelId: "ch1",
    });

    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 403 when the user is not a member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      status: "ACTIVE",
      members: ["someoneElse"],
      channelId: "ch1",
    });

    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 403 when the appointment window has not opened yet", async () => {
    const now = new Date();
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
      appointmentId: "a1",
      allowedFrom: new Date(now.getTime() + 60000),
      allowedUntil: new Date(now.getTime() + 120000),
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      status: "UPCOMING",
    });

    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 403 when the appointment window has already ended", async () => {
    const now = new Date();
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
      appointmentId: "a1",
      allowedFrom: new Date(now.getTime() - 120000),
      allowedUntil: new Date(now.getTime() - 60000),
    });
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      status: "UPCOMING",
    });

    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

/* ------------------------- assertGroupAdmin guards ------------------------- */

describe("ChatService assertGroupAdmin guards (via addMembersToGroup)", () => {
  it("throws 400 when the session is not a group chat", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "APPOINTMENT",
      createdBy: "owner",
      status: "ACTIVE",
      members: ["owner", "m2"],
      organisationId: "org1",
      channelId: "ch1",
    });

    await expect(
      ChatService.addMembersToGroup("s1", "owner", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 403 when the actor is not the group owner", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      createdBy: "owner",
      status: "ACTIVE",
      members: ["owner", "m2"],
      organisationId: "org1",
      channelId: "ch1",
    });

    await expect(
      ChatService.addMembersToGroup("s1", "intruder", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 400 when the group chat is already closed", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      createdBy: "owner",
      status: "CLOSED",
      members: ["owner", "m2"],
      organisationId: "org1",
      channelId: "ch1",
    });

    await expect(
      ChatService.addMembersToGroup("s1", "owner", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
