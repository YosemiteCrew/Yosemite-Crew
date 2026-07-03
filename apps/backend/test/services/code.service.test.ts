import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CodeService } from "../../src/services/code.service";
import { prisma } from "../../src/config/prisma";
import CodeEntryModel from "../../src/models/code-entry";
import CodeMappingModel from "../../src/models/code-mapping";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeEntry: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    codeMapping: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/models/code-entry", () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/code-mapping", () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

describe("CodeService", () => {
  const mockedPrisma = prisma as any;
  const mockedCodeEntryModel = CodeEntryModel as any;
  const mockedCodeMappingModel = CodeMappingModel as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes code entries directly to Postgres when READ_FROM_POSTGRES is enabled", async () => {
    process.env.READ_FROM_POSTGRES = "true";
    mockedPrisma.codeEntry.upsert.mockResolvedValue({
      system: "YOSEMITECODE",
      code: "YSPEC:CANINE",
      display: "Canine",
      type: "SPECIES",
      active: true,
      synonyms: [],
      meta: { source: "seed" },
    });

    await expect(
      CodeService.upsertEntry({
        system: "YOSEMITECODE",
        code: "YSPEC:CANINE",
        display: "Canine",
        type: "SPECIES",
        active: true,
        synonyms: [],
        meta: { source: "seed" },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        code: "YSPEC:CANINE",
      }),
    );

    expect(mockedPrisma.codeEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          system_code: {
            system: "YOSEMITECODE",
            code: "YSPEC:CANINE",
          },
        },
      }),
    );
    expect(mockedCodeEntryModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("writes code mappings directly to Postgres when READ_FROM_POSTGRES is enabled", async () => {
    process.env.READ_FROM_POSTGRES = "true";
    mockedPrisma.codeMapping.upsert.mockResolvedValue({
      sourceSystem: "YOSEMITECODE",
      sourceCode: "YSPEC:CANINE",
      targetSystem: "IDEXX",
      targetCode: "CANINE",
      active: true,
    });

    await expect(
      CodeService.upsertMapping({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
        targetDisplay: "Canine",
        targetVersion: "v1",
        active: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        targetCode: "CANINE",
      }),
    );

    expect(mockedPrisma.codeMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceSystem_sourceCode_targetSystem_targetCode: {
            sourceSystem: "YOSEMITECODE",
            sourceCode: "YSPEC:CANINE",
            targetSystem: "IDEXX",
            targetCode: "CANINE",
          },
        },
      }),
    );
    expect(mockedCodeMappingModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("keeps Mongo as the write path when READ_FROM_POSTGRES is disabled", async () => {
    process.env.READ_FROM_POSTGRES = "false";
    mockedCodeEntryModel.findOneAndUpdate.mockResolvedValue({
      system: "YOSEMITECODE",
      code: "YSPEC:FELINE",
    });
    mockedCodeMappingModel.findOneAndUpdate.mockResolvedValue({
      sourceSystem: "YOSEMITECODE",
      sourceCode: "YSPEC:FELINE",
      targetSystem: "IDEXX",
      targetCode: "FELINE",
    });

    await CodeService.upsertEntry({
      system: "YOSEMITECODE",
      code: "YSPEC:FELINE",
      display: "Feline",
      type: "SPECIES",
      active: true,
    });
    await CodeService.upsertMapping({
      sourceSystem: "YOSEMITECODE",
      sourceCode: "YSPEC:FELINE",
      targetSystem: "IDEXX",
      targetCode: "FELINE",
      active: true,
    });

    expect(mockedCodeEntryModel.findOneAndUpdate).toHaveBeenCalled();
    expect(mockedCodeMappingModel.findOneAndUpdate).toHaveBeenCalled();
    expect(mockedPrisma.codeEntry.upsert).not.toHaveBeenCalled();
    expect(mockedPrisma.codeMapping.upsert).not.toHaveBeenCalled();
  });

  it("lists entries with normalized filters in Postgres mode", async () => {
    process.env.READ_FROM_POSTGRES = "true";
    mockedPrisma.codeEntry.findMany.mockResolvedValue([
      {
        system: "YOSEMITECODE",
        code: "YSPEC:CANINE",
        display: "Canine",
      },
    ]);

    await expect(
      CodeService.listEntries({
        system: "YOSEMITECODE",
        type: "SPECIES",
        active: true,
        query: " Canine ",
        limit: 7,
      }),
    ).resolves.toHaveLength(1);

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          system: "YOSEMITECODE",
          type: "SPECIES",
          active: true,
          OR: [
            { code: { contains: "Canine", mode: "insensitive" } },
            { display: { contains: "Canine", mode: "insensitive" } },
          ],
        }),
        take: 7,
      }),
    );
  });

  it("lists mappings with normalized filters in Mongo mode", async () => {
    process.env.READ_FROM_POSTGRES = "false";
    const lean: any = jest.fn();
    lean.mockResolvedValue([{ sourceCode: "YSPEC:CANINE" }]);
    const mockCursor: any = {
      sort: jest.fn().mockReturnValue({
        setOptions: jest.fn().mockReturnValue({
          lean,
        }),
      }),
    };
    (mockedCodeMappingModel.find as jest.Mock).mockReturnValue(mockCursor);

    await expect(
      CodeService.listMappings({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
        active: true,
      }),
    ).resolves.toHaveLength(1);

    expect(mockedCodeMappingModel.find).toHaveBeenCalledWith({
      sourceSystem: "YOSEMITECODE",
      sourceCode: "YSPEC:CANINE",
      targetSystem: "IDEXX",
      targetCode: "CANINE",
      active: true,
    });
  });
});
