const mockUpsertUser = jest.fn();
const mockCreate = jest.fn();
const mockChannel = jest.fn(() => ({
  create: mockCreate,
}));

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: () => ({
      channel: mockChannel,
      upsertUser: mockUpsertUser,
    }),
  },
}));

jest.mock("src/models/chatSession", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() },
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
let mockDualWriteEnabled = false;
jest.mock("src/utils/dual-write", () => ({
  handleDualWriteError: jest.fn(),
  get shouldDualWrite() {
    return mockDualWriteEnabled;
  },
}));
jest.mock("src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => true),
}));
jest.mock("src/config/prisma", () => ({
  prisma: {
    userOrganization: { findFirst: jest.fn(), findMany: jest.fn() },
    organization: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    chatSession: { upsert: jest.fn() },
  },
}));

import { NetworkChatService } from "src/services/networkChat.service";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import ChatSessionModel from "src/models/chatSession";
import UserOrganizationModel from "src/models/user-organization";
import { UserProfileService } from "src/services/user-profile.service";
import { UserService } from "src/services/user.service";

const mockedPrisma = prisma as unknown as {
  userOrganization: { findFirst: jest.Mock; findMany: jest.Mock };
  organization: { findFirst: jest.Mock; findMany: jest.Mock };
  user: { findFirst: jest.Mock };
  chatSession: { upsert: jest.Mock };
};
const mockedReadSwitch = isReadFromPostgres as unknown as jest.Mock;
const mockedChatSessionModel = ChatSessionModel as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
};
const mockedUserOrgModel = UserOrganizationModel as unknown as {
  findOne: jest.Mock;
};
const mockedUserProfile = UserProfileService.getByUserId as jest.Mock;
const mockedUserService = UserService.getById as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedReadSwitch.mockReturnValue(true);
  mockDualWriteEnabled = false;
});

describe("NetworkChatService.searchNetworkColleagues", () => {
  it("rejects with 403 when the requester is not an active member", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue(null);

    await expect(
      NetworkChatService.searchNetworkColleagues({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        query: "",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects with 403 when cross-clinic messaging is disabled for the clinic", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "org1",
      name: "Clinic 1",
      crossOrgMessagingEnabled: false,
    });

    await expect(
      NetworkChatService.searchNetworkColleagues({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        query: "",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedPrisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("returns cross-org colleagues, excluding the requester's own org, filtered by query", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "org1",
      name: "Clinic 1",
      crossOrgMessagingEnabled: true,
    });
    mockedPrisma.organization.findMany.mockResolvedValue([
      { id: "org2", name: "Clinic 2" },
    ]);
    mockedPrisma.userOrganization.findMany.mockResolvedValue([
      {
        practitionerReference: "Practitioner/vet-jane",
        organizationReference: "Organization/org2",
        roleCode: "VETERINARIAN",
        roleDisplay: "Veterinarian",
      },
      {
        practitionerReference: "tech-bob",
        organizationReference: "org2",
        roleCode: "TECHNICIAN",
        roleDisplay: null,
      },
    ]);
    mockedPrisma.user.findFirst
      .mockResolvedValueOnce({ firstName: "Jane", lastName: "Doe" })
      .mockResolvedValueOnce({ firstName: "Bob", lastName: "Smith" });

    const result = await NetworkChatService.searchNetworkColleagues({
      requesterUserId: "userA",
      requesterOrgId: "org1",
      query: "jane",
    });

    // org1 is excluded via the prisma findMany `id: { not: requesterOrgId }`.
    expect(mockedPrisma.organization.findMany).toHaveBeenCalledWith({
      where: {
        crossOrgMessagingEnabled: true,
        id: { not: "org1" },
      },
      select: { id: true, name: true },
    });
    // both org-ref forms are queried for the other org.
    expect(mockedPrisma.userOrganization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          organizationReference: { in: ["org2", "Organization/org2"] },
        }),
      }),
    );
    expect(result.colleagues).toEqual([
      {
        userId: "vet-jane",
        name: "Jane Doe",
        role: "Veterinarian",
        organisationId: "org2",
        organisationName: "Clinic 2",
      },
    ]);
  });

  it("returns all cross-org colleagues when no query is supplied", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "org1",
      name: "Clinic 1",
      crossOrgMessagingEnabled: true,
    });
    mockedPrisma.organization.findMany.mockResolvedValue([
      { id: "org2", name: "Clinic 2" },
    ]);
    mockedPrisma.userOrganization.findMany.mockResolvedValue([
      {
        practitionerReference: "vet-jane",
        organizationReference: "Organization/org2",
        roleCode: "VETERINARIAN",
        roleDisplay: "Veterinarian",
      },
      {
        practitionerReference: "tech-bob",
        organizationReference: "org2",
        roleCode: "TECHNICIAN",
        roleDisplay: null,
      },
    ]);
    mockedPrisma.user.findFirst
      .mockResolvedValueOnce({ firstName: "Jane", lastName: "Doe" })
      .mockResolvedValueOnce({ firstName: "Bob", lastName: "Smith" });

    const result = await NetworkChatService.searchNetworkColleagues({
      requesterUserId: "userA",
      requesterOrgId: "org1",
    });

    expect(result.colleagues).toHaveLength(2);
    // role falls back to roleCode when roleDisplay is null.
    expect(result.colleagues[1]).toMatchObject({
      userId: "tech-bob",
      role: "TECHNICIAN",
    });
  });

  it("returns an empty list when there are no other cross-org clinics", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "org1",
      name: "Clinic 1",
      crossOrgMessagingEnabled: true,
    });
    mockedPrisma.organization.findMany.mockResolvedValue([]);

    const result = await NetworkChatService.searchNetworkColleagues({
      requesterUserId: "userA",
      requesterOrgId: "org1",
      query: "",
    });

    expect(result.colleagues).toEqual([]);
    expect(mockedPrisma.userOrganization.findMany).not.toHaveBeenCalled();
  });

  it("probes membership through the Mongo path when not reading from Postgres", async () => {
    mockedReadSwitch.mockReturnValue(false);
    mockedUserOrgModel.findOne.mockResolvedValue(null);

    await expect(
      NetworkChatService.searchNetworkColleagues({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        query: "",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedUserOrgModel.findOne).toHaveBeenCalled();
    expect(mockedPrisma.userOrganization.findFirst).not.toHaveBeenCalled();
  });
});

