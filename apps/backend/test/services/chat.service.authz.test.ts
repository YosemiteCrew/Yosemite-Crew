const mockUpsertUser = jest.fn();
const mockSendMessage = jest.fn();
const mockUpdatePartial = jest.fn();
const mockAddMembers = jest.fn();
const mockChannel = jest.fn(() => ({
  sendMessage: mockSendMessage,
  updatePartial: mockUpdatePartial,
  addMembers: mockAddMembers,
  create: jest.fn(),
}));

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: () => ({
      channel: mockChannel,
      upsertUser: mockUpsertUser,
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
    chatSession: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  },
}));

import { ChatService } from "src/services/chat.service";
import { prisma } from "src/config/prisma";

const mockedPrisma = prisma as unknown as {
  userOrganization: { findFirst: jest.Mock };
  chatSession: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ChatService org-membership enforcement", () => {
  it("createOrgDirectChat rejects when the actor is not in the org", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.createOrgDirectChat("org1", "userA", "userB"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("createOrgGroupChat rejects when a member is not in the org", async () => {
    mockedPrisma.userOrganization.findFirst
      .mockResolvedValueOnce({ id: "m1" })
      .mockResolvedValue(null);

    await expect(
      ChatService.createOrgGroupChat({
        organisationId: "org1",
        createdBy: "owner",
        title: "Team",
        memberIds: ["owner", "outsider"],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("addMembersToGroup rejects adding a user who is not in the org", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      id: "s1",
      type: "ORG_GROUP",
      createdBy: "owner",
      status: "ACTIVE",
      members: ["owner"],
      organisationId: "org1",
      channelId: "ch1",
    });
    mockedPrisma.userOrganization.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.addMembersToGroup("s1", "owner", ["outsider"]),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockAddMembers).not.toHaveBeenCalled();
  });
});

describe("ChatService.closeSession authorization", () => {
  const appointmentSession = {
    id: "s1",
    type: "APPOINTMENT",
    createdBy: "vet",
    status: "ACTIVE",
    members: ["vet", "parent"],
    channelId: "ch1",
  };
  const groupSession = {
    id: "s1",
    type: "ORG_GROUP",
    createdBy: "owner",
    status: "ACTIVE",
    members: ["owner", "member2"],
    channelId: "ch1",
  };

  it("lets a member close an appointment chat", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(appointmentSession);
    mockedPrisma.chatSession.update.mockResolvedValue({});

    await ChatService.closeSession("s1", "parent");

    expect(mockedPrisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ status: "CLOSED" }),
    });
  });

  it("rejects a non-member trying to close an appointment chat", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(appointmentSession);

    await expect(
      ChatService.closeSession("s1", "intruder"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedPrisma.chatSession.update).not.toHaveBeenCalled();
  });

  it("lets the owner close a group chat", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(groupSession);
    mockedPrisma.chatSession.update.mockResolvedValue({});

    await ChatService.closeSession("s1", "owner");

    expect(mockedPrisma.chatSession.update).toHaveBeenCalled();
  });

  it("rejects a non-owner trying to close a group chat", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(groupSession);

    await expect(
      ChatService.closeSession("s1", "member2"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedPrisma.chatSession.update).not.toHaveBeenCalled();
  });

  it("is a no-op when the session does not exist", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(
      ChatService.closeSession("missing", "u1"),
    ).resolves.toBeUndefined();
  });
});
