jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: { findMany: jest.fn(), update: jest.fn() },
    codeMapping: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patient: { updateMany: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import { main, planDedupe } from "src/scripts/dedupe-breed-codes";

const mocked = prisma as unknown as {
  codeEntry: { findMany: jest.Mock; update: jest.Mock };
  codeMapping: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  patient: { updateMany: jest.Mock };
};

beforeEach(() => jest.clearAllMocks());

describe("planDedupe", () => {
  it("picks the code that already equals its own canonical form as the winner", async () => {
    mocked.codeEntry.findMany.mockResolvedValue([
      { code: "YBREED:CANINE:SHIH_TZU" },
      { code: "YBREED:CANINE:SHIH-TZU" },
    ]);

    const { groups, unresolved } = await planDedupe();

    expect(unresolved).toEqual([]);
    expect(groups).toEqual([
      {
        canonical: "YBREED:CANINE:SHIH_TZU",
        winner: "YBREED:CANINE:SHIH_TZU",
        losers: ["YBREED:CANINE:SHIH-TZU"],
      },
    ]);
  });

  it("leaves a breed with only one spelling alone", async () => {
    mocked.codeEntry.findMany.mockResolvedValue([
      { code: "YBREED:CANINE:PUG" },
    ]);

    const { groups, unresolved } = await planDedupe();

    expect(groups).toEqual([]);
    expect(unresolved).toEqual([]);
  });

  it("reports unresolved when neither spelling already matches the canonical form", async () => {
    // Both rows carry a hyphen - the fold-together step would have to guess,
    // so it refuses instead. A wrong repoint is worse than a duplicate left.
    mocked.codeEntry.findMany.mockResolvedValue([
      { code: "YBREED:CANINE:APPALOOSA-X" },
      { code: "ybreed:canine:appaloosa-x" },
    ]);

    const { groups, unresolved } = await planDedupe();

    expect(groups).toEqual([]);
    expect(unresolved).toEqual([
      {
        canonical: "YBREED:CANINE:APPALOOSA_X",
        codes: ["YBREED:CANINE:APPALOOSA-X", "ybreed:canine:appaloosa-x"],
        reason: "no code already matches the canonical form",
      },
    ]);
  });

  it("queries only active-agnostic BREED entries in the YOSEMITECODE system", async () => {
    mocked.codeEntry.findMany.mockResolvedValue([]);
    await planDedupe();
    expect(mocked.codeEntry.findMany).toHaveBeenCalledWith({
      where: { system: "YOSEMITECODE", type: "BREED" },
      select: { code: true },
    });
  });
});

describe("main", () => {
  let log: jest.SpyInstance;
  let argv: string[];

  beforeEach(() => {
    argv = process.argv;
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    mocked.codeEntry.findMany.mockResolvedValue([
      { code: "YBREED:CANINE:SHIH_TZU" },
      { code: "YBREED:CANINE:SHIH-TZU" },
    ]);
    mocked.patient.updateMany.mockResolvedValue({ count: 1 });
    mocked.codeMapping.findMany.mockResolvedValue([]);
    mocked.codeEntry.update.mockResolvedValue({});
  });

  afterEach(() => {
    process.argv = argv;
    log.mockRestore();
  });

  const output = () => log.mock.calls.map((c) => String(c[0])).join("\n");

  it("writes nothing without --apply", async () => {
    process.argv = ["node", "dedupe-breed-codes.ts"];
    await main();

    expect(mocked.patient.updateMany).not.toHaveBeenCalled();
    expect(mocked.codeEntry.update).not.toHaveBeenCalled();
    expect(output()).toMatch(/dry run/);
  });

  it("repoints patients off the loser code and onto the winner", async () => {
    process.argv = ["node", "dedupe-breed-codes.ts", "--apply"];
    await main();

    expect(mocked.patient.updateMany).toHaveBeenCalledWith({
      where: { breedCode: "YBREED:CANINE:SHIH-TZU" },
      data: { breedCode: "YBREED:CANINE:SHIH_TZU" },
    });
  });

  it("deactivates the loser entry rather than deleting it", async () => {
    process.argv = ["node", "dedupe-breed-codes.ts", "--apply"];
    await main();

    expect(mocked.codeEntry.update).toHaveBeenCalledWith({
      where: {
        system_code: { system: "YOSEMITECODE", code: "YBREED:CANINE:SHIH-TZU" },
      },
      data: { active: false },
    });
  });

  it("repoints a mapping's sourceCode when the winner has no equivalent mapping yet", async () => {
    mocked.codeMapping.findMany.mockResolvedValue([
      {
        id: "m1",
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YBREED:CANINE:SHIH-TZU",
        targetSystem: "IDEXX",
        targetCode: "IDX-9",
      },
    ]);
    mocked.codeMapping.findUnique.mockResolvedValue(null);
    process.argv = ["node", "dedupe-breed-codes.ts", "--apply"];

    await main();

    expect(mocked.codeMapping.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { sourceCode: "YBREED:CANINE:SHIH_TZU" },
    });
    expect(mocked.codeMapping.delete).not.toHaveBeenCalled();
    expect(output()).toMatch(/1 mappings repointed/);
  });

  it("deletes the loser's mapping instead of repointing when the winner already has that target", async () => {
    // Repointing here would collide with the unique
    // (sourceSystem, sourceCode, targetSystem, targetCode) constraint.
    mocked.codeMapping.findMany.mockResolvedValue([
      {
        id: "m1",
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YBREED:CANINE:SHIH-TZU",
        targetSystem: "IDEXX",
        targetCode: "IDX-9",
      },
    ]);
    mocked.codeMapping.findUnique.mockResolvedValue({ id: "m2" });
    process.argv = ["node", "dedupe-breed-codes.ts", "--apply"];

    await main();

    expect(mocked.codeMapping.delete).toHaveBeenCalledWith({
      where: { id: "m1" },
    });
    expect(mocked.codeMapping.update).not.toHaveBeenCalled();
    expect(output()).toMatch(/1 duplicate mappings removed/);
  });

  it("names every unresolved group and why", async () => {
    mocked.codeEntry.findMany.mockResolvedValue([
      { code: "YBREED:CANINE:APPALOOSA-X" },
      { code: "ybreed:canine:appaloosa-x" },
    ]);
    process.argv = ["node", "dedupe-breed-codes.ts"];

    await main();

    expect(output()).toMatch(/SKIP YBREED:CANINE:APPALOOSA_X/);
    expect(output()).toMatch(/no code already matches/);
  });
});
