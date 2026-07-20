import {
  IntegrationService,
  IntegrationServiceError,
} from "../../src/services/integration.service";
import { prisma } from "../../src/config/prisma";
import { getIntegrationAdapter } from "../../src/integrations";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    integrationAccount: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../src/integrations", () => {
  const actual = jest.requireActual("../../src/integrations");
  return {
    ...actual,
    getIntegrationAdapter: jest.fn(),
  };
});

describe("IntegrationService", () => {
  const adapter = { validateCredentials: jest.fn() };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (getIntegrationAdapter as jest.Mock).mockReturnValue(adapter);
    adapter.validateCredentials.mockResolvedValue({ ok: true });
  });

  it("rejects unsupported providers", () => {
    expect(() => IntegrationService.ensureProvider("bad")).toThrow(
      IntegrationServiceError,
    );
  });

  it("lists integrations and ensures merck account when missing", async () => {
    (prisma.integrationAccount.findMany as jest.Mock).mockResolvedValue([
      { provider: "IDEXX" },
    ]);

    const spy = jest
      .spyOn(IntegrationService as any, "ensureMerckAccount")
      .mockResolvedValue({ provider: "MERCK_MANUALS" } as any);

    const list = (await IntegrationService.listForOrganisation(
      "org-1",
    )) as any[];

    expect(spy).toHaveBeenCalled();
    expect(list.map((item) => item.provider)).toEqual([
      "IDEXX",
      "MERCK_MANUALS",
    ]);
  });

  it("returns existing merck account in postgres", async () => {
    (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
      id: "m1",
    });

    const result = await IntegrationService.ensureMerckAccount("org-1");

    expect(result).toEqual({ id: "m1" });
    expect(prisma.integrationAccount.create).not.toHaveBeenCalled();
  });

  it("throws when credentials missing on upsert", async () => {
    await expect(
      IntegrationService.upsertCredentials("org-1", "IDEXX", {} as any),
    ).rejects.toThrow("credentials are required.");
  });

  it("upserts credentials when validation passes", async () => {
    (prisma.integrationAccount.upsert as jest.Mock).mockResolvedValue({
      id: "1",
      provider: "IDEXX",
      credentials: { username: "u", password: "secret" },
    });

    const result = await IntegrationService.upsertCredentials(
      "org-1",
      "IDEXX",
      { username: "u", password: "p" } as any,
    );

    expect(result).toEqual({ id: "1", provider: "IDEXX" });
    expect(result).not.toHaveProperty("credentials");
    expect(adapter.validateCredentials).toHaveBeenCalled();
  });

  it("throws when enabling without credentials", async () => {
    (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
      id: "1",
      credentials: null,
    });

    await expect(
      IntegrationService.setEnabled("org-1", "IDEXX"),
    ).rejects.toThrow("Integration credentials are missing.");
  });

  it("creates merck accounts in postgres when enabling and disabling", async () => {
    (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.integrationAccount.create as jest.Mock)
      .mockResolvedValueOnce({ provider: "MERCK_MANUALS", status: "enabled" })
      .mockResolvedValueOnce({ provider: "MERCK_MANUALS", status: "disabled" });

    const enabledMerck = await IntegrationService.setEnabled(
      "org-1",
      "MERCK_MANUALS",
    );
    const disabledMerck = await IntegrationService.setDisabled(
      "org-1",
      "MERCK_MANUALS",
    );

    expect(enabledMerck).toMatchObject({
      provider: "MERCK_MANUALS",
      status: "enabled",
    });
    expect(disabledMerck).toMatchObject({
      provider: "MERCK_MANUALS",
      status: "disabled",
    });
  });

  it("validates credentials and updates status", async () => {
    (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
      credentials: { username: "u" },
    });
    adapter.validateCredentials.mockResolvedValue({
      ok: false,
      reason: "bad",
    });

    const result = await IntegrationService.validateCredentials(
      "org-1",
      "IDEXX",
    );

    expect(result).toEqual({ ok: false, reason: "bad" });
    expect(prisma.integrationAccount.updateMany).toHaveBeenCalled();
  });

  it("throws when required account is missing", async () => {
    (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      IntegrationService.requireAccount("org-1", "IDEXX"),
    ).rejects.toThrow("Integration not found.");
  });

  it("rejects invalid organisation ids and blank providers", async () => {
    expect(() => IntegrationService.ensureProvider("   ")).toThrow(
      IntegrationServiceError,
    );
    await expect(
      IntegrationService.listForOrganisation("bad.id"),
    ).rejects.toThrow("Invalid organisationId.");
  });

  it("short-circuits merck credential validation", async () => {
    expect(
      await IntegrationService.validateCredentials("org_1", "MERCK_MANUALS"),
    ).toEqual({ ok: true });
  });

  describe("getCredentialMeta", () => {
    // Low-entropy, obviously-fake fixture: the tests assert this never appears in
    // the getCredentialMeta result. Kept non-secret-like so scanners do not flag it.
    const SECRET_PASSWORD = [
      "placeholder",
      "not",
      "a",
      "real",
      "password",
    ].join("-");

    it("returns username and practiceId from postgres credentials without password", async () => {
      (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
        credentials: {
          username: "vetuser",
          password: SECRET_PASSWORD,
          labAccountId: "PRACTICE-123",
        },
      });

      const result = await IntegrationService.getCredentialMeta(
        "org-1",
        "IDEXX",
      );

      expect(result).toEqual({
        username: "vetuser",
        practiceId: "PRACTICE-123",
      });
      expect(Object.keys(result)).toEqual(["username", "practiceId"]);
      expect(result).not.toHaveProperty("password");
      expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
    });

    it("returns nulls when the account has no credentials", async () => {
      (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
        credentials: null,
      });

      expect(
        await IntegrationService.getCredentialMeta("org-1", "IDEXX"),
      ).toEqual({ username: null, practiceId: null });
    });

    it("returns nulls when no account exists", async () => {
      (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      expect(
        await IntegrationService.getCredentialMeta("org-1", "IDEXX"),
      ).toEqual({ username: null, practiceId: null });
    });

    it("returns null practiceId when labAccountId is absent", async () => {
      (prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
        credentials: { username: "vetuser", password: SECRET_PASSWORD },
      });

      const result = await IntegrationService.getCredentialMeta(
        "org-1",
        "IDEXX",
      );

      expect(result).toEqual({ username: "vetuser", practiceId: null });
      expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
    });

    it("rejects unsupported providers", async () => {
      await expect(
        IntegrationService.getCredentialMeta("org-1", "bad"),
      ).rejects.toThrow(IntegrationServiceError);
    });
  });
});
