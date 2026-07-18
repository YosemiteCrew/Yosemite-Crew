import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CodeService } from "../../src/services/code.service";
import { prisma } from "../../src/config/prisma";

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

describe("CodeService", () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes code entries to Postgres", async () => {
    mockedPrisma.codeEntry.upsert.mockResolvedValue({
      id: "entry-1",
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
        id: "entry-1",
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
  });

  it("writes code mappings to Postgres", async () => {
    mockedPrisma.codeMapping.upsert.mockResolvedValue({
      id: "mapping-1",
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
        id: "mapping-1",
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
  });

  it("lists entries with normalized filters", async () => {
    mockedPrisma.codeEntry.findMany.mockResolvedValue([
      {
        id: "entry-1",
        system: "YOSEMITECODE",
        code: "YSPEC:CANINE",
        display: "Canine",
        synonyms: ["Dog", "Puppy"],
      },
      {
        id: "entry-2",
        system: "YOSEMITECODE",
        code: "YSPEC:FELINE",
        display: "Feline",
        synonyms: ["Cat"],
      },
    ]);

    await expect(
      CodeService.listEntries({
        system: "YOSEMITECODE",
        type: "SPECIES",
        active: true,
        query: " puppy ",
        limit: 7,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "entry-1",
      }),
    ]);

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          system: "YOSEMITECODE",
          type: "SPECIES",
          active: true,
        }),
        orderBy: { display: "asc" },
      }),
    );
  });

  it("lists mappings with normalized filters", async () => {
    mockedPrisma.codeMapping.findMany.mockResolvedValue([
      {
        id: "mapping-1",
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
      },
    ]);

    await expect(
      CodeService.listMappings({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
        active: true,
      }),
    ).resolves.toHaveLength(1);

    expect(mockedPrisma.codeMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceSystem: "YOSEMITECODE",
          sourceCode: "YSPEC:CANINE",
          targetSystem: "IDEXX",
          targetCode: "CANINE",
          active: true,
        }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
