import {
  IntegrationService,
  IntegrationServiceError,
} from "../../src/services/integration.service";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import { getIntegrationAdapter } from "../../src/integrations";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

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
  const readSwitch = isReadFromPostgres as jest.Mock;
  const adapter = { validateCredentials: jest.fn() };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    readSwitch.mockReturnValue(true);
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
      .spyOn(IntegrationService, "ensureMerckAccount")
      .mockResolvedValue({ provider: "MERCK_MANUALS" } as any);

    const list = await IntegrationService.listForOrganisation("org-1");

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
    });

    const result = await IntegrationService.upsertCredentials(
      "org-1",
      "IDEXX",
      { username: "u", password: "p" } as any,
    );

    expect(result).toEqual({ id: "1" });
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
});
