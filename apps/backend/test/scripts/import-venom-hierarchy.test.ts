jest.mock("src/config/prisma", () => ({
  prisma: {
    codeMapping: { findMany: jest.fn() },
    codeEntry: { upsert: jest.fn((args: unknown) => args) },
    codeRelationship: { createMany: jest.fn((args: unknown) => args) },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

import fs from "node:fs";
import { prisma } from "src/config/prisma";
import {
  planImport,
  categoryCode,
  loadExtract,
  loadVenomIndex,
  main,
  type VenomExtract,
} from "src/scripts/import-venom-hierarchy";

const prismaMock = prisma as unknown as {
  codeMapping: { findMany: jest.Mock };
  codeEntry: { upsert: jest.Mock };
  codeRelationship: { createMany: jest.Mock };
  $transaction: jest.Mock;
};

const extract = (
  edges: Array<[string, string, string]>,
  names: Record<string, string> = {},
): VenomExtract => ({
  source: "VeNom",
  release: "g",
  released: "2024-01",
  names,
  edges,
});

const index = (pairs: Array<[string, string]>) => {
  const map = new Map<string, string[]>();
  for (const [venomId, ycCode] of pairs) {
    const codes = map.get(venomId);
    if (codes) codes.push(ycCode);
    else map.set(venomId, [ycCode]);
  }
  return map;
};

describe("planImport", () => {
  it("mints a category for a parent VeNom does not publish as a term", () => {
    // 2,296 of the parents are taxonomy nodes that appear only as relationship
    // endpoints. Without minting them there is nothing for the edges to attach to,
    // which is why the hierarchy had never been imported.
    const plan = planImport(
      extract([["13", "is a", "24"]], { "24": "Haircoat/skin finding" }),
      index([["13", "YC-1"]]),
    );

    expect(plan.categories).toEqual([
      {
        code: "YCAT:VENOM:24",
        display: "Haircoat/skin finding",
        venomId: "24",
      },
    ]);
    expect(plan.edges).toEqual([
      { sourceCode: "YC-1", type: "is a", targetCode: "YCAT:VENOM:24" },
    ]);
  });

  it("uses the existing concept when the parent is already a real term", () => {
    // A parent that is itself a clinical term must not be duplicated as a heading.
    const plan = planImport(
      extract([["13", "is a", "24"]], { "24": "Alopecia finding" }),
      index([
        ["13", "YC-1"],
        ["24", "YC-2"],
      ]),
    );

    expect(plan.categories).toEqual([]);
    expect(plan.edges).toEqual([
      { sourceCode: "YC-1", type: "is a", targetCode: "YC-2" },
    ]);
  });

  it("does not import breed relationships", () => {
    // Breeds are keyed by IDEXX-derived codes here, not VeNom ids. Guessing that join
    // would attach the wrong breed to a clinical record.
    const plan = planImport(
      extract([["13", "is breed of", "24"]], { "24": "Dog" }),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/is breed of/);
  });

  it("skips an edge whose child is not a concept we hold", () => {
    const plan = planImport(
      extract([["999", "is a", "24"]], { "24": "Some finding" }),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/child is not a known concept/);
    // The unknown child must not be invented as a category either.
    expect(plan.categories).toEqual([]);
  });

  it("skips a parent that is unknown and has no name to mint from", () => {
    const plan = planImport(
      extract([["13", "is a", "24"]], {}),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/unknown and unnamed/);
  });

  it("skips a self-referential edge", () => {
    const plan = planImport(
      extract([["13", "is a", "13"]], { "13": "Alopecia" }),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/self-referential/);
  });

  it("collapses duplicate edges, which VeNom's own file contains", () => {
    const plan = planImport(
      extract(
        [
          ["13", "is a", "24"],
          ["13", "is a", "24"],
        ],
        { "24": "Finding" },
      ),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges).toHaveLength(1);
    expect(plan.skipped[0].reason).toMatch(/duplicate/);
  });

  it("keeps two different relationship types between the same pair", () => {
    // CodeMapping could not express this, which is why a new table exists.
    const plan = planImport(
      extract(
        [
          ["13", "is a", "24"],
          ["13", "is in container", "24"],
        ],
        { "24": "Finding" },
      ),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges.map((e) => e.type)).toEqual(["is a", "is in container"]);
  });

  it("mints no category for a relationship type it does not import", () => {
    // The type is checked before the parent is resolved, so a skipped edge never
    // creates a category. If that order were reversed, "Orphan parent" would be
    // minted as a clinical category that nothing points at.
    const plan = planImport(
      extract(
        [
          ["13", "is breed of", "50"],
          ["13", "is a", "24"],
        ],
        { "50": "Orphan parent", "24": "Real finding" },
      ),
      index([["13", "YC-1"]]),
    );

    expect(plan.categories.map((c) => c.code)).toEqual(["YCAT:VENOM:24"]);
    expect(plan.categories.map((c) => c.display)).not.toContain(
      "Orphan parent",
    );
  });

  it("keeps every concept when one VeNom id maps to several", () => {
    // Real case: VeNom 18827 "Drinking less" exists as both a PresentingComplaint and a
    // ReasonForVisit. A single-valued index would drop one of them, and with it that
    // concept's whole hierarchy.
    const plan = planImport(
      extract([["18827", "is a", "24"]], { "24": "Water intake finding" }),
      index([
        ["18827", "YC-005465"],
        ["18827", "YC-006862"],
      ]),
    );

    expect(plan.edges).toEqual([
      { sourceCode: "YC-005465", type: "is a", targetCode: "YCAT:VENOM:24" },
      { sourceCode: "YC-006862", type: "is a", targetCode: "YCAT:VENOM:24" },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it("still reports a self-referential edge when the only pairing is a self loop", () => {
    const plan = planImport(
      extract([["13", "is a", "13"]], { "13": "Alopecia" }),
      index([["13", "YC-1"]]),
    );

    expect(plan.edges).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/self-referential/);
  });

  it("namespaces category codes so they cannot collide with a term code", () => {
    expect(categoryCode("24")).toBe("YCAT:VENOM:24");
    expect(categoryCode("24")).not.toMatch(/^YC-\d+$/);
  });
});

describe("loadExtract", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reads and parses the extract", () => {
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({ edges: [], names: {} }) as never);

    expect(loadExtract("data/venom_relationships.json")).toEqual({
      edges: [],
      names: {},
    });
  });

  it("refuses a traversing or absolute path", () => {
    expect(() => loadExtract("../secrets.json")).toThrow("Invalid file path");
    expect(() => loadExtract("/etc/passwd")).toThrow("Invalid file path");
  });
});

describe("loadVenomIndex", () => {
  beforeEach(() => jest.clearAllMocks());

  it("groups every YC code that shares a VeNom id", async () => {
    prismaMock.codeMapping.findMany.mockResolvedValue([
      { sourceCode: "YC-005465", targetCode: "18827" },
      { sourceCode: "YC-006862", targetCode: "18827" },
      { sourceCode: "YC-1", targetCode: " 13 " },
    ]);

    const index = await loadVenomIndex();

    expect(index.get("18827")).toEqual(["YC-005465", "YC-006862"]);
    // Ids are trimmed, because the spreadsheet carries padding.
    expect(index.get("13")).toEqual(["YC-1"]);
  });

  it("asks the database for a deterministic order", async () => {
    prismaMock.codeMapping.findMany.mockResolvedValue([]);
    await loadVenomIndex();
    expect(prismaMock.codeMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sourceCode: "asc" } }),
    );
  });
});

