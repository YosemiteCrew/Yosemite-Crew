import {
  DeveloperApiKeyService,
  DeveloperApiKeyServiceError,
} from "../../src/services/developer-api-key.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerApiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  developerApiKey: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe("DeveloperApiKeyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        organisationId: "org-1",
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
        organisationId: "org-1",
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
        organisationId: "org-1",
        name: "n",
        createdBy: "u",
        environment: "test" as never,
      });

      expect(issued.apiKey).toMatch(/^yc_test_/);
    });

    it.each([
      ["organisationId", { organisationId: "", name: "n", createdBy: "u" }],
      ["name", { organisationId: "o", name: "  ", createdBy: "u" }],
      ["createdBy", { organisationId: "o", name: "n", createdBy: "" }],
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
      expect(arg.where).toEqual({ organisationId: "org-1" });
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
        DeveloperApiKeyService.revoke({ organisationId: "o", keyId: "k" }),
      ).resolves.toBeUndefined();
      expect(mockPrisma.developerApiKey.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "k",
            organisationId: "o",
            status: "active",
          }),
        }),
      );
    });

    it("throws 404 when nothing matched", async () => {
      mockPrisma.developerApiKey.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        DeveloperApiKeyService.revoke({ organisationId: "o", keyId: "k" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("verify", () => {
    const activeRecord = {
      id: "key-1",
      organisationId: "org-1",
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
        organisationId: "org-1",
        scopes: ["a"],
        environment: "live",
      });
      expect(mockPrisma.developerApiKey.update).toHaveBeenCalled();
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
