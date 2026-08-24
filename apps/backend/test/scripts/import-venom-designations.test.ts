jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn((...args: unknown[]) => args),
    $disconnect: jest.fn(),
  },
}));

import fs from "node:fs";
import { prisma } from "src/config/prisma";
import {
  planDesignations,
  loadDesignations,
  loadExistingDesignations,
  main,
  type DesignationExtract,
  type Designation,
} from "src/scripts/import-venom-designations";

const prismaMock = prisma as unknown as {
  codeEntry: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

const extract = (
  designations: Array<[string, string, string, string]>,
): DesignationExtract => ({
  source: "VeNom",
  release: "g",
  released: "2024-01",
  designations,
});

const existing = (
  pairs: Array<[string, Designation[]]>,
  synonyms: Record<string, string[]> = {},
) =>
  new Map(
    pairs.map(([code, designations]) => [
      code,
      { designations, synonyms: synonyms[code] ?? [] },
    ]),
  );

describe("planDesignations", () => {
  it("adds a translation to an existing concept rather than creating a new term", () => {
    // A translation must never become a separate concept, or a clinician would be
    // offered "Alopecia" and its Spanish label as two different things to pick.
    const plan = planDesignations(
      extract([["YC-1", "Anomalía de comportamiento", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Behavioural abnormality",
              lang: "en",
              source: "venom",
              preferred: true,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts).toHaveLength(1);
    expect(plan.concepts[0].designations).toEqual([
      {
        term: "Behavioural abnormality",
        lang: "en",
        source: "venom",
        preferred: true,
      },
      {
        term: "Anomalía de comportamiento",
        lang: "es-ES",
        source: "venom",
        preferred: false,
      },
    ]);
  });

  it("never marks a translation preferred", () => {
    // The preferred designation decides what the UI shows by default. A translation
    // taking that slot would silently change the displayed term.
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "es-ES", "name"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].designations.every((d) => !d.preferred)).toBe(true);
  });

  it("keeps the designations a concept already had", () => {
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "pt-BR", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Hair loss",
              lang: "en",
              source: "local",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts[0].designations).toContainEqual({
      term: "Hair loss",
      lang: "en",
      source: "local",
      preferred: false,
    });
  });

  it("does not add a designation the concept already carries", () => {
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Alopecia",
              lang: "es-ES",
              source: "venom",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/already present/);
  });

  it("treats the same word in another language as a different designation", () => {
    // "Alopecia" is its own translation in Spanish. That is a real designation, not a
    // duplicate, and dropping it would leave the Spanish label missing.
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [{ term: "Alopecia", lang: "en", source: "venom", preferred: true }],
        ],
      ]),
    );

    expect(plan.concepts[0].added).toBe(1);
  });

  it("collapses a duplicate appearing twice in the file", () => {
    const plan = planDesignations(
      extract([
        ["YC-1", "Sangrado", "es-ES", "name"],
        ["YC-1", "Sangrado", "es-ES", "name"],
      ]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].added).toBe(1);
    expect(plan.skipped[0].reason).toMatch(/already present/);
  });

  it("dedups when the language differs only by surrounding whitespace", () => {
    // Review flagged that seen-keys might use a raw language while stored designations
    // use a trimmed one, letting " es-ES " slip past as a second copy. key() trims both
    // sides, so it does not - this locks that in rather than leaving it to inspection.
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "  es-ES  ", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Sangrado",
              lang: "es-ES",
              source: "venom",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/already present/);
  });

  it("stores the language trimmed so two spellings cannot both persist", () => {
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "  es-ES  ", "name"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].designations[0].lang).toBe("es-ES");
  });

  it("skips a translation for a concept we do not hold", () => {
    const plan = planDesignations(
      extract([["YC-nope", "Sangrado", "es-ES", "name"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/concept not found/);
  });

  it("skips an empty term or language", () => {
    const plan = planDesignations(
      extract([
        ["YC-1", "   ", "es-ES", "name"],
        ["YC-1", "Sangrado", "  ", "name"],
      ]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped).toHaveLength(2);
  });

  it("carries a synonym in the same language, not only translations", () => {
    // VeNom's file also holds two en-GB synonyms. They are designations too.
    const plan = planDesignations(
      extract([["YC-1", "German shepherd dog", "en-GB", "synonym"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].designations[0]).toMatchObject({
      term: "German shepherd dog",
      lang: "en-GB",
    });
  });

  it("reports nothing to do when every translation is already present", () => {
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "sangrado",
              lang: "ES-es",
              source: "venom",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    // Case and locale casing must not create a second copy of the same designation.
    expect(plan.concepts).toHaveLength(0);
  });
});

describe("search visibility", () => {
  it("folds every added designation into synonyms, where search actually looks", () => {
    // The defect this exists for: --apply wrote meta.designations only, while
    // suggestTerms matches on display and synonyms. 12,738 translations imported
    // cleanly and none of them could ever be returned by a search.
    const plan = planDesignations(
      extract([
        ["YC-1", "Anomalía de comportamiento", "es-ES", "name"],
        ["YC-1", "Alteração de comportamento", "pt-BR", "name"],
      ]),
      existing([["YC-1", []]], { "YC-1": ["Behavioural abnormality"] }),
    );

    expect(plan.concepts[0].synonyms).toEqual([
      "Behavioural abnormality",
      "Anomalía de comportamiento",
      "Alteração de comportamento",
    ]);
  });

  it("does not duplicate a synonym the entry already carries", () => {
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "es-ES", "name"]]),
      existing([["YC-1", []]], { "YC-1": ["alopecia", "Hair loss"] }),
    );

    // Case-insensitively already present, so the synonym list is unchanged; the
    // designation itself is still added, because es-ES did not carry it yet.
    expect(plan.concepts[0].synonyms).toEqual(["alopecia", "Hair loss"]);
    expect(plan.concepts[0].added).toBe(1);
  });

  it("keeps existing synonyms first so display ordering is stable", () => {
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "es-ES", "name"]]),
      existing([["YC-1", []]], { "YC-1": ["Bleeding", "Haemorrhage"] }),
    );

    expect(plan.concepts[0].synonyms.slice(0, 2)).toEqual([
      "Bleeding",
      "Haemorrhage",
    ]);
  });
});

