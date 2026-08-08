const fetchMock = jest.fn();
const warnMock = jest.fn();
const errorMock = jest.fn();

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: errorMock,
    info: jest.fn(),
    warn: warnMock,
    debug: jest.fn(),
  },
}));

type FetchLike = typeof fetch;

const makeResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const importService = async () => {
  jest.resetModules();
  return import("../../src/services/marketing-discord.service");
};

describe("DiscordMembersService", () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as FetchLike;
    fetchMock.mockReset();
    Date.now = originalNow;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  });

  it("fetches, formats, and caches the Discord member count", async () => {
    const { DiscordMembersService } = await importService();
    Date.now = jest.fn(() => 1_000) as unknown as typeof Date.now;
    fetchMock.mockResolvedValueOnce(
      makeResponse({ approximate_member_count: 3210 }),
    );

    await expect(DiscordMembersService.getDiscordMembers()).resolves.toBe(
      "3,210",
    );
    await expect(DiscordMembersService.getDiscordMembers()).resolves.toBe(
      "3,210",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/invites/SwM6mX85KD?with_counts=true&with_expiration=true",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "User-Agent": "DiscordBot (https://www.yosemitecrew.com, 1.0)",
        }),
      }),
    );
  });

  it("refreshes the cached value after the TTL expires", async () => {
    const { DiscordMembersService } = await importService();
    const now = jest.fn();
    Date.now = now as unknown as typeof Date.now;

    now.mockReturnValueOnce(1_000);
    fetchMock.mockResolvedValueOnce(
      makeResponse({ approximate_member_count: 111 }),
    );
    await expect(DiscordMembersService.getDiscordMembers()).resolves.toBe(
      "111",
    );

    now.mockReturnValueOnce(1_000 + 5 * 60 * 1000 + 1);
    fetchMock.mockResolvedValueOnce(
      makeResponse({ approximate_member_count: 222 }),
    );
    await expect(DiscordMembersService.getDiscordMembers()).resolves.toBe(
      "222",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the vanity invite when the docs invite is unavailable", async () => {
    const { DiscordMembersService } = await importService();
    Date.now = jest.fn(() => 1_000) as unknown as typeof Date.now;

    fetchMock
      .mockResolvedValueOnce(makeResponse({}, false, 404))
      .mockResolvedValueOnce(makeResponse({ approximate_member_count: 4444 }));

    await expect(DiscordMembersService.getDiscordMembers()).resolves.toBe(
      "4,444",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://discord.com/api/v10/invites/SwM6mX85KD?with_counts=true&with_expiration=true",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://discord.com/api/v10/invites/yosemitecrew?with_counts=true&with_expiration=true",
      expect.any(Object),
    );
  });

  it.each([
    ["non-ok response", makeResponse({}, false, 503)],
    ["missing count", makeResponse({ approximate_presence_count: 9 })],
    ["thrown fetch", new Error("network down")],
  ])("returns null when Discord lookup fails: %s", async (_label, outcome) => {
    const { DiscordMembersService } = await importService();
    Date.now = jest.fn(() => 1_000) as unknown as typeof Date.now;

    if (outcome instanceof Error) {
      fetchMock.mockRejectedValueOnce(outcome);
    } else {
      fetchMock.mockResolvedValueOnce(outcome);
    }

    await expect(DiscordMembersService.getDiscordMembers()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(outcome instanceof Error ? 1 : 2);
  });
});
