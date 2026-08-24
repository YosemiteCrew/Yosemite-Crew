jest.mock("src/config/prisma", () => ({
  prisma: {
    codeEntry: { findMany: jest.fn() },
    codeMapping: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import { TerminologyProjectionService } from "src/services/terminology-projection.service";

const entryFind = (prisma as unknown as { codeEntry: { findMany: jest.Mock } })
  .codeEntry.findMany;
const mappingFind = (
  prisma as unknown as { codeMapping: { findMany: jest.Mock } }
).codeMapping.findMany;
const queryRaw = (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw;

beforeEach(() => jest.clearAllMocks());

describe("projectCodes", () => {
  it("returns the mapped code with the equivalence it actually holds", async () => {
    entryFind.mockResolvedValue([{ code: "YC-1" }]);
    mappingFind.mockResolvedValue([
      {
        sourceCode: "YC-1",
        targetCode: "422400008",
        targetDisplay: "Vomiting",
        equivalence: "NARROWER",
      },
    ]);

    const [result] = await TerminologyProjectionService.projectCodes(
      ["YC-1"],
      "SNOMED",
    );

    expect(result).toEqual({
      status: "mapped",
      ycCode: "YC-1",
      system: "SNOMED",
      coding: {
        system: "http://snomed.info/sct",
        code: "422400008",
        display: "Vomiting",
      },
      equivalence: "NARROWER",
    });
  });

  it("reports a term with no counterpart rather than falling back", async () => {
    // The failure this guards against: emitting the YC code as though it were SNOMED, or
    // substituting a parent. Both produce an export that looks complete and is not.
    entryFind.mockResolvedValue([{ code: "YC-1" }]);
    mappingFind.mockResolvedValue([]);

    const [result] = await TerminologyProjectionService.projectCodes(
      ["YC-1"],
      "SNOMED",
    );

    expect(result).toEqual({
      status: "unmapped",
      ycCode: "YC-1",
      system: "SNOMED",
    });
  });

  it("separates a code we do not hold from one with no counterpart", async () => {
    // Different failures: the first is a caller bug, the second a real gap in the target
    // vocabulary. Collapsing them would hide whichever one you were not looking for.
    entryFind.mockResolvedValue([]);
    mappingFind.mockResolvedValue([]);

    const [result] = await TerminologyProjectionService.projectCodes(
      ["YC-nope"],
      "SNOMED",
    );

    expect(result.status).toBe("unknown");
  });

  it("verifies the code exists even when the target is our own vocabulary", async () => {
    entryFind.mockResolvedValue([]);

    const [result] = await TerminologyProjectionService.projectCodes(
      ["YC-ghost"],
      "YOSEMITECODE",
    );

    // Echoing the input back unchecked would make a nonexistent code look valid.
    expect(result.status).toBe("unknown");
    expect(mappingFind).not.toHaveBeenCalled();
  });

  it("projects our own vocabulary onto itself as exactly equivalent", async () => {
    entryFind.mockResolvedValue([{ code: "YC-1", display: "Vomiting" }]);

    const [result] = await TerminologyProjectionService.projectCodes(
      ["YC-1"],
      "YOSEMITECODE",
    );

    expect(result).toMatchObject({
      status: "mapped",
      coding: { code: "YC-1" },
      equivalence: "EQUIVALENT",
    });
  });

  it("asks the database once for many codes", async () => {
    // A SOAP note or export runs to hundreds of codes; one query each would make the
    // honest path the slow one and invite a shortcut.
    entryFind.mockResolvedValue([{ code: "YC-1" }, { code: "YC-2" }]);
    mappingFind.mockResolvedValue([]);

    await TerminologyProjectionService.projectCodes(["YC-1", "YC-2"], "SNOMED");

    expect(mappingFind).toHaveBeenCalledTimes(1);
    expect(mappingFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceCode: { in: ["YC-1", "YC-2"] },
        }),
      }),
    );
  });

  it("deduplicates and ignores blank input", async () => {
    entryFind.mockResolvedValue([{ code: "YC-1" }]);
    mappingFind.mockResolvedValue([]);

    const results = await TerminologyProjectionService.projectCodes(
      ["YC-1", " YC-1 ", "", "   "],
      "SNOMED",
    );

    expect(results).toHaveLength(1);
  });

  it("asks for a deterministic order when a term carries several target codes", async () => {
    entryFind.mockResolvedValue([{ code: "YC-1" }]);
    mappingFind.mockResolvedValue([]);

    await TerminologyProjectionService.projectCodes(["YC-1"], "SNOMED");

    expect(mappingFind).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { targetCode: "asc" } }),
    );
  });
});

