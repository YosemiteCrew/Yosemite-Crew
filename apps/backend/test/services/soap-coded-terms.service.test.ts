jest.mock("src/config/prisma", () => ({
  prisma: {
    codeMapping: { findMany: jest.fn() },
    codeEntry: { findMany: jest.fn() },
  },
}));

import { prisma } from "src/config/prisma";
import { SoapCodedTermsFhirService } from "src/services/soap-coded-terms.service";

const mappingFind = (
  prisma as unknown as { codeMapping: { findMany: jest.Mock } }
).codeMapping.findMany;
const entryFind = (prisma as unknown as { codeEntry: { findMany: jest.Mock } })
  .codeEntry.findMany;

type Ext = {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueCodeableConcept?: {
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
      extension?: Ext[];
    }>;
  };
  extension?: Ext[];
};

const concept = (ext: Ext) =>
  ext.extension?.find((e) => e.url === "concept")?.valueCodeableConcept;
const section = (ext: Ext) =>
  ext.extension?.find((e) => e.url === "section")?.valueString;
const equivalenceOf = (coding: { extension?: Ext[] }): string | undefined =>
  coding.extension?.find((e) => e.url.endsWith("concept-map-equivalence"))
    ?.valueCode;

beforeEach(() => {
  mappingFind.mockReset();
  entryFind.mockReset();
});

describe("SoapCodedTermsFhirService.codedTermExtensions", () => {
  it("returns no extensions for absent or malformed diagnoses", async () => {
    expect(await SoapCodedTermsFhirService.codedTermExtensions(null)).toEqual(
      [],
    );
    expect(
      await SoapCodedTermsFhirService.codedTermExtensions("not-an-object"),
    ).toEqual([]);
    expect(mappingFind).not.toHaveBeenCalled();
  });

  it("projects each picked term into a CodeableConcept with YC plus usable translations", async () => {
    // Both targets exist as concepts; YC-1 maps to VeNom (EQUIVALENT) and
    // SNOMED (NARROWER), YC-2 has only an UNMATCHED VeNom row.
    entryFind.mockResolvedValue([{ code: "YC-1" }, { code: "YC-2" }]);
    mappingFind.mockImplementation(({ where }) =>
      Promise.resolve(
        where.targetSystem === "VENOM"
          ? [
              {
                sourceCode: "YC-1",
                targetCode: "2062",
                targetDisplay: "Vomiting",
                equivalence: "EQUIVALENT",
              },
              {
                sourceCode: "YC-2",
                targetCode: "999",
                targetDisplay: "No counterpart",
                equivalence: "UNMATCHED",
              },
            ]
          : [
              {
                sourceCode: "YC-1",
                targetCode: "422400008",
                targetDisplay: "Vomiting (disorder)",
                equivalence: "NARROWER",
              },
            ],
      ),
    );

    const extensions = (await SoapCodedTermsFhirService.codedTermExtensions({
      subjective: [{ ycCode: "YC-1", label: "Picked label" }],
      assessment: [{ ycCode: "YC-2", label: "Gap concept" }],
    })) as Ext[];

    expect(extensions).toHaveLength(2);
    expect(section(extensions[0])).toBe("subjective");
    expect(section(extensions[1])).toBe("assessment");

    const first = concept(extensions[0]);
    // The pick-time label is the record, even if the vocabulary display differs.
    expect(first?.text).toBe("Picked label");
    expect(first?.coding).toEqual([
      expect.objectContaining({
        system: "https://yosemitecrew.com/fhir/CodeSystem/yosemite",
        code: "YC-1",
        display: "Picked label",
      }),
      expect.objectContaining({ system: "urn:venom", code: "2062" }),
      expect.objectContaining({
        system: "http://snomed.info/sct",
        code: "422400008",
      }),
    ]);
    // Equivalence is explicit per external coding, in FHIR's lowercase codes.
    expect(equivalenceOf(first!.coding![1])).toBe("equivalent");
    expect(equivalenceOf(first!.coding![2])).toBe("narrower");

    // UNMATCHED never rides along as a translation: YC coding only.
    const second = concept(extensions[1]);
    expect(second?.coding).toHaveLength(1);
    expect(second?.coding?.[0].code).toBe("YC-2");
  });

  it("emits only the YC coding for a retired or unknown concept", async () => {
    // Concept absent from CodeEntry: a mapping outliving its concept must not
    // resurrect it as a translation.
    entryFind.mockResolvedValue([]);
    mappingFind.mockResolvedValue([
      {
        sourceCode: "YC-GONE",
        targetCode: "1",
        targetDisplay: "x",
        equivalence: "EQUIVALENT",
      },
    ]);

    const extensions = (await SoapCodedTermsFhirService.codedTermExtensions({
      plan: [{ ycCode: "YC-GONE", label: "Retired concept" }],
    })) as Ext[];

    expect(concept(extensions[0])?.coding).toHaveLength(1);
    expect(concept(extensions[0])?.coding?.[0].code).toBe("YC-GONE");
  });

  it("queries each target once with the deduped code set", async () => {
    entryFind.mockResolvedValue([{ code: "YC-1" }]);
    mappingFind.mockResolvedValue([]);

    await SoapCodedTermsFhirService.codedTermExtensions({
      subjective: [{ ycCode: "YC-1", label: "A" }],
      plan: [{ ycCode: "YC-1", label: "A" }],
    });

    // One VENOM query + one SNOMED query, not one per term or per section.
    expect(mappingFind).toHaveBeenCalledTimes(2);
    for (const call of mappingFind.mock.calls) {
      expect(call[0].where.sourceCode).toEqual({ in: ["YC-1"] });
    }
  });

  it("keeps the strongest mapping when a term has several in one system", async () => {
    entryFind.mockResolvedValue([{ code: "YC-1" }]);
    mappingFind.mockImplementation(({ where }) =>
      Promise.resolve(
        where.targetSystem === "VENOM"
          ? [
              {
                sourceCode: "YC-1",
                targetCode: "weak",
                targetDisplay: "w",
                equivalence: "INEXACT",
              },
              {
                sourceCode: "YC-1",
                targetCode: "strong",
                targetDisplay: "s",
                equivalence: "EQUAL",
              },
            ]
          : [],
      ),
    );

    const extensions = (await SoapCodedTermsFhirService.codedTermExtensions({
      subjective: [{ ycCode: "YC-1", label: "A" }],
    })) as Ext[];

    const codings = concept(extensions[0])?.coding ?? [];
    expect(codings).toHaveLength(2);
    expect(codings[1].code).toBe("strong");
    expect(equivalenceOf(codings[1])).toBe("equal");
  });
});
