import {
  IntegrationService,
  IntegrationServiceError,
} from "../../src/services/integration.service";
import IntegrationAccountModel from "../../src/models/integration-account";
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

jest.mock("../../src/models/integration-account", () => {
  const ctor: any = jest.fn().mockImplementation((doc) => ({
    ...doc,
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockImplementation(() => ({ ...doc, id: "mongo-id" })),
  }));
  ctor.findOne = jest.fn();
  ctor.findMany = jest.fn();
  ctor.find = jest.fn();
  ctor.findOneAndUpdate = jest.fn();
  ctor.updateOne = jest.fn();
  return {
    __esModule: true,
    default: ctor,
  };
});

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
  const mockedModel = IntegrationAccountModel as any;

  const makeLeanQuery = (result: unknown): any => ({
    setOptions: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  });

  const makeDocQuery = (result: unknown): any => ({
    setOptions: jest.fn().mockResolvedValue(result),
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    readSwitch.mockReturnValue(true);
    (getIntegrationAdapter as jest.Mock).mockReturnValue(adapter);
    adapter.validateCredentials.mockResolvedValue({ ok: true });
    mockedModel.findOne.mockReturnValue(makeLeanQuery(null));
    mockedModel.findMany.mockReturnValue(makeLeanQuery([]));
    mockedModel.findOneAndUpdate.mockResolvedValue(null);
    mockedModel.updateOne.mockResolvedValue({ acknowledged: true });
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

  it("rejects invalid organisation ids and blank providers", async () => {
    expect(() => IntegrationService.ensureProvider("   ")).toThrow(
      IntegrationServiceError,
    );
    await expect(
      IntegrationService.listForOrganisation("bad.id"),
    ).rejects.toThrow("Invalid organisationId.");
  });

  it("creates and lists merck accounts on the mongo path", async () => {
    readSwitch.mockReturnValue(false);
    mockedModel.find.mockReturnValue(
      makeLeanQuery([{ provider: "IDEXX" } as any]),
    );
    mockedModel.findOne.mockReturnValueOnce(makeLeanQuery(null));
    mockedModel.findOne.mockReturnValueOnce(
      makeLeanQuery({
        provider: "MERCK_MANUALS",
      }),
    );

    const list = (await IntegrationService.listForOrganisation(
      "org_1",
    )) as any[];

    expect(list.map((item) => item.provider)).toEqual([
      "IDEXX",
      "MERCK_MANUALS",
    ]);
    expect(mockedModel.find).toHaveBeenCalled();
  });

  it("upserts mongo credentials and marks account disabled before validation", async () => {
    readSwitch.mockReturnValue(false);
    mockedModel.findOneAndUpdate.mockResolvedValue({
      organisationId: "org_1",
      provider: "IDEXX",
      status: "disabled",
      toJSON: () => ({ id: "mongo-upsert" }),
    });

    const result = await IntegrationService.upsertCredentials(
      "org_1",
      "IDEXX",
      { username: "u", password: "p" } as any,
    );

    expect(result).toEqual({ id: "mongo-upsert" });
    expect(getIntegrationAdapter).toHaveBeenCalledWith("IDEXX");
    expect(adapter.validateCredentials).toHaveBeenCalled();
  });

  it("creates merck accounts on the mongo path when enabling and disabling", async () => {
    readSwitch.mockReturnValue(false);
    mockedModel.findOne
      .mockReturnValueOnce(makeDocQuery(null))
      .mockReturnValueOnce(makeDocQuery(null));

    const enabledMerck = await IntegrationService.setEnabled(
      "org_1",
      "MERCK_MANUALS",
    );
    const disabledMerck = await IntegrationService.setDisabled(
      "org_1",
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

  it("short-circuits merck credential validation", async () => {
    expect(
      await IntegrationService.validateCredentials("org_1", "MERCK_MANUALS"),
    ).toEqual({ ok: true });
  });
});
