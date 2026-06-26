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

jest.mock("src/models/chatSession", () => ({
  __esModule: true,
  default: { findById: jest.fn(), findOne: jest.fn(), create: jest.fn() },
}));
jest.mock("src/models/appointment", () => ({
  __esModule: true,
  default: { findById: jest.fn(), findOne: jest.fn() },
}));
jest.mock("src/models/user-organization", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("src/services/user-profile.service", () => ({
  UserProfileService: { getByUserId: jest.fn() },
}));
jest.mock("src/services/user.service", () => ({
  UserService: { getById: jest.fn() },
}));
jest.mock("src/utils/dual-write", () => ({
  handleDualWriteError: jest.fn(),
  shouldDualWrite: false,
}));
jest.mock("src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => true),
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
import { isReadFromPostgres } from "src/config/read-switch";
import ChatSessionModel from "src/models/chatSession";
import AppointmentModel from "src/models/appointment";
import UserOrganizationModel from "src/models/user-organization";
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
const mockedReadSwitch = isReadFromPostgres as unknown as jest.Mock;
const mockedChatSessionModel = ChatSessionModel as unknown as {
  findById: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
};
const mockedAppointmentModel = AppointmentModel as unknown as {
  findById: jest.Mock;
};
const mockedUserProfile = UserProfileService as unknown as {
  getByUserId: jest.Mock;
};
const mockedUserService = UserService as unknown as { getById: jest.Mock };
const mockedUserOrgModel = UserOrganizationModel as unknown as {
  findOne: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  // default: Postgres read path
  mockedReadSwitch.mockReturnValue(true);
  // org-membership checks pass by default (Postgres + Mongo paths)
  mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "map1" });
  mockedUserOrgModel.findOne.mockResolvedValue({ id: "map1" });
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

describe("ChatService.ensureAppointmentChat (Postgres path)", () => {
  it("returns the existing session when one already exists", async () => {
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: "a1" });
    const existing = { id: "s1", channelId: "appointment-a1" };
    mockedPrisma.chatSession.findFirst.mockResolvedValue(existing);

    const res = await ChatService.ensureAppointmentChat("a1");

    expect(res).toBe(existing);
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
    expect(res).toBe(created);
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

describe("ChatService.ensureAppointmentChat (Mongo path)", () => {
  beforeEach(() => mockedReadSwitch.mockReturnValue(false));

  it("returns the existing Mongo session when present", async () => {
    mockedAppointmentModel.findById.mockResolvedValue({
      patient: { id: "pet1", name: "Rex", parent: { id: "parent1" } },
      lead: { id: "vet1" },
      organisationId: "org1",
      startTime: new Date(),
    });
    const existing = { id: "s1", channelId: "appointment-a1" };
    mockedChatSessionModel.findOne.mockResolvedValue(existing);

    const res = await ChatService.ensureAppointmentChat("a1");

    expect(res).toBe(existing);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a channel and Mongo session when none exists", async () => {
    mockedAppointmentModel.findById.mockResolvedValue({
      patient: {
        id: "pet1",
        name: "Rex",
        parent: { id: "parent1", name: "Owner" },
      },
      lead: { id: "vet1", name: "Dr Vet" },
      organisationId: "org1",
      startTime: new Date("2026-06-26T10:00:00Z"),
    });
    mockedChatSessionModel.findOne.mockResolvedValue(null);
    const created = { id: "s-new", save: jest.fn() };
    mockedChatSessionModel.create.mockResolvedValue(created);

    const res = await ChatService.ensureAppointmentChat("a1");

    expect(mockChannel).toHaveBeenCalledWith(
      "messaging",
      "appointment-a1",
      expect.objectContaining({ created_by_id: "parent1" }),
    );
    expect(mockedChatSessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ members: ["parent1", "vet1"] }),
    );
    expect(res).toBe(created);
  });

  it("throws 404 when the Mongo appointment is missing", async () => {
    mockedAppointmentModel.findById.mockResolvedValue(null);

    await expect(ChatService.ensureAppointmentChat("x")).rejects.toMatchObject({
      statusCode: 404,
    });
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
    mockedChatSessionModel.findOne.mockResolvedValue(existing);

    const res = await ChatService.createOrgDirectChat("org1", "userB", "userA");

    expect(res).toBe(existing);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a new direct chat, upserting both users", async () => {
    mockedChatSessionModel.findOne.mockResolvedValue(null);
    const created = { id: "s-new", save: jest.fn() };
    mockedChatSessionModel.create.mockResolvedValue(created);

    const res = await ChatService.createOrgDirectChat("org1", "userB", "userA");

    // members are sorted alphabetically
    expect(mockChannel).toHaveBeenCalledWith(
      "team",
      expect.stringMatching(/^od_/),
      expect.objectContaining({ members: ["userA", "userB"] }),
    );
    expect(mockUpsertUser).toHaveBeenCalledTimes(2);
    expect(mockedChatSessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ORG_DIRECT",
        members: ["userA", "userB"],
      }),
    );
    expect(res).toBe(created);
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
    mockedChatSessionModel.create.mockResolvedValue(created);

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
    expect(mockedChatSessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ORG_GROUP", title: "Team" }),
    );
    expect(res).toBe(created);
  });
});

