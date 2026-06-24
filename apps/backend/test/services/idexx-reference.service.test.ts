import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { IdexxReferenceService } from "../../src/services/idexx-reference.service";
import { CodeService } from "../../src/services/code.service";
import { CodeSyncService } from "../../src/services/code-sync.service";
import { IdexxClient } from "../../src/integrations/idexx/idexx.client";

jest.mock("../../src/services/code.service", () => ({
  CodeService: {
    upsertEntry: jest.fn(),
    upsertMapping: jest.fn(),
  },
}));

jest.mock("../../src/services/code-sync.service", () => ({
  CodeSyncService: {
    get: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock("../../src/integrations/idexx/idexx.client", () => ({
  IdexxClient: jest.fn(),
}));

describe("IdexxReferenceService", () => {
  const mockedCodeService = CodeService as any;
  const mockedCodeSyncService = CodeSyncService as any;
  const mockClient: any = {
    getRefVersions: jest.fn(),
    getRefSpecies: jest.fn(),
    getRefBreeds: jest.fn(),
    getRefGenders: jest.fn(),
    getRefTests: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.IDEXX_GLOBAL_USERNAME = "global-user";
    process.env.IDEXX_GLOBAL_PASSWORD = "global-pass";
    process.env.IDEXX_PIMS_ID = "pims-id";
    process.env.IDEXX_PIMS_VERSION = "pims-version";
    process.env.IDEXX_GLOBAL_LAB_ACCOUNT_ID = "lab-1";

    (IdexxClient as unknown as jest.Mock).mockImplementation(() => mockClient);
    mockClient.getRefVersions.mockResolvedValue({ species: "species-v1" });
    mockClient.getRefSpecies.mockResolvedValue({
      list: [{ code: "CANINE", name: "Canine" }],
      version: "species-v1",
    });
    mockClient.getRefBreeds.mockResolvedValue({
      list: [],
      version: "breeds-v1",
    });
    mockClient.getRefGenders.mockResolvedValue({
      list: [],
      version: "genders-v1",
    });
    mockClient.getRefTests.mockResolvedValue({ list: [], version: "tests-v1" });
  });

  it("syncs species mappings and marks the species version as synced", async () => {
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);

    await IdexxReferenceService.syncAll();

    expect(mockClient.getRefSpecies).toHaveBeenCalled();
    expect(mockedCodeService.upsertEntry).toHaveBeenCalledWith({
      system: "YOSEMITECODE",
      code: "YSPEC:CANINE",
      display: "Canine",
      type: "SPECIES",
      active: true,
      synonyms: [],
      meta: { source: "idexx-sync" },
    });
    expect(mockedCodeService.upsertMapping).toHaveBeenCalledWith({
      sourceSystem: "YOSEMITECODE",
      sourceCode: "YSPEC:CANINE",
      targetSystem: "IDEXX",
      targetCode: "CANINE",
      targetDisplay: "Canine",
      targetVersion: "species-v1",
      active: true,
    });
    expect(mockedCodeSyncService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "IDEXX",
        kind: "species",
        version: "species-v1",
      }),
    );
  });

  it("skips species sync when the version is already marked as synced", async () => {
    mockedCodeSyncService.get.mockResolvedValueOnce({
      version: "species-v1",
    });
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);

    await IdexxReferenceService.syncAll();

    expect(mockClient.getRefSpecies).not.toHaveBeenCalled();
    expect(mockedCodeService.upsertEntry).not.toHaveBeenCalled();
    expect(mockedCodeService.upsertMapping).not.toHaveBeenCalled();
    expect(mockedCodeSyncService.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "species",
      }),
    );
  });

  it("logs and propagates species fetch failures", async () => {
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockedCodeSyncService.get.mockResolvedValueOnce(null);
    mockClient.getRefSpecies.mockRejectedValueOnce(new Error("boom"));

    await expect(IdexxReferenceService.syncAll()).rejects.toThrow("boom");
    expect(mockedCodeService.upsertEntry).not.toHaveBeenCalled();
    expect(mockedCodeSyncService.upsert).not.toHaveBeenCalled();
  });
});
