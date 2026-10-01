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
  it("writes reference entries one at a time, in list order", async () => {
    mockedCodeSyncService.get.mockResolvedValue(null);
    mockClient.getRefVersions.mockResolvedValue({
      species: "species-v2",
      breeds: "breeds-v2",
      genders: "genders-v2",
      tests: "tests-v2",
    });
    mockClient.getRefSpecies.mockResolvedValue({
      list: [
        { code: "CANINE", name: "Canine" },
        { code: "FELINE", name: "Feline" },
      ],
      version: "species-v2",
    });
    mockClient.getRefBreeds.mockResolvedValue({
      list: [
        { code: "LAB", name: "Labrador", speciesCode: "CANINE" },
        { code: "SIA", name: "Siamese", speciesCode: "FELINE" },
      ],
      version: "breeds-v2",
    });
    mockClient.getRefGenders.mockResolvedValue({
      list: [
        { code: "M", name: "Male" },
        { code: "F", name: "Female" },
      ],
      version: "genders-v2",
    });
    mockClient.getRefTests.mockResolvedValue({
      list: [
        { code: "T1", name: "Panel one" },
        { code: "T2", name: "Panel two" },
      ],
      version: "tests-v2",
    });
    const writes: string[] = [];
    mockedCodeService.upsertEntry.mockImplementation(
      async (entry: { code: string }) => {
        writes.push(`entry:${entry.code}`);
      },
    );
    mockedCodeService.upsertMapping.mockImplementation(
      async (mapping: { sourceCode: string }) => {
        writes.push(`mapping:${mapping.sourceCode}`);
      },
    );

    await IdexxReferenceService.syncAll();

    expect(writes).toEqual([
      "entry:YSPEC:CANINE",
      "mapping:YSPEC:CANINE",
      "entry:YSPEC:FELINE",
      "mapping:YSPEC:FELINE",
      "entry:YSPEC:CANINE",
      "entry:YBREED:CANINE:LAB",
      "mapping:YBREED:CANINE:LAB",
      "entry:YSPEC:FELINE",
      "entry:YBREED:FELINE:SIA",
      "mapping:YBREED:FELINE:SIA",
      "entry:M",
      "entry:F",
      "entry:T1",
      "entry:T2",
    ]);
  });

  it("stops a reference sync at the first failed write", async () => {
    mockedCodeSyncService.get.mockResolvedValue(null);
    mockClient.getRefVersions.mockResolvedValue({ genders: "genders-v2" });
    mockClient.getRefGenders.mockResolvedValue({
      list: [
        { code: "M", name: "Male" },
        { code: "F", name: "Female" },
      ],
      version: "genders-v2",
    });
    mockedCodeService.upsertEntry.mockRejectedValueOnce(new Error("db down"));

    await expect(IdexxReferenceService.syncAll()).rejects.toThrow("db down");

    expect(mockedCodeService.upsertEntry).toHaveBeenCalledTimes(1);
    expect(mockedCodeSyncService.upsert).not.toHaveBeenCalled();
  });

  it("waits for each test entry before writing the next", async () => {
    mockedCodeSyncService.get.mockResolvedValue(null);
    mockClient.getRefVersions.mockResolvedValue({ tests: "tests-v2" });
    mockClient.getRefTests.mockResolvedValue({
      list: [
        { code: "T1", name: "Panel one" },
        { code: "T2", name: "Panel two" },
      ],
      version: "tests-v2",
    });
    let releaseFirst!: () => void;
    mockedCodeService.upsertEntry
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(undefined);

    const pending = IdexxReferenceService.syncAll();
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedCodeService.upsertEntry).toHaveBeenCalledTimes(1);

    releaseFirst();
    await pending;

    expect(mockedCodeService.upsertEntry).toHaveBeenCalledTimes(2);
  });
});