/* --------------------------- openChatBySessionId --------------------------- */

describe("ChatService.openChatBySessionId (Postgres path)", () => {
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

describe("ChatService.openChatBySessionId (Mongo path)", () => {
  beforeEach(() => mockedReadSwitch.mockReturnValue(false));

  it("opens a non-appointment Mongo chat for a member", async () => {
    mockedChatSessionModel.findById.mockResolvedValue({
      type: "ORG_GROUP",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
    });

    const res = await ChatService.openChatBySessionId("s1", "u1");
    expect(res.channelId).toBe("ch1");
  });

  it("throws 404 when the Mongo session is missing", async () => {
    mockedChatSessionModel.findById.mockResolvedValue(null);
    await expect(
      ChatService.openChatBySessionId("s1", "u1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("opens an appointment Mongo chat inside the window", async () => {
    const now = new Date();
    mockedChatSessionModel.findById.mockResolvedValue({
      type: "APPOINTMENT",
      status: "ACTIVE",
      members: ["u1"],
      channelId: "ch1",
      appointmentId: "a1",
      allowedFrom: new Date(now.getTime() - 1000),
      allowedUntil: new Date(now.getTime() + 60000),
    });
    mockedAppointmentModel.findById.mockResolvedValue({
      status: "IN_PROGRESS",
    });

    const res = await ChatService.openChatBySessionId("s1", "u1");
    expect(res.channelId).toBe("ch1");
  });
});

/* -------------------------------- closeSession ----------------------------- */

describe("ChatService.closeSession success paths", () => {
  it("closes via the Postgres path and posts a system message", async () => {
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

  it("closes via the Mongo path and saves the document", async () => {
    mockedReadSwitch.mockReturnValue(false);
    const save = jest.fn().mockResolvedValue(undefined);
    mockedChatSessionModel.findById.mockResolvedValue({
      type: "ORG_GROUP",
      createdBy: "owner",
      status: "ACTIVE",
      members: ["owner", "m2"],
      channelId: "ch1",
      save,
    });

    await ChatService.closeSession("s1", "owner");

    expect(save).toHaveBeenCalled();
  });

  it("is a no-op in the Mongo path when the session is missing", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue(null);

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

  it("returns early (Postgres) when there are no new members", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);

    const res = await ChatService.addMembersToGroup("s1", "owner", ["m2"]);

    expect(res).toBe(baseGroup);
    expect(mockAddMembers).not.toHaveBeenCalled();
    expect(mockedPrisma.chatSession.update).not.toHaveBeenCalled();
  });

  it("adds new members via the Postgres path", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    const updated = { ...baseGroup, members: ["owner", "m2", "m3"] };
    mockedPrisma.chatSession.update.mockResolvedValue(updated);

    const res = await ChatService.addMembersToGroup("s1", "owner", ["m3"]);

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { members: ["owner", "m2", "m3"] },
    });
    expect(mockAddMembers).toHaveBeenCalledWith(["m3"]);
    expect(res).toBe(updated);
  });

  it("throws 404 (Postgres) when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.addMembersToGroup("s1", "owner", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("adds new members via the Mongo path", async () => {
    mockedReadSwitch.mockReturnValue(false);
    const save = jest.fn().mockResolvedValue(undefined);
    const session = { ...baseGroup, members: ["owner", "m2"], save };
    mockedChatSessionModel.findById.mockResolvedValue(session);

    const res = await ChatService.addMembersToGroup("s1", "owner", ["m3"]);

    expect(save).toHaveBeenCalled();
    expect(mockAddMembers).toHaveBeenCalledWith(["m3"]);
    expect(res).toBe(session);
  });

  it("returns early (Mongo) when there are no new members", async () => {
    mockedReadSwitch.mockReturnValue(false);
    const session = { ...baseGroup, members: ["owner", "m2"], save: jest.fn() };
    mockedChatSessionModel.findById.mockResolvedValue(session);

    const res = await ChatService.addMembersToGroup("s1", "owner", ["m2"]);

    expect(res).toBe(session);
    expect(mockAddMembers).not.toHaveBeenCalled();
  });

  it("throws 404 (Mongo) when the session is missing", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue(null);
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

  it("removes a member via the Postgres path", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    const updated = { ...baseGroup, members: ["owner", "m2"] };
    mockedPrisma.chatSession.update.mockResolvedValue(updated);

    const res = await ChatService.removeMembersFromGroup("s1", "owner", ["m3"]);

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { members: ["owner", "m2"] },
    });
    expect(mockRemoveMembers).toHaveBeenCalledWith(["m3"]);
    expect(res).toBe(updated);
  });

  it("throws 400 (Postgres) when removing the owner", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["owner"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 (Postgres) when dropping below 2 members", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      ...baseGroup,
      members: ["owner", "m2"],
    });
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["m2"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 (Postgres) when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["m3"]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("removes a member via the Mongo path", async () => {
    mockedReadSwitch.mockReturnValue(false);
    const save = jest.fn().mockResolvedValue(undefined);
    const session = {
      ...baseGroup,
      members: ["owner", "m2", "m3"],
      save,
    };
    mockedChatSessionModel.findById.mockResolvedValue(session);

    const res = await ChatService.removeMembersFromGroup("s1", "owner", ["m3"]);

    expect(save).toHaveBeenCalled();
    expect(mockRemoveMembers).toHaveBeenCalledWith(["m3"]);
    expect(res).toBe(session);
  });

  it("throws 400 (Mongo) when removing the owner", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue({
      ...baseGroup,
      members: ["owner", "m2", "m3"],
      save: jest.fn(),
    });
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["owner"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 (Mongo) when dropping below 2 members", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue({
      ...baseGroup,
      members: ["owner", "m2"],
      save: jest.fn(),
    });
    await expect(
      ChatService.removeMembersFromGroup("s1", "owner", ["m2"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 (Mongo) when the session is missing", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue(null);
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

  it("updates title and privacy via the Postgres path", async () => {
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
    expect(res).toBe(updated);
  });

  it("falls back to existing values when updates are omitted (Postgres)", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    mockedPrisma.chatSession.update.mockResolvedValue(baseGroup);

    await ChatService.updateGroup("s1", "owner", {});

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { title: "Old", isPrivate: true },
    });
  });

  it("throws 404 (Postgres) when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);
    await expect(
      ChatService.updateGroup("s1", "owner", { title: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("updates via the Mongo path and saves", async () => {
    mockedReadSwitch.mockReturnValue(false);
    const save = jest.fn().mockResolvedValue(undefined);
    const session = { ...baseGroup, save };
    mockedChatSessionModel.findById.mockResolvedValue(session);

    const res = await ChatService.updateGroup("s1", "owner", {
      title: "New",
      isPrivate: false,
    });

    expect(session.title).toBe("New");
    expect(session.isPrivate).toBe(false);
    expect(save).toHaveBeenCalled();
    expect(mockUpdatePartial).toHaveBeenCalled();
    expect(res).toBe(session);
  });

  it("leaves fields untouched when updates omitted (Mongo)", async () => {
    mockedReadSwitch.mockReturnValue(false);
    const save = jest.fn().mockResolvedValue(undefined);
    const session = { ...baseGroup, save };
    mockedChatSessionModel.findById.mockResolvedValue(session);

    await ChatService.updateGroup("s1", "owner", {});

    expect(session.title).toBe("Old");
    expect(session.isPrivate).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  it("throws 404 (Mongo) when the session is missing", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue(null);
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

  it("deletes via the Postgres path", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    mockedPrisma.chatSession.deleteMany.mockResolvedValue({ count: 1 });

    await ChatService.deleteGroup("s1", "owner");

    expect(mockDelete).toHaveBeenCalled();
    expect(mockedPrisma.chatSession.deleteMany).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });

  it("swallows Stream delete errors (Postgres) and still cleans the DB", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(baseGroup);
    mockDelete.mockRejectedValue(new Error("stream down"));
    mockedPrisma.chatSession.deleteMany.mockResolvedValue({ count: 1 });

    await ChatService.deleteGroup("s1", "owner");

    expect(mockedPrisma.chatSession.deleteMany).toHaveBeenCalled();
  });

  it("is a no-op (Postgres) when the session is missing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.deleteGroup("s1", "owner"),
    ).resolves.toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes via the Mongo path", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue(baseGroup);
    const deleteOne = jest.fn().mockResolvedValue({});
    (mockedChatSessionModel as unknown as { deleteOne: jest.Mock }).deleteOne =
      deleteOne;

    await ChatService.deleteGroup("s1", "owner");

    expect(mockDelete).toHaveBeenCalled();
    expect(deleteOne).toHaveBeenCalledWith({ _id: "s1" });
  });

  it("is a no-op (Mongo) when the session is missing", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedChatSessionModel.findById.mockResolvedValue(null);

    await expect(
      ChatService.deleteGroup("s1", "owner"),
    ).resolves.toBeUndefined();
  });
});
