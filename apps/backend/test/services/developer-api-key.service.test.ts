import {
  DeveloperApiKeyService,
  DeveloperApiKeyServiceError,
} from "../../src/services/developer-api-key.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerApiKey: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn(),
    // `issue` counts and inserts inside one transaction so the active-key
    // ceiling cannot be raced. Running the callback against the same mocked
    // client keeps the assertions below about `developerApiKey.*` unchanged.
    $transaction: jest.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  developerApiKey: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
};

describe("DeveloperApiKeyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.developerApiKey.count.mockResolvedValue(0);
    mockPrisma.$executeRaw.mockResolvedValue(1);
    // `verify` refuses a key whose owner has been deleted; default to a live
    // account so the existing cases exercise the paths they were written for.
    mockPrisma.user.findFirst.mockResolvedValue({ isActive: true });
    mockPrisma.$transaction.mockImplementation(
      (run: (tx: unknown) => unknown) => run(prisma),
    );
    process.env.DEVELOPER_API_KEY_PEPPER = "test-pepper";
  });

  describe("issue", () => {
    it("stores the hash (never the plaintext) and returns the plaintext once", async () => {
      mockPrisma.developerApiKey.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: "key-1",
          name: data.name,
          prefix: data.prefix,
          last4: data.last4,
          scopes: data.scopes,
          environment: data.environment,
        }),
      );

      const issued = await DeveloperApiKeyService.issue({
        ownerUserId: "org-1",
        name: "CI key",
        createdBy: "user-1",
        scopes: ["appointments:read"],
      });

      expect(issued.apiKey).toMatch(/^yc_live_/);
      expect(issued.prefix).toMatch(/^yc_live_/);
      expect(issued.last4).toHaveLength(4);

      const createData =
        mockPrisma.developerApiKey.create.mock.calls[0][0].data;
      expect(createData.hashedKey).toHaveLength(64); // sha-256 hex
      expect(createData.hashedKey).not.toEqual(issued.apiKey);
      expect(createData).not.toHaveProperty("apiKey");
    });

    it("defaults environment to live and scopes to empty", async () => {
      mockPrisma.developerApiKey.create.mockResolvedValue({
        id: "k",
        name: "n",
        prefix: "yc_live_x",
        last4: "abcd",
        scopes: [],
        environment: "live",
      });

      await DeveloperApiKeyService.issue({
        ownerUserId: "org-1",
        name: "n",
        createdBy: "u",
      });

      expect(mockPrisma.developerApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ environment: "live", scopes: [] }),
        }),
      );
    });

    it("supports the test environment prefix", async () => {
      mockPrisma.developerApiKey.create.mockResolvedValue({
        id: "k",
        name: "n",
        prefix: "yc_test_x",
        last4: "abcd",
        scopes: [],
        environment: "test",
      });

      const issued = await DeveloperApiKeyService.issue({
        ownerUserId: "org-1",
        name: "n",
        createdBy: "u",
        environment: "test" as never,
      });

      expect(issued.apiKey).toMatch(/^yc_test_/);
    });

    it("refuses a 26th active key", async () => {
      mockPrisma.developerApiKey.count.mockResolvedValue(25);

      await expect(
        DeveloperApiKeyService.issue({
          ownerUserId: "user-1",
          name: "n",
          createdBy: "user-1",
        }),
      ).rejects.toMatchObject({ statusCode: 429 });
      expect(mockPrisma.developerApiKey.create).not.toHaveBeenCalled();
    });

    it("excludes expired keys from the ceiling", async () => {
      // 25 keys that verify() would reject as expired must not block a usable
      // replacement, so the count carries the expiry predicate.
      mockPrisma.developerApiKey.create.mockResolvedValue({
        id: "k",
        name: "n",
        prefix: "yc_live_x",
        last4: "abcd",
        scopes: [],
        environment: "live",
      });

      await DeveloperApiKeyService.issue({
        ownerUserId: "user-1",
        name: "n",
        createdBy: "user-1",
      });

      const where = mockPrisma.developerApiKey.count.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { expiresAt: null },
        { expiresAt: { gt: expect.any(Date) } },
      ]);
    });

    it("counts and inserts inside one transaction, behind a per-owner lock", async () => {
      // Without this the ceiling is advisory only: two concurrent requests can
      // each read the same sub-limit count and both insert.
      mockPrisma.developerApiKey.create.mockResolvedValue({
        id: "k",
        name: "n",
        prefix: "yc_live_x",
        last4: "abcd",
        scopes: [],
        environment: "live",
      });

      await DeveloperApiKeyService.issue({
        ownerUserId: "user-1",
        name: "n",
        createdBy: "user-1",
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      const [strings, lockKey] = mockPrisma.$executeRaw.mock.calls[0];
      expect(strings.join("")).toContain("pg_advisory_xact_lock");
      expect(lockKey).toBe("developer-api-key:user-1");
      expect(mockPrisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockPrisma.developerApiKey.count.mock.invocationCallOrder[0],
      );
      expect(
        mockPrisma.developerApiKey.count.mock.invocationCallOrder[0],
      ).toBeLessThan(
        mockPrisma.developerApiKey.create.mock.invocationCallOrder[0],
      );
    });

    it.each([
      ["ownerUserId", { ownerUserId: "", name: "n", createdBy: "u" }],
      ["name", { ownerUserId: "o", name: "  ", createdBy: "u" }],
      ["createdBy", { ownerUserId: "o", name: "n", createdBy: "" }],
    ])("rejects an empty %s", async (_field, input) => {
      await expect(
        DeveloperApiKeyService.issue(input as never),
      ).rejects.toBeInstanceOf(DeveloperApiKeyServiceError);
      expect(mockPrisma.developerApiKey.create).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns org keys without secret columns", async () => {
      mockPrisma.developerApiKey.findMany.mockResolvedValue([{ id: "k1" }]);
      const result = await DeveloperApiKeyService.list("org-1");

      expect(result).toEqual([{ id: "k1" }]);
      const arg = mockPrisma.developerApiKey.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ ownerUserId: "org-1" });
      expect(arg.orderBy).toEqual({ createdAt: "desc" });
      expect(arg.select.hashedKey).toBeUndefined();
    });

    it("rejects an empty org", async () => {
      await expect(DeveloperApiKeyService.list("")).rejects.toBeInstanceOf(
        DeveloperApiKeyServiceError,
      );
    });
  });

  describe("revoke", () => {
    it("revokes an active key scoped to the org", async () => {
      mockPrisma.developerApiKey.updateMany.mockResolvedValue({ count: 1 });
      await expect(
        DeveloperApiKeyService.revoke({ ownerUserId: "o", keyId: "k" }),
      ).resolves.toBeUndefined();
      expect(mockPrisma.developerApiKey.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "k",
            ownerUserId: "o",
            status: "active",
          }),
        }),
      );
    });

    it("throws 404 when nothing matched", async () => {
      mockPrisma.developerApiKey.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        DeveloperApiKeyService.revoke({ ownerUserId: "o", keyId: "k" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("key digest", () => {
    const lookupHashFor = async (pepper: string): Promise<string> => {
      process.env.DEVELOPER_API_KEY_PEPPER = pepper;
      mockPrisma.developerApiKey.findUnique.mockResolvedValue(null);
      await DeveloperApiKeyService.verify("yc_live_fixed-plaintext");
      const [{ where }] = mockPrisma.developerApiKey.findUnique.mock
        .calls[0] as [{ where: { hashedKey: string } }];
      return where.hashedKey;
    };

    it("is deterministic, so the indexed lookup in verify can match it", async () => {
      const first = await lookupHashFor("pepper-a");
      jest.clearAllMocks();
      const second = await lookupHashFor("pepper-a");

      expect(first).toBe(second);
    });

    it("is keyed by the pepper — the same key hashes differently under another", async () => {
      const underA = await lookupHashFor("pepper-a");
      jest.clearAllMocks();
      const underB = await lookupHashFor("pepper-b");

      // The point of the pepper: a stolen table of digests cannot be matched
      // against candidates computed without it.
      expect(underA).not.toBe(underB);
    });

    it("fails closed when the pepper is unset rather than falling back to an unkeyed digest", async () => {
      delete process.env.DEVELOPER_API_KEY_PEPPER;

      await expect(
        DeveloperApiKeyService.verify("yc_live_whatever"),
      ).rejects.toMatchObject({ statusCode: 500 });
      expect(mockPrisma.developerApiKey.findUnique).not.toHaveBeenCalled();
    });

    it("fails closed on issue when the pepper is unset", async () => {
      delete process.env.DEVELOPER_API_KEY_PEPPER;

      await expect(
        DeveloperApiKeyService.issue({
          ownerUserId: "org-1",
          name: "k",
          createdBy: "user-1",
        }),
      ).rejects.toMatchObject({ statusCode: 500 });
      expect(mockPrisma.developerApiKey.create).not.toHaveBeenCalled();
    });
  });

  describe("verify", () => {
    const activeRecord = {
      id: "key-1",
      ownerUserId: "org-1",
      scopes: ["a"],
      environment: "live",
      status: "active",
      expiresAt: null,
      lastUsedAt: null,
    };

    it("returns null for a non-yc key without touching the DB", async () => {
      expect(await DeveloperApiKeyService.verify("nope")).toBeNull();
      expect(mockPrisma.developerApiKey.findUnique).not.toHaveBeenCalled();
    });

    it("returns null for a non-string key", async () => {
      expect(
        await DeveloperApiKeyService.verify(undefined as never),
      ).toBeNull();
    });

    it("returns null for an unknown key", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue(null);
      expect(await DeveloperApiKeyService.verify("yc_live_x")).toBeNull();
    });

    it("returns null for a revoked key", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        ...activeRecord,
        status: "revoked",
      });
      expect(await DeveloperApiKeyService.verify("yc_live_x")).toBeNull();
    });

    it("returns null for an expired key", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        ...activeRecord,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await DeveloperApiKeyService.verify("yc_live_x")).toBeNull();
    });

    it("returns the context and refreshes a stale lastUsedAt", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        ...activeRecord,
        lastUsedAt: null,
      });
      mockPrisma.developerApiKey.update.mockResolvedValue({});

      const result = await DeveloperApiKeyService.verify("yc_live_x");
      expect(result).toEqual({
        id: "key-1",
        ownerUserId: "org-1",
        scopes: ["a"],
        environment: "live",
      });
      expect(mockPrisma.developerApiKey.update).toHaveBeenCalled();
    });

    it("refuses a key whose owner account has been deleted", async () => {
      // Deletion is a soft delete and does not revoke the session, so the key
      // stays syntactically valid. The data API must stop answering for it.
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        id: "k1",
        ownerUserId: "user-gone",
        status: "active",
        expiresAt: null,
        scopes: [],
        environment: "live",
        lastUsedAt: new Date(),
      });
      mockPrisma.user.findFirst.mockResolvedValue({ isActive: false });

      await expect(
        DeveloperApiKeyService.verify("yc_live_whatever"),
      ).resolves.toBeNull();
    });

    it("refuses a key whose owner row no longer exists", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        id: "k1",
        ownerUserId: "user-gone",
        status: "active",
        expiresAt: null,
        scopes: [],
        environment: "live",
        lastUsedAt: new Date(),
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        DeveloperApiKeyService.verify("yc_live_whatever"),
      ).resolves.toBeNull();
    });

    it("does not refresh a fresh lastUsedAt", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        ...activeRecord,
        lastUsedAt: new Date(),
      });
      await DeveloperApiKeyService.verify("yc_live_x");
      expect(mockPrisma.developerApiKey.update).not.toHaveBeenCalled();
    });

    it("swallows a lastUsedAt update failure", async () => {
      mockPrisma.developerApiKey.findUnique.mockResolvedValue({
        ...activeRecord,
        lastUsedAt: null,
      });
      mockPrisma.developerApiKey.update.mockRejectedValue(new Error("db down"));
      expect(await DeveloperApiKeyService.verify("yc_live_x")).not.toBeNull();
    });
  });
});
