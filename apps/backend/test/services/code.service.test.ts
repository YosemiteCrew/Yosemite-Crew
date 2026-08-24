import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CodeService, CodeServiceError } from "../../src/services/code.service";
import { prisma } from "../../src/config/prisma";
import { Prisma } from "@prisma/client";

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

  it("throws a 400 CodeServiceError when a required entry field is missing", async () => {
    expect.assertions(5);

    try {
      await CodeService.upsertEntry({
        system: undefined as unknown as "YOSEMITECODE",
        code: "YSPEC:CANINE",
        display: "Canine",
        type: "SPECIES",
        active: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CodeServiceError);
      expect((error as CodeServiceError).statusCode).toBe(400);
      expect((error as Error).message).toBe("system is required.");
      expect((error as Error).name).toBe("CodeServiceError");
    }

    expect(mockedPrisma.codeEntry.upsert).not.toHaveBeenCalled();
  });

  it("rejects an entry whose field is whitespace-only", async () => {
    await expect(
      CodeService.upsertEntry({
        system: "YOSEMITECODE",
        code: "   ",
        display: "Canine",
        type: "SPECIES",
        active: true,
      }),
    ).rejects.toThrow("code is required.");

    expect(mockedPrisma.codeEntry.upsert).not.toHaveBeenCalled();
  });

  it("persists null synonyms and meta as JSON null", async () => {
    mockedPrisma.codeEntry.upsert.mockResolvedValue({ id: "entry-null" });

    await CodeService.upsertEntry({
      system: "YOSEMITECODE",
      code: "YSPEC:NULL",
      display: "Nullish",
      type: "OTHER",
      active: false,
      synonyms: null as unknown as string[],
      meta: null,
    });

    const arg = mockedPrisma.codeEntry.upsert.mock.calls[0][0];
    expect(arg.create.synonyms).toBe(Prisma.JsonNull);
    expect(arg.create.meta).toBe(Prisma.JsonNull);
    expect(arg.update.synonyms).toBe(Prisma.JsonNull);
    expect(arg.update.meta).toBe(Prisma.JsonNull);
  });

  it("passes through undefined synonyms and meta unset", async () => {
    mockedPrisma.codeEntry.upsert.mockResolvedValue({ id: "entry-undef" });

    await CodeService.upsertEntry({
      system: "YOSEMITECODE",
      code: "YSPEC:UNDEF",
      display: "Undefined",
      type: "BREED",
      active: true,
    });

    const arg = mockedPrisma.codeEntry.upsert.mock.calls[0][0];
    expect(arg.create.synonyms).toBeUndefined();
    expect(arg.create.meta).toBeUndefined();
    expect(arg.update.synonyms).toBeUndefined();
    expect(arg.update.meta).toBeUndefined();
  });

  it("defaults omitted mapping target fields to null", async () => {
    mockedPrisma.codeMapping.upsert.mockResolvedValue({ id: "mapping-null" });

    await CodeService.upsertMapping({
      sourceSystem: "YOSEMITECODE",
      sourceCode: "YSPEC:CANINE",
      targetSystem: "IDEXX",
      targetCode: "CANINE",
      active: false,
    });

    const arg = mockedPrisma.codeMapping.upsert.mock.calls[0][0];
    expect(arg.create.targetDisplay).toBeNull();
    expect(arg.create.targetVersion).toBeNull();
    expect(arg.update.targetDisplay).toBeNull();
    expect(arg.update.targetVersion).toBeNull();
  });

  it("rejects a mapping missing a required field", async () => {
    await expect(
      CodeService.upsertMapping({
        sourceSystem: "" as "YOSEMITECODE",
        sourceCode: "YSPEC:CANINE",
        targetSystem: "IDEXX",
        targetCode: "CANINE",
        active: true,
      }),
    ).rejects.toThrow("sourceSystem is required.");

    expect(mockedPrisma.codeMapping.upsert).not.toHaveBeenCalled();
  });

  it("lists entries without a query and applies the limit as take", async () => {
    const rows = [{ id: "e1" }, { id: "e2" }];
    mockedPrisma.codeEntry.findMany.mockResolvedValue(rows);

    await expect(
      CodeService.listEntries({
        system: "IDEXX",
        type: "TEST",
        active: false,
        limit: 5,
      }),
    ).resolves.toBe(rows);

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith({
      where: { system: "IDEXX", type: "TEST", active: false },
      orderBy: { display: "asc" },
      take: 5,
    });
  });

  it("lists entries with no filters and no limit", async () => {
    const rows = [{ id: "only" }];
    mockedPrisma.codeEntry.findMany.mockResolvedValue(rows);

    await expect(CodeService.listEntries({})).resolves.toBe(rows);

    // Always bounded: `CodeEntry` is a terminology table, so an unbounded read
    // is a full-table load on an authenticated endpoint.
    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { display: "asc" },
      take: 200,
    });
  });

  it("treats a whitespace-only query as no query", async () => {
    const rows = [{ id: "w" }];
    mockedPrisma.codeEntry.findMany.mockResolvedValue(rows);

    await expect(CodeService.listEntries({ query: "   " })).resolves.toBe(rows);

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { display: "asc" },
      take: 200,
    });
  });

  it("falls back to the ceiling for a non-finite limit", async () => {
    const rows = [{ id: "x" }];
    mockedPrisma.codeEntry.findMany.mockResolvedValue(rows);

    await CodeService.listEntries({ limit: Number.POSITIVE_INFINITY });

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("falls back to the ceiling for a non-positive limit", async () => {
    const rows = [{ id: "np" }];
    mockedPrisma.codeEntry.findMany.mockResolvedValue(rows);

    await CodeService.listEntries({ limit: -3 });

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("caps an oversized limit at the ceiling", async () => {
    mockedPrisma.codeEntry.findMany.mockResolvedValue([{ id: "big" }]);

    await CodeService.listEntries({ limit: 1_000_000 });

    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("throws a 400 CodeServiceError for a non-string query", async () => {
    expect.assertions(4);

    try {
      await CodeService.listEntries({ query: 123 as unknown as string });
    } catch (error) {
      expect(error).toBeInstanceOf(CodeServiceError);
      expect((error as CodeServiceError).statusCode).toBe(400);
      expect((error as Error).message).toBe("Invalid query");
    }

    expect(mockedPrisma.codeEntry.findMany).not.toHaveBeenCalled();
  });

  it("filters entries in memory by code, display, and string synonyms", async () => {
    mockedPrisma.codeEntry.findMany.mockResolvedValue([
      { id: "a", code: "ABC", display: "Alpha", synonyms: null },
      { id: "b", code: "BCD", display: "Beta", synonyms: [123] },
      { id: "c", code: "CDE", display: "Gamma", synonyms: ["alphapet"] },
    ]);

    await expect(CodeService.listEntries({ query: "alpha" })).resolves.toEqual([
      expect.objectContaining({ id: "a" }),
      expect.objectContaining({ id: "c" }),
    ]);

    // Narrowed in SQL on the plain columns and hard-capped, so the in-memory
    // synonym pass runs over a bounded slice rather than the whole table.
    expect(mockedPrisma.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { display: "asc" },
        take: 2_000,
      }),
    );
  });

  it("matches on code and slices the filtered results to the limit", async () => {
    mockedPrisma.codeEntry.findMany.mockResolvedValue([
      { id: "m1", code: "MATCH-1", display: "One", synonyms: [] },
      { id: "m2", code: "MATCH-2", display: "Two", synonyms: [] },
      { id: "m3", code: "MATCH-3", display: "Three", synonyms: [] },
    ]);

    await expect(
      CodeService.listEntries({ query: "match", limit: 2 }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "m1" }),
      expect.objectContaining({ id: "m2" }),
    ]);
  });

  it("returns all matches when the limit is not positive", async () => {
    mockedPrisma.codeEntry.findMany.mockResolvedValue([
      { id: "k1", code: "KEEP-1", display: "One", synonyms: [] },
      { id: "k2", code: "KEEP-2", display: "Two", synonyms: [] },
    ]);

    await expect(
      CodeService.listEntries({ query: "keep", limit: -1 }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "k1" }),
      expect.objectContaining({ id: "k2" }),
    ]);
  });

  it("lists mappings with whitespace-only and omitted filters", async () => {
    const rows = [{ id: "m" }];
    mockedPrisma.codeMapping.findMany.mockResolvedValue(rows);

    await expect(
      CodeService.listMappings({
        sourceSystem: "   " as "YOSEMITECODE",
        targetSystem: " " as "IDEXX",
      }),
    ).resolves.toBe(rows);

    expect(mockedPrisma.codeMapping.findMany).toHaveBeenCalledWith({
      where: {
        sourceSystem: undefined,
        sourceCode: undefined,
        targetSystem: undefined,
        targetCode: undefined,
        active: undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  });
  describe("mapping equivalence", () => {
    it("persists the equivalence it was given, on create and on update", async () => {
      // The importer decides how well a crosswalk holds; if this layer drops it, every
      // mapping silently reverts to asserting exact sameness.
      mockedPrisma.codeMapping.upsert.mockResolvedValue({ id: "m-1" });

      await CodeService.upsertMapping({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YC-1",
        targetSystem: "SNOMED",
        targetCode: "422400008",
        equivalence: "NARROWER",
        active: true,
      });

      const args = mockedPrisma.codeMapping.upsert.mock.calls[0][0];
      expect(args.create.equivalence).toBe("NARROWER");
      expect(args.update.equivalence).toBe("NARROWER");
    });

    it("defaults to EQUIVALENT when the caller says nothing", async () => {
      mockedPrisma.codeMapping.upsert.mockResolvedValue({ id: "m-2" });

      await CodeService.upsertMapping({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YC-2",
        targetSystem: "VENOM",
        targetCode: "13",
        active: true,
      });

      const args = mockedPrisma.codeMapping.upsert.mock.calls[0][0];
      expect(args.create.equivalence).toBe("EQUIVALENT");
    });
  });
});
