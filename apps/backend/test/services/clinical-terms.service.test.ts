import { ClinicalTermsService } from "../../src/services/clinical-terms.service";
import { CodeService } from "src/services/code.service";
import { prisma } from "src/config/prisma";

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
  },
}));

describe("ClinicalTermsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
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
    it("upserts canonical entries and supported equivalent mappings", async () => {
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

      expect(CodeService.upsertMapping).toHaveBeenCalledTimes(1);
      expect(CodeService.upsertMapping).toHaveBeenCalledWith({
        sourceSystem: "YOSEMITECODE",
        sourceCode: "YC-1",
        targetSystem: "VENOM",
        targetCode: "123",
        targetDisplay: "Vomiting",
        targetVersion: null,
        active: true,
      });
      expect(result).toEqual({ entriesUpserted: 1, mappingsUpserted: 1 });
    });
  });

  describe("suggestTerms", () => {
    it("filters postgres-backed suggestions by query, domain, and species", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.codeEntry.findMany as jest.Mock).mockResolvedValue([
        {
          code: "YC-1",
          display: "Vomiting",
          synonyms: ["Emesis", "Vomiting"],
          meta: {
            domain: "Diagnosis",
            species: ["SA"],
            source: "VeNom",
          },
        },
        {
          code: "YC-2",
          display: "Vomiting test",
          synonyms: ["Test emesis"],
          meta: {
            domain: "DiagnosticTest",
            species: ["SA"],
            source: "VeNom",
          },
        },
        {
          code: "YC-3",
          display: "Coughing",
          synonyms: ["Cough"],
          meta: {
            domain: "Diagnosis",
            species: ["EQUINE"],
            source: "VeNom",
          },
        },
      ]);

      const result = await ClinicalTermsService.suggestTerms({
        q: "vom",
        domain: "Diagnosis",
        species: ["SA"],
        limit: 5,
      });

      expect(prisma.codeEntry.findMany).toHaveBeenCalled();
      expect(result).toEqual([
        {
          ycCode: "YC-1",
          label: "Vomiting",
          domain: "Diagnosis",
          species: ["SA"],
          synonyms: ["Emesis", "Vomiting"],
          source: "VeNom",
        },
      ]);
    });
  });
});
