const mockUpsertUser = jest.fn();

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: () => ({ upsertUser: mockUpsertUser }),
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
    chatSession: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

import { ChatService, upsertChatUsers } from "src/services/chat.service";
import { prisma } from "src/config/prisma";
import { UserProfileService } from "src/services/user-profile.service";
import { UserService } from "src/services/user.service";

const mockedFindMembership = prisma.userOrganization.findFirst as jest.Mock;
const mockedGetProfile = UserProfileService.getByUserId as jest.Mock;
const mockedGetUser = UserService.getById as jest.Mock;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsertUser.mockResolvedValue(undefined);
  mockedGetProfile.mockResolvedValue(null);
  mockedGetUser.mockImplementation(async (userId: string) => ({
    firstName: userId,
  }));
});

describe("upsertChatUsers", () => {
  it("reads profiles together but upserts members in the order given", async () => {
    const slow = deferred<null>();
    mockedGetProfile.mockImplementation((userId: string) =>
      userId === "first" ? slow.promise : Promise.resolve(null),
    );

    const done = upsertChatUsers([
      { userId: "first", organisationId: "org-a" },
      { userId: "second", organisationId: "org-b" },
    ]);
    await flush();

    // Both profile reads are in flight before the first one settles, and
    // nothing reaches Stream until every profile is known.
    expect(mockedGetProfile).toHaveBeenCalledWith("first", "org-a");
    expect(mockedGetProfile).toHaveBeenCalledWith("second", "org-b");
    expect(mockUpsertUser).not.toHaveBeenCalled();

    slow.resolve(null);
    await done;

    expect(mockUpsertUser.mock.calls.map(([user]) => user.id)).toEqual([
      "first",
      "second",
    ]);
    expect(mockUpsertUser).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "second", name: "second" }),
    );
  });

  it("waits for each Stream upsert before starting the next", async () => {
    const firstUpsert = deferred<undefined>();
    mockUpsertUser.mockReturnValueOnce(firstUpsert.promise);

    const done = upsertChatUsers([
      { userId: "first", organisationId: "org-a" },
      { userId: "second", organisationId: "org-a" },
    ]);
    await flush();

    expect(mockUpsertUser).toHaveBeenCalledTimes(1);

    firstUpsert.resolve(undefined);
    await done;

    expect(mockUpsertUser).toHaveBeenCalledTimes(2);
  });

  it("stops at the first failed upsert and rejects with its error", async () => {
    mockUpsertUser.mockRejectedValueOnce(new Error("stream down"));

    await expect(
      upsertChatUsers([
        { userId: "first", organisationId: "org-a" },
        { userId: "second", organisationId: "org-a" },
      ]),
    ).rejects.toThrow("stream down");

    expect(mockUpsertUser).toHaveBeenCalledTimes(1);
  });

  it("upserts nobody when a profile read fails", async () => {
    mockedGetUser.mockRejectedValueOnce(new Error("db down"));

    await expect(
      upsertChatUsers([
        { userId: "first", organisationId: "org-a" },
        { userId: "second", organisationId: "org-a" },
      ]),
    ).rejects.toThrow("db down");

    expect(mockUpsertUser).not.toHaveBeenCalled();
  });
});

describe("ChatService org membership check", () => {
  it("checks every member together and rejects when any one is outside the org", async () => {
    const pending = [deferred<{ id: string } | null>()];
    mockedFindMembership
      .mockReturnValueOnce(pending[0].promise)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "m3" });

    const attempt = ChatService.createOrgGroupChat({
      organisationId: "org1",
      createdBy: "owner",
      title: "Team",
      memberIds: ["a", "b"],
    });
    await flush();

    // All three lookups start before the first one answers.
    expect(mockedFindMembership).toHaveBeenCalledTimes(3);

    pending[0].resolve({ id: "m1" });
    await expect(attempt).rejects.toMatchObject({ statusCode: 403 });
    expect(mockUpsertUser).not.toHaveBeenCalled();
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
  });
});
