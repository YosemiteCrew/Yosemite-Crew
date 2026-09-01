jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: { findMany: jest.fn() },
    drugFormulary: { findMany: jest.fn(), updateMany: jest.fn() },
    inventoryItem: { findMany: jest.fn(), updateMany: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import {
  main,
  normalise,
  planBackfill,
  stripPresentation,
} from "src/scripts/backfill-atc-codes";

const codeFind = (prisma as unknown as { codeEntry: { findMany: jest.Mock } })
  .codeEntry.findMany;
const formularyFind = (
  prisma as unknown as { drugFormulary: { findMany: jest.Mock } }
).drugFormulary.findMany;
const inventoryFind = (
  prisma as unknown as { inventoryItem: { findMany: jest.Mock } }
).inventoryItem.findMany;
const formularyUpdate = (
  prisma as unknown as { drugFormulary: { updateMany: jest.Mock } }
).drugFormulary.updateMany;

beforeEach(() => {
  jest.clearAllMocks();
  formularyFind.mockResolvedValue([]);
  inventoryFind.mockResolvedValue([]);
  codeFind.mockResolvedValue([]);
});

describe("stripPresentation", () => {
  it("drops a trailing strength and form so a product matches its substance", () => {
    expect(stripPresentation("Cefalexin 250 mg Tablet")).toBe("cefalexin");
    expect(stripPresentation("Itraconazole 100 mg Capsule")).toBe(
      "itraconazole",
    );
  });

  it("strips a percentage strength, which normalise has already unpunctuated", () => {
    // "Hydrocortisone 1% cream" normalises to "hydrocortisone 1 cream"; if the
    // unit is required the strength survives and the drug matches nothing.
    expect(stripPresentation("Hydrocortisone 1% cream")).toBe("hydrocortisone");
    expect(stripPresentation("Enrofloxacin 2.5 % Injection")).toBe(
      "enrofloxacin",
    );
  });

  it("keeps a leading number, which belongs to the name", () => {
    // "5-fluorouracil" is a substance; stripping its number would break it.
    expect(stripPresentation("5-Fluorouracil")).toBe("5 fluorouracil");
  });
});

describe("planBackfill", () => {
  const withSubstances = (rows: Array<[string, string]>) =>
    codeFind.mockResolvedValue(
      rows.map(([code, display]) => ({ code, display })),
    );

  it("matches on the generic name in preference to the product name", async () => {
    withSubstances([["QJ01DB01", "cefalexin"]]);
    formularyFind.mockResolvedValue([
      { id: "f1", drugName: "Ceflex Brand Tabs", genericName: "Cefalexin" },
    ]);

    const { formulary } = await planBackfill();

    expect(formulary[0]).toEqual({
      id: "f1",
      name: "Ceflex Brand Tabs",
      matchedOn: "genericName",
      resolved: "QJ01DB01",
    });
  });

  it("prefers the generic name when the product name also matches a substance", async () => {
    // Only a row whose two fields resolve to DIFFERENT substances can pin the
    // preference: a product carrying an ingredient's name while its generic field
    // names the actual substance must be coded from the generic.
    withSubstances([
      ["QM01AE01", "ibuprofen"],
      ["QJ01DB01", "cefalexin"],
    ]);
    formularyFind.mockResolvedValue([
      { id: "f1", drugName: "Ibuprofen", genericName: "Cefalexin" },
    ]);

    const { formulary } = await planBackfill();

    expect(formulary[0]).toMatchObject({
      matchedOn: "genericName",
      resolved: "QJ01DB01",
    });
  });

  it("refuses to choose when a substance holds several codes", async () => {
    // Ibuprofen really is QC01EB16, QG02CC01 and QM01AE01 in ATCvet. Picking one
    // would file the drug under a therapeutic class it may not belong to.
    withSubstances([
      ["QC01EB16", "ibuprofen"],
      ["QG02CC01", "ibuprofen"],
      ["QM01AE01", "ibuprofen"],
    ]);
    inventoryFind.mockResolvedValue([
      { id: "i1", name: "Ibuprofen", genericName: "Ibuprofen" },
    ]);

    const { inventory } = await planBackfill();

    expect(inventory[0].resolved).toBeNull();
    expect(inventory[0].reason).toBe("ambiguous: QC01EB16, QG02CC01, QM01AE01");
  });

  it("reports a name the classification does not hold rather than guessing", async () => {
    // ATCvet uses the INN spelling "cefalexin"; "Cephalexin" is not in it.
    withSubstances([["QJ01DB01", "cefalexin"]]);
    inventoryFind.mockResolvedValue([
      { id: "i1", name: "Cephalexin 250 mg Tablet", genericName: "Cephalexin" },
    ]);

    const { inventory } = await planBackfill();

    expect(inventory[0].resolved).toBeNull();
    expect(inventory[0].reason).toMatch(/no ATCvet substance/);
  });

  it("falls back to the product name when there is no generic", async () => {
    withSubstances([["QJ02AC02", "itraconazole"]]);
    inventoryFind.mockResolvedValue([
      { id: "i1", name: "Itraconazole 100 mg Capsule", genericName: null },
    ]);

    const { inventory } = await planBackfill();

    expect(inventory[0]).toMatchObject({
      matchedOn: "name",
      resolved: "QJ02AC02",
    });
  });

  it("only considers rows that are still uncoded, and stock ATCvet can classify", async () => {
    await planBackfill();

    expect(formularyFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { atcCode: null } }),
    );
    const where = inventoryFind.mock.calls[0][0].where;
    expect(where.atcCode).toBeNull();
    // Vaccines are their own inventory category and are exactly the QI codes
    // carrying species, so a "medic"-only filter silently skipped all of them.
    const categories = where.OR.map(
      (clause: { category: { contains: string } }) => clause.category.contains,
    );
    expect(categories).toContain("medic");
    expect(categories).toContain("vaccin");
  });
});