describe("NetworkChatService.createNetworkDirectChat", () => {
  const bothOrgsEnabled = () => {
    // requester membership, other membership both pass.
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          name: `Clinic ${where.id}`,
          crossOrgMessagingEnabled: true,
        }),
    );
  };

  it("rejects with 400 when both orgs are the same", async () => {
    await expect(
      NetworkChatService.createNetworkDirectChat({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        otherUserId: "userB",
        otherOrgId: "org1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the requester is not a member of their org", async () => {
    mockedPrisma.userOrganization.findFirst
      .mockResolvedValueOnce(null) // requester membership
      .mockResolvedValue({ id: "m2" }); // other membership
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "org1",
      name: "Clinic",
      crossOrgMessagingEnabled: true,
    });

    await expect(
      NetworkChatService.createNetworkDirectChat({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        otherUserId: "userB",
        otherOrgId: "org2",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the requester's org has cross-clinic disabled", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          name: `Clinic ${where.id}`,
          crossOrgMessagingEnabled: where.id === "org2",
        }),
    );

    await expect(
      NetworkChatService.createNetworkDirectChat({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        otherUserId: "userB",
        otherOrgId: "org2",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the other org has cross-clinic disabled", async () => {
    mockedPrisma.userOrganization.findFirst.mockResolvedValue({ id: "m1" });
    mockedPrisma.organization.findFirst.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          name: `Clinic ${where.id}`,
          crossOrgMessagingEnabled: where.id === "org1",
        }),
    );

    await expect(
      NetworkChatService.createNetworkDirectChat({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        otherUserId: "userB",
        otherOrgId: "org2",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("returns the existing session when one already exists (dedupe)", async () => {
    bothOrgsEnabled();
    const existing = { id: "existing", members: ["userA", "userB"] };
    mockedChatSessionModel.findOne.mockResolvedValue(existing);

    const result = await NetworkChatService.createNetworkDirectChat({
      requesterUserId: "userA",
      requesterOrgId: "org1",
      otherUserId: "userB",
      otherOrgId: "org2",
    });

    expect(result).toBe(existing);
    expect(mockChannel).not.toHaveBeenCalled();
    expect(mockedChatSessionModel.create).not.toHaveBeenCalled();
  });

  it("creates a Stream channel and a cross-org session when both flags are true", async () => {
    bothOrgsEnabled();
    mockedChatSessionModel.findOne.mockResolvedValue(null);
    mockedUserProfile.mockResolvedValue({
      profile: { personalDetails: { profilePictureUrl: "pic" } },
    });
    mockedUserService.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
    });
    const created = {
      id: "new",
      toObject: () => ({}),
    };
    mockedChatSessionModel.create.mockResolvedValue(created);

    const result = await NetworkChatService.createNetworkDirectChat({
      requesterUserId: "userA",
      requesterOrgId: "org1",
      otherUserId: "userB",
      otherOrgId: "org2",
    });

    expect(mockUpsertUser).toHaveBeenCalledTimes(2);
    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockedChatSessionModel.create.mock.calls[0][0];
    expect(createArgs).toMatchObject({
      type: "ORG_DIRECT",
      organisationId: "org1",
      counterpartOrganisationId: "org2",
      members: ["userA", "userB"],
      createdBy: "userA",
      isPrivate: true,
      status: "ACTIVE",
    });
    expect(createArgs.channelId).toMatch(/^nd_/);
    expect(result).toBe(created);
  });

  it("rejects with 400 when a user tries to chat with themselves", async () => {
    await expect(
      NetworkChatService.createNetworkDirectChat({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        otherUserId: "userA",
        otherOrgId: "org2",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("dual-writes the new session to Postgres when dual-write is enabled", async () => {
    mockDualWriteEnabled = true;
    bothOrgsEnabled();
    mockedChatSessionModel.findOne.mockResolvedValue(null);
    mockedUserProfile.mockResolvedValue({
      profile: { personalDetails: { profilePictureUrl: "pic" } },
    });
    mockedUserService.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
    });
    mockedChatSessionModel.create.mockResolvedValue({
      id: "new",
      toObject: () => ({
        _id: { toString: () => "sess-1" },
        type: "ORG_DIRECT",
        channelId: "nd_x",
        organisationId: "org1",
        counterpartOrganisationId: "org2",
        createdBy: "userA",
        isPrivate: true,
        members: ["userA", "userB"],
        status: "ACTIVE",
      }),
    });

    await NetworkChatService.createNetworkDirectChat({
      requesterUserId: "userA",
      requesterOrgId: "org1",
      otherUserId: "userB",
      otherOrgId: "org2",
    });

    expect(mockedPrisma.chatSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1" },
        create: expect.objectContaining({
          id: "sess-1",
          counterpartOrganisationId: "org2",
          members: ["userA", "userB"],
        }),
      }),
    );
  });

  it("swallows a Postgres dual-write failure via handleDualWriteError", async () => {
    mockDualWriteEnabled = true;
    bothOrgsEnabled();
    mockedChatSessionModel.findOne.mockResolvedValue(null);
    mockedUserProfile.mockResolvedValue({ profile: { personalDetails: {} } });
    mockedUserService.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
    });
    mockedChatSessionModel.create.mockResolvedValue({
      id: "new",
      toObject: () => ({
        _id: { toString: () => "sess-2" },
        type: "ORG_DIRECT",
        channelId: "nd_y",
        organisationId: "org1",
        members: ["userA", "userB"],
        status: "ACTIVE",
      }),
    });
    mockedPrisma.chatSession.upsert.mockRejectedValueOnce(new Error("db down"));

    await expect(
      NetworkChatService.createNetworkDirectChat({
        requesterUserId: "userA",
        requesterOrgId: "org1",
        otherUserId: "userB",
        otherOrgId: "org2",
      }),
    ).resolves.toBeDefined();

    const dualWrite = jest.requireMock("src/utils/dual-write") as {
      handleDualWriteError: jest.Mock;
    };
    expect(dualWrite.handleDualWriteError).toHaveBeenCalledWith(
      "ChatSession",
      expect.any(Error),
    );
  });
});
