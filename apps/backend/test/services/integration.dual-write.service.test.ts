import { IntegrationService } from "../../src/services/integration.service";
import IntegrationAccountModel from "../../src/models/integration-account";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import { getIntegrationAdapter } from "../../src/integrations";

jest.mock("../../src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    integrationAccount: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../src/models/integration-account", () => ({
  __esModule: true,
  default: { findOneAndUpdate: jest.fn() },
}));

jest.mock("../../src/integrations", () => {
  const actual = jest.requireActual("../../src/integrations");
  return {
    ...actual,
    getIntegrationAdapter: jest.fn(),
  };
});

describe("IntegrationService dual-write to Postgres", () => {
  const mockedModel = IntegrationAccountModel as unknown as {
    findOneAndUpdate: jest.Mock;
  };
  const mockedUpsert = prisma.integrationAccount.upsert as jest.Mock;

  const credentials = { apiKey: "idexx-secret-key", secret: "idexx-secret" };
  const config = { region: "eu", baseUrl: "https://idexx.example" };

  beforeEach(() => {
    jest.clearAllMocks();
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);
    (getIntegrationAdapter as jest.Mock).mockReturnValue({
      validateCredentials: jest.fn().mockResolvedValue({ ok: true }),
    });
    mockedModel.findOneAndUpdate.mockResolvedValue({
      organisationId: "org-1",
      provider: "IDEXX",
      status: "disabled",
      credentialsStatus: "valid",
      credentials,
      config,
      toJSON: () => ({ id: "mongo-1", organisationId: "org-1" }),
    });
  });

  // `config` is exposed by prismaIntegrationAccountSelect while `credentials` is withheld,
  // so writing credentials into `config` would publish them to every integrations:view:any
  // reader.
  it("mirrors config into config, never credentials", async () => {
    await IntegrationService.upsertCredentials(
      "org-1",
      "IDEXX",
      credentials,
      config,
    );

    expect(mockedUpsert).toHaveBeenCalledTimes(1);
    const args = mockedUpsert.mock.calls[0][0];

    expect(args.create.config).toEqual(config);
    expect(args.update.config).toEqual(config);
    expect(args.create.credentials).toEqual(credentials);
    expect(args.update.credentials).toEqual(credentials);

    expect(JSON.stringify(args.create.config)).not.toContain("idexx-secret");
    expect(JSON.stringify(args.update.config)).not.toContain("idexx-secret");
  });

  it("writes a JSON null config when the account has none", async () => {
    mockedModel.findOneAndUpdate.mockResolvedValue({
      organisationId: "org-1",
      provider: "IDEXX",
      status: "disabled",
      credentialsStatus: "valid",
      credentials,
      config: null,
      toJSON: () => ({ id: "mongo-1" }),
    });

    await IntegrationService.upsertCredentials("org-1", "IDEXX", credentials);

    const args = mockedUpsert.mock.calls[0][0];
    expect(JSON.stringify(args.create.config)).not.toContain("idexx-secret");
    expect(JSON.stringify(args.update.config)).not.toContain("idexx-secret");
  });
});