describe("main", () => {
  let log: jest.SpyInstance;
  let argv: string[];

  beforeEach(() => {
    argv = process.argv;
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    codeFind.mockResolvedValue([{ code: "QJ01DB01", display: "cefalexin" }]);
    formularyFind.mockResolvedValue([
      { id: "f1", drugName: "Cefalexin", genericName: null },
    ]);
    formularyUpdate.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    process.argv = argv;
    log.mockRestore();
  });

  const output = () => log.mock.calls.map((c) => String(c[0])).join("\n");

  it("writes nothing without --apply", async () => {
    process.argv = ["node", "backfill-atc-codes.ts"];
    await main();

    expect(formularyUpdate).not.toHaveBeenCalled();
    expect(output()).toMatch(/dry run/);
  });

  it("writes only while the row is still uncoded", async () => {
    process.argv = ["node", "backfill-atc-codes.ts", "--apply"];
    await main();

    expect(formularyUpdate).toHaveBeenCalledWith({
      where: { id: "f1", atcCode: null },
      data: { atcCode: "QJ01DB01" },
    });
    expect(output()).toMatch(/wrote 1 rows/);
  });

  it("reports rows coded by someone else mid-run", async () => {
    process.argv = ["node", "backfill-atc-codes.ts", "--apply"];
    formularyUpdate.mockResolvedValue({ count: 0 });

    await main();

    expect(output()).toMatch(/coded by someone else/);
  });

  it("names every skipped row and why", async () => {
    process.argv = ["node", "backfill-atc-codes.ts"];
    formularyFind.mockResolvedValue([
      { id: "f1", drugName: "Cephalexin", genericName: null },
    ]);

    await main();

    expect(output()).toMatch(/SKIP "Cephalexin"/);
    expect(output()).toMatch(/no ATCvet substance/);
  });
});

describe("normalise", () => {
  it("compares on letters and digits only", () => {
    expect(normalise("Cefalexin-250 (mg)")).toBe("cefalexin 250 mg");
  });
});
