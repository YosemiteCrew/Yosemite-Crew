jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import {
  ancestorCodesOf,
  AtcvetService,
  buildMedicationQuery,
} from "src/services/atcvet.service";

const queryRaw = prisma.$queryRaw as unknown as jest.Mock;
const entryFind = (prisma as unknown as { codeEntry: { findMany: jest.Mock } })
  .codeEntry.findMany;

beforeEach(() => {
  queryRaw.mockReset();
  entryFind.mockReset();
});

describe("ancestorCodesOf", () => {
  it("derives the four levels above a substance from the code itself", () => {
    expect(ancestorCodesOf("QJ01AA02")).toEqual([
      "QJ",
      "QJ01",
      "QJ01A",
      "QJ01AA",
    ]);
  });

  it("returns only the levels that exist above a group", () => {
    expect(ancestorCodesOf("QJ01A")).toEqual(["QJ", "QJ01"]);
    expect(ancestorCodesOf("QJ")).toEqual([]);
  });
});

describe("buildMedicationQuery", () => {
  const sqlFor = (params: Parameters<typeof buildMedicationQuery>[0]) => {
    const statement = buildMedicationQuery(params);
    return { text: statement.sql, values: statement.values };
  };

  it("searches substances only, never the grouping levels", () => {
    const { text } = sqlFor({ q: "doxy" });
    expect(text).toContain(`'MEDICATION'::"CodeType"`);
    expect(text).not.toContain("MEDICATION_CATEGORY");
  });

  it("escapes LIKE wildcards so a lone % cannot match everything", () => {
    const { values } = sqlFor({ q: "50%" });
    expect(values).toContain("%50\\%%");
  });

  it("keeps species-agnostic substances in a species-filtered search", () => {
    // Only immunologicals carry species. Excluding rows without species would
    // hide doxycycline from a cat clinic's search.
    const { text } = sqlFor({ q: "vac", species: "SA" });
    expect(text).toContain("IS DISTINCT FROM 'array'");
    expect(text).toContain("@>");
  });

  it("omits filters that were not asked for", () => {
    const { text } = sqlFor({});
    expect(text).not.toContain("atcGroup");
    expect(text).not.toContain("ILIKE");
  });

  it("clamps the limit into range", () => {
    expect(sqlFor({ limit: 500 }).values).toContain(50);
    expect(sqlFor({ limit: 0 }).values).toContain(1);
  });
});

describe("suggestMedications", () => {
  it("attaches the ancestor path and flags in one batched lookup", async () => {
    queryRaw.mockResolvedValue([
      {
        code: "QJ01AA02",
        display: "doxycycline",
        meta: { atcGroup: "QJ", antibacterial: true },
      },
      { code: "QJ01AA01", display: "demeclocycline", meta: { atcGroup: "QJ" } },
    ]);
    entryFind.mockResolvedValue([
      { code: "QJ", display: "ANTIINFECTIVES FOR SYSTEMIC USE" },
      { code: "QJ01", display: "ANTIBACTERIALS FOR SYSTEMIC USE" },
      { code: "QJ01A", display: "TETRACYCLINES" },
      { code: "QJ01AA", display: "Tetracyclines" },
    ]);

    const result = await AtcvetService.suggestMedications({ q: "cycline" });

    // Two results sharing ancestors cost one ancestor query, not two.
    expect(entryFind).toHaveBeenCalledTimes(1);
    expect(entryFind.mock.calls[0][0].where.code.in).toEqual([
      "QJ",
      "QJ01",
      "QJ01A",
      "QJ01AA",
    ]);
    expect(result[0]).toEqual({
      atcCode: "QJ01AA02",
      label: "doxycycline",
      path: [
        { code: "QJ", label: "ANTIINFECTIVES FOR SYSTEMIC USE" },
        { code: "QJ01", label: "ANTIBACTERIALS FOR SYSTEMIC USE" },
        { code: "QJ01A", label: "TETRACYCLINES" },
        { code: "QJ01AA", label: "Tetracyclines" },
      ],
      species: [],
      antibacterial: true,
    });
    // The stewardship flag is a fact of the code, not of the search.
    expect(result[1].antibacterial).toBe(false);
  });

  it("drops an ancestor that is missing rather than rendering a blank crumb", async () => {
    queryRaw.mockResolvedValue([
      { code: "QJ01AA02", display: "doxycycline", meta: {} },
    ]);
    entryFind.mockResolvedValue([{ code: "QJ", display: "ANTIINFECTIVES" }]);

    const [result] = await AtcvetService.suggestMedications({ q: "doxy" });

    expect(result.path).toEqual([{ code: "QJ", label: "ANTIINFECTIVES" }]);
  });

  it("surfaces species carried by immunologicals", async () => {
    queryRaw.mockResolvedValue([
      {
        code: "QI07AA01",
        display: "canine distemper vaccine",
        meta: { species: ["SA"], atcGroup: "QI" },
      },
    ]);
    entryFind.mockResolvedValue([]);

    const [result] = await AtcvetService.suggestMedications({ q: "distemper" });

    expect(result.species).toEqual(["SA"]);
  });

  it("makes no ancestor query for an empty page", async () => {
    queryRaw.mockResolvedValue([]);
    expect(await AtcvetService.suggestMedications({ q: "zzz" })).toEqual([]);
    expect(entryFind).not.toHaveBeenCalled();
  });
});