describe("vocabularyCoverage", () => {
  it("reports the share of terms the target system can express", async () => {
    queryRaw.mockResolvedValue([{ terms: BigInt(4378), mapped: BigInt(1252) }]);

    const coverage = await TerminologyProjectionService.vocabularyCoverage(
      "SNOMED",
      "EQUINE",
    );

    expect(coverage).toEqual({
      system: "SNOMED",
      species: "EQUINE",
      terms: 4378,
      mapped: 1252,
      percent: 28,
    });
  });

  it("floors the percentage so thin coverage is never flattered", async () => {
    // 15 of 228 avian terms is 6.6%. Rounding it to 7% overstates the case in exactly
    // the disclosure meant to warn against choosing that vocabulary.
    queryRaw.mockResolvedValue([{ terms: BigInt(228), mapped: BigInt(15) }]);

    const coverage = await TerminologyProjectionService.vocabularyCoverage(
      "SNOMED",
      "AVIAN",
    );

    expect(coverage.percent).toBe(6);
  });

  it("does not divide by zero for a species with no terms", async () => {
    queryRaw.mockResolvedValue([{ terms: BigInt(0), mapped: BigInt(0) }]);

    const coverage = await TerminologyProjectionService.vocabularyCoverage(
      "SNOMED",
      "NONE",
    );

    expect(coverage.percent).toBe(0);
  });

  it("reports our own vocabulary as fully covered", async () => {
    queryRaw.mockResolvedValue([
      { terms: BigInt(11742), mapped: BigInt(11742) },
    ]);

    const coverage =
      await TerminologyProjectionService.vocabularyCoverage("YOSEMITECODE");

    expect(coverage).toMatchObject({ percent: 100, species: null });
  });

  describe("projectCode", () => {
    it("projects a single code", async () => {
      entryFind.mockResolvedValue([{ code: "YC-1" }]);
      mappingFind.mockResolvedValue([
        {
          sourceCode: "YC-1",
          targetCode: "422400008",
          targetDisplay: "Vomiting",
          equivalence: "EQUIVALENT",
        },
      ]);

      const result = await TerminologyProjectionService.projectCode(
        "YC-1",
        "SNOMED",
      );

      expect(result).toMatchObject({
        status: "mapped",
        coding: { code: "422400008" },
      });
    });

    it("returns unknown for a blank code rather than querying", async () => {
      const result = await TerminologyProjectionService.projectCode(
        "   ",
        "SNOMED",
      );

      expect(result).toEqual({
        status: "unknown",
        ycCode: "   ",
        system: "SNOMED",
      });
      expect(mappingFind).not.toHaveBeenCalled();
    });
  });

  describe("a mapping that outlived its concept", () => {
    it("reports unknown when the concept is gone but the mapping is still active", async () => {
      // CodeMapping rows are not cascaded when an entry is retired, so a live mapping can
      // point from a concept we no longer hold. Trusting it would project a retired code
      // as though it were current.
      entryFind.mockResolvedValue([]);
      mappingFind.mockResolvedValue([
        {
          sourceCode: "YC-retired",
          targetCode: "422400008",
          targetDisplay: "Vomiting",
          equivalence: "EQUIVALENT",
        },
      ]);

      const [result] = await TerminologyProjectionService.projectCodes(
        ["YC-retired"],
        "SNOMED",
      );

      expect(result.status).toBe("unknown");
    });
  });

  describe("competing mappings", () => {
    it("projects the strongest equivalence, not the first code returned", async () => {
      entryFind.mockResolvedValue([{ code: "YC-1" }]);
      mappingFind.mockResolvedValue([
        {
          sourceCode: "YC-1",
          targetCode: "111",
          targetDisplay: "loose",
          equivalence: "INEXACT",
        },
        {
          sourceCode: "YC-1",
          targetCode: "222",
          targetDisplay: "exact",
          equivalence: "EQUIVALENT",
        },
      ]);

      const [result] = await TerminologyProjectionService.projectCodes(
        ["YC-1"],
        "SNOMED",
      );

      expect(result).toMatchObject({
        coding: { code: "222" },
        equivalence: "EQUIVALENT",
      });
    });
  });

  describe("coverage honesty", () => {
    it("excludes UNMATCHED and DISJOINT from the covered count", async () => {
      // Both mean there is no usable counterpart. Counting them would inflate the very
      // disclosure meant to warn a practice off a vocabulary that cannot express its work.
      queryRaw.mockResolvedValue([{ terms: BigInt(10), mapped: BigInt(4) }]);

      await TerminologyProjectionService.vocabularyCoverage("SNOMED");

      // $queryRaw is a tagged template, so the whole call is the statement: the strings
      // array plus every interpolated fragment and bound value.
      const call = JSON.stringify(queryRaw.mock.calls[0]);
      expect(call).toContain("equivalence");
      expect(call).toContain("EQUIVALENT");
      expect(call).not.toContain("UNMATCHED");
      expect(call).not.toContain("DISJOINT");
    });
  });

  describe("edge branches", () => {
    it("carries a null display as an absent Coding.display, in both branches", async () => {
      // FHIR Coding.display is optional; null must become undefined rather than a
      // literal null in the emitted Coding. Covers the terminal branch and the mapped
      // branch fallbacks.
      entryFind.mockResolvedValue([{ code: "YC-1", display: null }]);

      const [own] = await TerminologyProjectionService.projectCodes(
        ["YC-1"],
        "YOSEMITECODE",
      );
      expect(own.status).toBe("mapped");
      if (own.status === "mapped") {
        expect(own.coding.display).toBeUndefined();
      }

      mappingFind.mockResolvedValue([
        {
          sourceCode: "YC-1",
          targetCode: "422400008",
          targetDisplay: null,
          equivalence: "EQUIVALENT",
        },
      ]);
      const [mapped] = await TerminologyProjectionService.projectCodes(
        ["YC-1"],
        "SNOMED",
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status === "mapped") {
        expect(mapped.coding.display).toBeUndefined();
      }
    });

    it("ranks an equivalence it does not recognise below every known one", async () => {
      // The enum can grow before this table does. An unknown value must lose to any
      // known one rather than win by accident of indexOf returning -1.
      entryFind.mockResolvedValue([{ code: "YC-1" }]);
      mappingFind.mockResolvedValue([
        {
          sourceCode: "YC-1",
          targetCode: "111",
          targetDisplay: "future",
          equivalence: "SOME_FUTURE_VALUE",
        },
        {
          sourceCode: "YC-1",
          targetCode: "222",
          targetDisplay: "known",
          equivalence: "INEXACT",
        },
      ]);

      const [result] = await TerminologyProjectionService.projectCodes(
        ["YC-1"],
        "SNOMED",
      );

      expect(result.status).toBe("mapped");
      if (result.status === "mapped") {
        expect(result.coding.code).toBe("222");
      }
    });

    it("reports zero coverage when the query returns no row at all", async () => {
      queryRaw.mockResolvedValue([]);

      const coverage =
        await TerminologyProjectionService.vocabularyCoverage("SNOMED");

      expect(coverage).toMatchObject({ terms: 0, mapped: 0, percent: 0 });
    });
  });
});
