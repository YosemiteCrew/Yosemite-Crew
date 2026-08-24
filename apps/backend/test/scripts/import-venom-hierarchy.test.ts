import {
  planImport,
  categoryCode,
  type VenomExtract,
} from "src/scripts/import-venom-hierarchy";

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

const index = (pairs: Array<[string, string]>) => new Map(pairs);

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

  it("namespaces category codes so they cannot collide with a term code", () => {
    expect(categoryCode("24")).toBe("YCAT:VENOM:24");
    expect(categoryCode("24")).not.toMatch(/^YC-\d+$/);
  });
});