describe("main", () => {
  let log: jest.SpyInstance;
  let argv: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    argv = process.argv;
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        source: "VeNom",
        release: "g",
        released: "2024-01",
        names: { "24": "Some finding" },
        edges: [["13", "is a", "24"]],
      }) as never,
    );
    prismaMock.codeMapping.findMany.mockResolvedValue([
      { sourceCode: "YC-1", targetCode: "13" },
    ]);
    prismaMock.$transaction.mockResolvedValue([{}, { count: 1 }]);
  });

  afterEach(() => {
    process.argv = argv;
    jest.restoreAllMocks();
  });

  const output = () => log.mock.calls.map((c) => String(c[0])).join("\n");

  it("writes nothing without --apply", async () => {
    process.argv = ["node", "import-venom-hierarchy.ts"];
    await main();

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(output()).toMatch(/dry run/);
    expect(output()).toMatch(/edges to add:\s+1/);
  });

  it("writes categories and edges in a single transaction", async () => {
    // Separate commits would leave categories behind if the edge insert failed.
    process.argv = ["node", "import-venom-hierarchy.ts", "--apply"];
    await main();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const operations = prismaMock.$transaction.mock.calls[0][0];
    expect(operations).toHaveLength(2);
    // "upserted" rather than "wrote": on a rerun most categories already exist, so
    // reporting the plan size as work done would overstate every run after the first.
    expect(output()).toMatch(/upserted 1 categories and added 1 edges/);
  });

  it("says plainly that withdrawn edges are not deactivated", async () => {
    process.argv = ["node", "import-venom-hierarchy.ts", "--apply"];
    await main();
    expect(output()).toMatch(/not deactivated by this run/);
  });

  it("reports edges that already existed", async () => {
    process.argv = ["node", "import-venom-hierarchy.ts", "--apply"];
    prismaMock.$transaction.mockResolvedValue([{}, { count: 0 }]);
    await main();
    expect(output()).toMatch(/1 edges already existed/);
  });
});
