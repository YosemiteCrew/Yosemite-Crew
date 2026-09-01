import {
  ClinicalTermsService,
  buildSuggestionQuery,
} from "../../src/services/clinical-terms.service";
import { CodeService } from "src/services/code.service";
import { prisma } from "src/config/prisma";
import fs from "node:fs";
import path from "node:path";

jest.mock("src/services/code.service", () => ({
  CodeService: {
    upsertEntry: jest.fn(),
    upsertMapping: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: {
      findMany: jest.fn(),
    },
    codeMapping: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

describe("ClinicalTermsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
    // Default: no crosswalks. Tests that assert on them override this.
    (prisma.codeMapping.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe("parseConcepts", () => {
    it("parses valid concept payloads", () => {
      const concepts = ClinicalTermsService.parseConcepts([
        {
          ycCode: "YC-1",
          label: "Vomiting",
          domain: "Diagnosis",
          active: true,
          source: "VeNom",
          designations: [{ term: "Emesis", lang: "en", source: "venom" }],
          codes: [
            {
              system: "urn:venom",
              code: "123",
              display: "Vomiting",
              equivalence: "equivalent",
            },
          ],
          species: ["SA"],
        },
      ]);

      expect(concepts).toHaveLength(1);
      expect(concepts[0].ycCode).toBe("YC-1");
    });
  });

  describe("importConcepts", () => {
    it("upserts canonical entries and every supported coding, with its equivalence", async () => {
      const result = await ClinicalTermsService.importConcepts([
        {
          ycCode: "YC-1",
          label: "Vomiting",
          domain: "Diagnosis",
          active: true,
          source: "VeNom",
          designations: [
            {
              term: "Vomiting",
              lang: "en",
              source: "venom",
              preferred: true,
            },
            {
              term: "Emesis",
              lang: "en",
              source: "snomed",
              preferred: false,
            },
          ],
          codes: [
            {
              system: "urn:venom",
              code: "123",
              display: "Vomiting",
              equivalence: "equivalent",
            },
            {
              system: "http://snomed.info/sct",
              code: "456",
              display: "Vomiting finding",
              equivalence: "related",
            },
          ],
          species: ["SA"],
        },
      ]);

      expect(CodeService.upsertEntry).toHaveBeenCalledWith({
        system: "YOSEMITECODE",
        code: "YC-1",
        display: "Vomiting",
        type: "CLINICAL_TERM",
        active: true,
        synonyms: ["Vomiting", "Emesis"],
        meta: {
          domain: "Diagnosis",
          species: ["SA"],
          source: "VeNom",
          preferredTerm: "Vomiting",
          designations: [
            {
              term: "Vomiting",
              lang: "en",
              source: "venom",
              preferred: true,
            },
            {
              term: "Emesis",
              lang: "en",
              source: "snomed",
              preferred: false,
            },
          ],
          codes: [
            {
              system: "urn:venom",
              code: "123",
              display: "Vomiting",
              equivalence: "equivalent",
            },
            {
              system: "http://snomed.info/sct",
              code: "456",
              display: "Vomiting finding",
              equivalence: "related",
            },
          ],
        },
      });

      // Both codings are kept now. Previously anything not exactly "equivalent" was
      // skipped, so a related crosswalk was not weakened - it vanished with no trace.
      expect(CodeService.upsertMapping).toHaveBeenCalledTimes(2);
      expect(CodeService.upsertMapping).toHaveBeenCalledWith({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YC-1",
        targetSystem: "VENOM",
        targetCode: "123",
        targetDisplay: "Vomiting",
        targetVersion: null,
        equivalence: "EQUIVALENT",
        active: true,
      });
      expect(CodeService.upsertMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSystem: "SNOMED",
          equivalence: "RELATEDTO",
        }),
      );
      expect(result).toEqual({ entriesUpserted: 1, mappingsUpserted: 2 });
    });
  });

  describe("equivalence", () => {
    const concept = (equivalence: string) => ({
      ycCode: "YC-9",
      label: "Vomiting",
      domain: "Diagnosis" as const,
      active: true,
      source: "VeNom" as const,
      designations: [],
      species: [],
      codes: [
        {
          system: "http://snomed.info/sct",
          code: "422400008",
          display: "Vomiting",
          equivalence,
        },
      ],
    });

    it("records a narrower crosswalk as narrower rather than dropping it", async () => {
      await ClinicalTermsService.importConcepts([concept("narrower") as never]);

      expect(CodeService.upsertMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          targetCode: "422400008",
          equivalence: "NARROWER",
        }),
      );
    });

    it("maps the extract's wording onto the FHIR vocabulary", async () => {
      await ClinicalTermsService.importConcepts([concept("broader") as never]);
      expect(CodeService.upsertMapping).toHaveBeenLastCalledWith(
        expect.objectContaining({ equivalence: "WIDER" }),
      );

      await ClinicalTermsService.importConcepts([concept("inexact") as never]);
      expect(CodeService.upsertMapping).toHaveBeenLastCalledWith(
        expect.objectContaining({ equivalence: "INEXACT" }),
      );
    });

    it("survives an unrecognised equivalence coming through the file path", async () => {
      // The bug this covers: parseConcepts validated equivalence with z.enum, so an
      // unfamiliar word threw before the INEXACT fallback could run. The earlier test
      // passed only because it called importConcepts directly, bypassing validation.
      const parsed = ClinicalTermsService.parseConcepts([
        {
          ycCode: "YC-1",
          label: "Vomiting",
          domain: "Diagnosis",
          source: "VeNom",
          codes: [
            {
              system: "http://snomed.info/sct",
              code: "422400008",
              equivalence: "some-word-we-have-not-seen",
            },
          ],
        },
      ]);

      await ClinicalTermsService.importConcepts(parsed);

      expect(CodeService.upsertMapping).toHaveBeenCalledWith(
        expect.objectContaining({ equivalence: "INEXACT" }),
      );
    });

    it("carries the FHIR values the extract may already use", async () => {
      for (const [word, expected] of [
        ["equal", "EQUAL"],
        ["subsumes", "SUBSUMES"],
        ["specializes", "SPECIALIZES"],
        ["disjoint", "DISJOINT"],
        ["unmatched", "UNMATCHED"],
      ]) {
        await ClinicalTermsService.importConcepts([concept(word) as never]);
        expect(CodeService.upsertMapping).toHaveBeenLastCalledWith(
          expect.objectContaining({ equivalence: expected }),
        );
      }
    });

    it("treats an unrecognised equivalence as inexact, never as equivalent", async () => {
      // Overstating how well a crosswalk holds is the failure that silently corrupts a
      // research cohort, so the unknown case degrades rather than flatters.
      await ClinicalTermsService.importConcepts([concept("nonsense") as never]);

      expect(CodeService.upsertMapping).toHaveBeenLastCalledWith(
        expect.objectContaining({ equivalence: "INEXACT" }),
      );
    });
  });

  describe("suggestTerms", () => {
    it("maps rows returned by the database onto suggestions", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          code: "YC-1",
          display: "Vomiting",
          synonyms: ["Emesis", "Vomiting"],
          meta: { domain: "Diagnosis", species: ["SA"], source: "VeNom" },
          score: 400,
        },
      ]);

      const result = await ClinicalTermsService.suggestTerms({
        q: "vom",
        domain: "Diagnosis",
        species: ["SA"],
        limit: 5,
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([
        {
          ycCode: "YC-1",
          label: "Vomiting",
          domain: "Diagnosis",
          species: ["SA"],
          synonyms: ["Emesis", "Vomiting"],
          source: "VeNom",
          codings: [],
        },
      ]);
    });

    it("attaches the strongest usable crosswalk per system in one batched query", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { code: "YC-1", display: "Vomiting", synonyms: [], meta: {} },
        { code: "YC-2", display: "Gastritis", synonyms: [], meta: {} },
      ]);
      (prisma.codeMapping.findMany as jest.Mock).mockResolvedValue([
        {
          sourceCode: "YC-1",
          targetSystem: "VENOM",
          targetCode: "weak",
          targetDisplay: null,
          equivalence: "INEXACT",
        },
        {
          sourceCode: "YC-1",
          targetSystem: "VENOM",
          targetCode: "strong",
          targetDisplay: "V",
          equivalence: "EQUAL",
        },
        {
          sourceCode: "YC-1",
          targetSystem: "SNOMED",
          targetCode: "s1",
          targetDisplay: null,
          equivalence: "NARROWER",
        },
      ]);

      const result = await ClinicalTermsService.suggestTerms({ q: "v" });

      // One query for the whole page, over the deduped code set.
      expect(prisma.codeMapping.findMany).toHaveBeenCalledTimes(1);
      const where = (prisma.codeMapping.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(where.sourceCode).toEqual({ in: ["YC-1", "YC-2"] });
      expect(where.active).toBe(true);
      // The export's usable-equivalence gate is applied here too, so the picker
      // never advertises a crosswalk the export would refuse to emit.
      expect(where.equivalence.in).not.toContain("UNMATCHED");
      expect(where.equivalence.in).not.toContain("DISJOINT");

      expect(result[0].codings).toEqual([
        { system: "VENOM", code: "strong", display: "V", equivalence: "EQUAL" },
        {
          system: "SNOMED",
          code: "s1",
          display: undefined,
          equivalence: "NARROWER",
        },
      ]);
      // A term with no mapping rows carries an empty list, never undefined.
      expect(result[1].codings).toEqual([]);
    });

    it("makes no crosswalk query when the page is empty", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      await ClinicalTermsService.suggestTerms({ q: "zzz" });
      expect(prisma.codeMapping.findMany).not.toHaveBeenCalled();
    });
  });

  describe("buildSuggestionQuery", () => {
    // The filtering lives in SQL now, so these assert the statement itself. Mocking the
    // database and asserting the rows it was told to return would prove nothing.
    const sqlFor = (params: Parameters<typeof buildSuggestionQuery>[0]) => {
      const statement = buildSuggestionQuery(params);
      return { text: statement.sql, values: statement.values };
    };

    it("does not cap the rows it scans", () => {
      // The whole defect: a fixed 5,000-row slice left 6,742 of 11,742 terms
      // unreachable, cutting the vocabulary at "Hypoadrenocorticism".
      const { text, values } = sqlFor({ q: "vomiting", limit: 10 });

      expect(text).not.toContain("5000");
      expect(values).not.toContain(5000);
      expect(values).toContain(10);
    });

    it("searches synonym text, not its JSON encoding", () => {
      // synonyms::text yields the JSON encoding, so a synonym containing a quote reads
      // as \" and a query spanning it would miss a row that genuinely matches. The
      // prefilter has to use the same function the index is built on.
      const { text } = sqlFor({ q: "vomiting" });

      expect(text).toContain("code_entry_search_text");
      expect(text).not.toContain('"synonyms"::text');
    });

    it("pushes the text match into SQL as a bound parameter", () => {
      const { text, values } = sqlFor({ q: "Vomiting" });

      expect(text).toContain("LIKE");
      expect(values).toContain("%vomiting%");
      // Never interpolated into the statement text.
      expect(text).not.toContain("vomiting");
    });

    it("escapes LIKE wildcards typed by the user", () => {
      // Unescaped, a lone "%" matches the entire vocabulary and the autocomplete
      // returns arbitrary terms.
      const { values } = sqlFor({ q: "50%" });

      expect(values).toContain("%50\\%%");
    });

    it("filters by domain in SQL only when a domain is asked for", () => {
      expect(sqlFor({ q: "a", domain: "Diagnosis" }).text).toContain(
        "'domain'",
      );
      expect(sqlFor({ q: "a" }).text).not.toContain("'domain'");
    });

    it("filters by species in SQL only when species are asked for", () => {
      const withSpecies = sqlFor({ q: "a", species: ["SA", "EQUINE"] });
      expect(withSpecies.text).toContain("'species'");
      expect(withSpecies.values).toContainEqual(["SA", "EQUINE"]);

      expect(sqlFor({ q: "a" }).text).not.toContain("'species'");
    });

    it("returns unscored rows when browsing without a query", () => {
      const { text } = sqlFor({});

      expect(text).not.toContain("LIKE");
      expect(text).toContain("TRUE");
    });

    it("clamps the limit", () => {
      expect(sqlFor({ limit: 5000 }).values).toContain(50);
      expect(sqlFor({ limit: -3 }).values).toContain(1);
      expect(sqlFor({}).values).toContain(10);
    });
  });

  describe("importFromFile - path traversal protection", () => {
    const testDataDir = path.join(process.cwd(), "test-data-clinical");
    const validFile = path.join(testDataDir, "concepts.json");

    beforeAll(() => {
      // Create test directory and file
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
      fs.writeFileSync(
        validFile,
        JSON.stringify([
          {
            ycCode: "YC-TEST",
            label: "Test Concept",
            domain: "Diagnosis",
            active: true,
            source: "test",
            designations: [],
            codes: [],
            species: ["SA"],
          },
        ]),
      );
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(validFile)) {
        fs.unlinkSync(validFile);
      }
      if (fs.existsSync(testDataDir)) {
        fs.rmdirSync(testDataDir);
      }
    });

    it("should successfully import from a valid relative file path", async () => {
      // Update test data to use valid source value
      fs.writeFileSync(
        validFile,
        JSON.stringify([
          {
            ycCode: "YC-TEST",
            label: "Test Concept",
            domain: "Diagnosis",
            active: true,
            source: "VeNom", // Changed from "test" to valid enum value
            designations: [],
            codes: [],
            species: ["SA"],
          },
        ]),
      );

      const result = await ClinicalTermsService.importFromFile(
        "test-data-clinical/concepts.json",
      );
      expect(CodeService.upsertEntry).toHaveBeenCalled();
      expect(result).toHaveProperty("entriesUpserted");
    });

    it("should reject path traversal with double dots", async () => {
      await expect(
        ClinicalTermsService.importFromFile("../../../etc/passwd"),
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject path traversal in middle of path", async () => {
      await expect(
        ClinicalTermsService.importFromFile("data/../../../etc/passwd"),
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject absolute Unix paths", async () => {
      await expect(
        ClinicalTermsService.importFromFile("/etc/passwd"),
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject absolute Windows paths", async () => {
      const windowsPath = "C:\\Windows\\System32\\config\\sam";
      if (path.isAbsolute(windowsPath)) {
        await expect(
          ClinicalTermsService.importFromFile(windowsPath),
        ).rejects.toThrow("Invalid file path");
      } else {
        // On Unix, this would fail with ENOENT or parsing error, which is acceptable
        await expect(
          ClinicalTermsService.importFromFile(windowsPath),
        ).rejects.toThrow();
      }
    });

    it("should reject URL-encoded path traversal", async () => {
      await expect(
        ClinicalTermsService.importFromFile("..%2F..%2F..%2Fetc%2Fpasswd"),
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject backslash path traversal", async () => {
      await expect(
        ClinicalTermsService.importFromFile(
          "..\\..\\..\\windows\\system32\\config\\sam",
        ),
      ).rejects.toThrow("Invalid file path");
    });
  });
});
