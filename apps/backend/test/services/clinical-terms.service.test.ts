import { ClinicalTermsService } from "../../src/services/clinical-terms.service";
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

    it("returns terms that only match through a synonym", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.codeEntry.findMany as jest.Mock).mockResolvedValue([
        {
          code: "YC-9",
          display: "Vomiting",
          synonyms: ["Emesis"],
          meta: {
            domain: "Diagnosis",
            species: ["SA"],
            source: "VeNom",
          },
        },
      ]);

      const result = await ClinicalTermsService.suggestTerms({
        q: "emesis",
        domain: "Diagnosis",
        species: ["SA"],
        limit: 5,
      });

      expect(prisma.codeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            system: "YOSEMITECODE",
            type: "CLINICAL_TERM",
            active: true,
          },
          take: 5000,
        }),
      );
      expect(result).toEqual([
        {
          ycCode: "YC-9",
          label: "Vomiting",
          domain: "Diagnosis",
          species: ["SA"],
          synonyms: ["Emesis"],
          source: "VeNom",
        },
      ]);
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
        ])
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
            source: "VeNom",  // Changed from "test" to valid enum value
            designations: [],
            codes: [],
            species: ["SA"],
          },
        ])
      );
      
      const result = await ClinicalTermsService.importFromFile(
        "test-data-clinical/concepts.json"
      );
      expect(CodeService.upsertEntry).toHaveBeenCalled();
      expect(result).toHaveProperty("entriesUpserted");
    });

    it("should reject path traversal with double dots", async () => {
      await expect(
        ClinicalTermsService.importFromFile("../../../etc/passwd")
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject path traversal in middle of path", async () => {
      await expect(
        ClinicalTermsService.importFromFile("data/../../../etc/passwd")
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject absolute Unix paths", async () => {
      await expect(
        ClinicalTermsService.importFromFile("/etc/passwd")
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject absolute Windows paths", async () => {
      const windowsPath = "C:\\Windows\\System32\\config\\sam";
      if (path.isAbsolute(windowsPath)) {
        await expect(
          ClinicalTermsService.importFromFile(windowsPath)
        ).rejects.toThrow("Invalid file path");
      } else {
        // On Unix, this would fail with ENOENT or parsing error, which is acceptable
        await expect(
          ClinicalTermsService.importFromFile(windowsPath)
        ).rejects.toThrow();
      }
    });

    it("should reject URL-encoded path traversal", async () => {
      await expect(
        ClinicalTermsService.importFromFile("..%2F..%2F..%2Fetc%2Fpasswd")
      ).rejects.toThrow("Invalid file path");
    });

    it("should reject backslash path traversal", async () => {
      await expect(
        ClinicalTermsService.importFromFile("..\\..\\..\\windows\\system32\\config\\sam")
      ).rejects.toThrow("Invalid file path");
    });
  });
});