describe("loadDesignations", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reads and parses the extract", () => {
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({ designations: [] }) as never);

    expect(loadDesignations("data/venom_designations.json")).toEqual({
      designations: [],
    });
  });

  it("refuses a traversing or absolute path", () => {
    expect(() => loadDesignations("../secrets.json")).toThrow(
      "Invalid file path",
    );
    expect(() => loadDesignations("/etc/passwd")).toThrow("Invalid file path");
  });
});

describe("loadExistingDesignations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the designations a concept already carries", async () => {
    prismaMock.codeEntry.findMany.mockResolvedValue([
      {
        code: "YC-1",
        meta: {
          designations: [
            { term: "Vomiting", lang: "en", source: "venom", preferred: true },
          ],
        },
      },
    ]);

    const index = await loadExistingDesignations();

    expect(index.get("YC-1")).toEqual({
      designations: [
        { term: "Vomiting", lang: "en", source: "venom", preferred: true },
      ],
      synonyms: [],
    });
  });

  it("loads breed entries too, so VeNom's breed designations resolve", async () => {
    // The file's two en-GB synonyms target a YBREED code; a CLINICAL_TERM-only load
    // skipped them as "concept not found".
    prismaMock.codeEntry.findMany.mockResolvedValue([]);

    await loadExistingDesignations();

    expect(prismaMock.codeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["CLINICAL_TERM", "BREED"] },
        }),
      }),
    );
  });

  it("reads the synonyms column, which is where search looks", async () => {
    prismaMock.codeEntry.findMany.mockResolvedValue([
      { code: "YC-1", meta: null, synonyms: ["Vomiting", "  Emesis  ", 7, ""] },
    ]);

    const index = await loadExistingDesignations();

    expect(index.get("YC-1")?.synonyms).toEqual(["Vomiting", "Emesis"]);
  });

  it("treats malformed meta as no designations rather than throwing", async () => {
    // meta is free-form JSON, so a concept can carry anything at all there.
    prismaMock.codeEntry.findMany.mockResolvedValue([
      { code: "YC-1", meta: null },
      { code: "YC-2", meta: { designations: "not-an-array" } },
      { code: "YC-3", meta: { designations: [{ nonsense: true }] } },
    ]);

    const index = await loadExistingDesignations();

    expect(index.get("YC-1")?.designations).toEqual([]);
    expect(index.get("YC-2")?.designations).toEqual([]);
    expect(index.get("YC-3")?.designations).toEqual([]);
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
        designations: [["YC-1", "Sangrado", "es-ES", "name"]],
      }) as never,
    );
    prismaMock.codeEntry.findMany.mockResolvedValue([
      { code: "YC-1", meta: { designations: [] } },
    ]);
    prismaMock.$transaction.mockResolvedValue([]);
  });

  afterEach(() => {
    process.argv = argv;
    jest.restoreAllMocks();
  });

  const output = () => log.mock.calls.map((c) => String(c[0])).join("\n");

  it("writes nothing without --apply", async () => {
    process.argv = ["node", "import-venom-designations.ts"];
    await main();

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(output()).toMatch(/dry run/);
    expect(output()).toMatch(/designations to add:\s+1/);
  });

  it("writes in a single transaction with --apply", async () => {
    // A half-translated vocabulary is worse than an untranslated one: it looks finished.
    process.argv = ["node", "import-venom-designations.ts", "--apply"];
    await main();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // The statement itself must write synonyms, not only meta.designations. A write
    // that skips synonyms lands translations search can never see - which is the
    // defect this importer shipped with, and a planner-only test would miss it again.
    const statements = JSON.stringify(prismaMock.$transaction.mock.calls[0][0]);
    expect(statements).toContain('\\"synonyms\\" =');
    // The bare-array form is the synonyms parameter; the designation object also
    // mentions the term, so match the shape that only synonyms produces.
    expect(statements).toContain('[\\"Sangrado\\"]');
    expect(output()).toMatch(/wrote 1 designations across 1 concepts/);
  });

  it("reports why designations were skipped", async () => {
    process.argv = ["node", "import-venom-designations.ts"];
    prismaMock.codeEntry.findMany.mockResolvedValue([]);
    await main();

    expect(output()).toMatch(/concept not found/);
  });
});
