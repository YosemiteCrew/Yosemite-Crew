jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: { upsert: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    codeRelationship: { createMany: jest.fn() },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

import fs from "node:fs";
import {
  main,
  parentOf,
  planImport,
  speciesFor,
  type AtcvetExtract,
} from "src/scripts/import-atcvet-index";

const extract = (entries: Array<[string, string]>): AtcvetExtract => ({
  source: "WHO CC",
  dataset: "ATCvet index",
  release: "2026",
  entries: entries.map(([code, name]) => ({ code, name })),
});

describe("parentOf", () => {
  it("walks the level encoded in the code's own length", () => {
    // QJ01AA02 doxycycline -> QJ01AA -> QJ01A -> QJ01 -> QJ -> root
    expect(parentOf("QJ01AA02")).toBe("QJ01AA");
    expect(parentOf("QJ01AA")).toBe("QJ01A");
    expect(parentOf("QJ01A")).toBe("QJ01");
    expect(parentOf("QJ01")).toBe("QJ");
    expect(parentOf("QJ")).toBeNull();
  });
});

describe("speciesFor", () => {
  it("reads species from the QI second level, which encodes it", () => {
    expect(speciesFor("QI07AA01")).toEqual(["SA"]); // canidae
    expect(speciesFor("QI05")).toEqual(["EQUINE"]); // equidae
    expect(speciesFor("QI01AA")).toEqual(["AVIAN"]); // aves
  });

  it("leaves 'other species' unmapped rather than guessing", () => {
    expect(speciesFor("QI20AA01")).toEqual([]);
  });

  it("assigns no species outside QI, where levels are therapeutic", () => {
    // QJ01AA02 is doxycycline for any species; claiming one would be wrong.
    expect(speciesFor("QJ01AA02")).toEqual([]);
  });
});

describe("planImport", () => {
  it("types only the substance level as prescribable", () => {
    const plan = planImport(
      extract([
        ["QJ", "ANTIINFECTIVES FOR SYSTEMIC USE"],
        ["QJ01", "ANTIBACTERIALS FOR SYSTEMIC USE"],
        ["QJ01A", "TETRACYCLINES"],
        ["QJ01AA", "Tetracyclines"],
        ["QJ01AA02", "doxycycline"],
      ]),
    );
    const byCode = new Map(plan.entries.map((e) => [e.code, e]));
    expect(byCode.get("QJ01AA02")?.type).toBe("MEDICATION");
    expect(byCode.get("QJ01AA02")?.level).toBe(5);
    for (const code of ["QJ", "QJ01", "QJ01A", "QJ01AA"]) {
      expect(byCode.get(code)?.type).toBe("MEDICATION_CATEGORY");
    }
  });

  it("builds one edge per non-root code", () => {
    const plan = planImport(
      extract([
        ["QJ", "A"],
        ["QJ01", "B"],
        ["QJ01A", "C"],
      ]),
    );
    expect(plan.edges).toEqual([
      { sourceCode: "QJ01", targetCode: "QJ" },
      { sourceCode: "QJ01A", targetCode: "QJ01" },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it("skips an edge whose parent is absent rather than pointing at nothing", () => {
    // A partial extract must produce a smaller graph, never a dangling edge.
    const plan = planImport(extract([["QJ01AA02", "doxycycline"]]));
    expect(plan.entries).toHaveLength(1);
    expect(plan.edges).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/parent QJ01AA not in extract/);
  });

  it("rejects rows that are not ATCvet codes", () => {
    const plan = planImport(
      extract([
        ["J01AA02", "missing the Q"],
        ["QJ01AA0", "wrong length"],
        ["Q1", "digit where a letter belongs"],
        ["", "no code"],
      ]),
    );
    expect(plan.entries).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      "not a valid ATCvet code",
      "not a valid ATCvet code",
      "not a valid ATCvet code",
      "missing code or name",
    ]);
  });

  it("keeps the first of a duplicated code and reports the rest", () => {
    const plan = planImport(
      extract([
        ["QJ01AA02", "doxycycline"],
        ["QJ01AA02", "doxycycline (again)"],
      ]),
    );
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].display).toBe("doxycycline");
    expect(plan.skipped[0].reason).toBe("duplicate code in extract");
  });

  it("carries QI species down to the substance", () => {
    const plan = planImport(
      extract([
        ["QI", "IMMUNOLOGICALS"],
        ["QI07", "IMMUNOLOGICALS FOR CANIDAE"],
        ["QI07A", "CANIDAE"],
        ["QI07AA", "Inactivated viral vaccines"],
        ["QI07AA01", "canine distemper vaccine"],
      ]),
    );
    const substance = plan.entries.find((e) => e.code === "QI07AA01");
    expect(substance?.species).toEqual(["SA"]);
    // The QI root itself has no species: it covers every animal.
    expect(plan.entries.find((e) => e.code === "QI")?.species).toEqual([]);
  });
});

describe("main", () => {
  let log: jest.SpyInstance;
  let argv: string[];

  beforeEach(() => {
    argv = process.argv;
    log = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  it("refuses to retire against an extract that is not a full release", async () => {
    // A truncated file must never deactivate the vocabulary: switching most of
    // ATCvet off takes medication search down, which is far worse than leaving
    // a withdrawn code active for one release cycle.
    const { prisma } = jest.requireMock("src/config/prisma") as {
      prisma: {
        codeEntry: { count: jest.Mock; updateMany: jest.Mock };
        codeRelationship: { createMany: jest.Mock };
        $transaction: jest.Mock;
      };
    };
    prisma.codeEntry.count.mockResolvedValue(8315);
    prisma.codeEntry.updateMany.mockResolvedValue({ count: 0 });
    prisma.codeRelationship.createMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockResolvedValue([]);

    jest
      .spyOn(fs, "existsSync")
      .mockReturnValue(true as unknown as ReturnType<typeof fs.existsSync>);
    jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        source: "WHO CC",
        dataset: "ATCvet index",
        release: "2026",
        entries: [{ code: "QJ01AA02", name: "doxycycline" }],
      }) as unknown as ReturnType<typeof fs.readFileSync>,
    );

    process.argv = [
      "node",
      "import-atcvet-index.ts",
      "data/partial.json",
      "--apply",
    ];
    await main();

    expect(prisma.codeEntry.updateMany).not.toHaveBeenCalled();
    expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(
      /SKIP retirement/,
    );
    jest.restoreAllMocks();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = argv;
    log.mockRestore();
  });

  it("refuses a path outside the working tree", async () => {
    process.argv = ["node", "import-atcvet-index.ts", "../../etc/passwd.json"];
    await expect(main()).rejects.toThrow("Invalid file path");
  });

  it("refuses an absolute path", async () => {
    process.argv = ["node", "import-atcvet-index.ts", "/etc/passwd.json"];
    await expect(main()).rejects.toThrow("Invalid file path");
  });
});
