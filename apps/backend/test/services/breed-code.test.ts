import {
  ageInMonths,
  breedCodesMatch,
  canonicalBreedCode,
  taskSpeciesForCode,
} from "src/services/shared/breed-code";

describe("canonicalBreedCode", () => {
  it("folds the two separator conventions in the vocabulary onto one", () => {
    // Not hypothetical. Production CodeEntry holds 1,749 breed codes that collapse
    // to 1,713: 36 breeds exist under both spellings, and patient rows are split
    // the same way.
    expect(canonicalBreedCode("YBREED:CANINE:SHIH-TZU")).toBe(
      canonicalBreedCode("YBREED:CANINE:SHIH_TZU"),
    );
    expect(
      canonicalBreedCode("YBREED:FELINE:AMERICAN-BOBTAIL-LONG-HAIRED"),
    ).toBe("YBREED:FELINE:AMERICAN_BOBTAIL_LONG_HAIRED");
  });

  it("upper-cases and trims", () => {
    expect(canonicalBreedCode("  ybreed:canine:pug  ")).toBe(
      "YBREED:CANINE:PUG",
    );
  });

  it("collapses repeated separators so two spellings cannot diverge on them", () => {
    expect(canonicalBreedCode("YBREED:CANINE:A--B")).toBe("YBREED:CANINE:A_B");
    expect(canonicalBreedCode("YBREED:CANINE:A__B")).toBe("YBREED:CANINE:A_B");
  });

  it("returns null for anything unusable", () => {
    expect(canonicalBreedCode(null)).toBeNull();
    expect(canonicalBreedCode(undefined)).toBeNull();
    expect(canonicalBreedCode("   ")).toBeNull();
    expect(canonicalBreedCode(42 as unknown as string)).toBeNull();
  });
});

describe("breedCodesMatch", () => {
  it("matches across conventions", () => {
    expect(
      breedCodesMatch("YBREED:CANINE:LHASA-APSO", "YBREED:CANINE:LHASA_APSO"),
    ).toBe(true);
  });

  it("does not match different breeds", () => {
    expect(breedCodesMatch("YBREED:CANINE:PUG", "YBREED:CANINE:BOXER")).toBe(
      false,
    );
  });

  it("treats two unknowns as no match, not as equal", () => {
    // This decides whether a rule applies, so anything unreadable must fall
    // through to "no". Two nulls comparing equal would apply every breed-specific
    // rule to every uncoded companion.
    expect(breedCodesMatch(null, null)).toBe(false);
    expect(breedCodesMatch("", "")).toBe(false);
    expect(breedCodesMatch("YBREED:CANINE:PUG", null)).toBe(false);
  });
});

describe("taskSpeciesForCode", () => {
  it("maps the three coded species onto the task enum", () => {
    expect(taskSpeciesForCode("YSPEC:CANINE")).toBe("dog");
    expect(taskSpeciesForCode("YSPEC:FELINE")).toBe("cat");
    expect(taskSpeciesForCode("YSPEC:EQUINE")).toBe("horse");
  });

  it("returns null rather than guessing for anything else", () => {
    expect(taskSpeciesForCode("YSPEC:AVIAN")).toBeNull();
    expect(taskSpeciesForCode(null)).toBeNull();
    expect(taskSpeciesForCode("")).toBeNull();
  });
});

describe("ageInMonths", () => {
  const asOf = new Date("2026-08-24T12:00:00Z");

  it("counts whole months only", () => {
    expect(ageInMonths(new Date("2026-07-24T00:00:00Z"), asOf)).toBe(1);
    // One day short of a month is still zero.
    expect(ageInMonths(new Date("2026-07-25T00:00:00Z"), asOf)).toBe(0);
  });

  it("counts across years", () => {
    expect(ageInMonths(new Date("2019-08-24T00:00:00Z"), asOf)).toBe(84);
  });

  it("returns null for a future date of birth rather than a negative age", () => {
    // A negative age would silently satisfy every maxAgeMonths bound, so a bad
    // date of birth would hand a puppy every senior recommendation there is.
    expect(ageInMonths(new Date("2027-01-01T00:00:00Z"), asOf)).toBeNull();
  });

  it("returns null for an unusable date", () => {
    expect(ageInMonths(null, asOf)).toBeNull();
    expect(ageInMonths(undefined, asOf)).toBeNull();
    expect(ageInMonths(new Date("nonsense"), asOf)).toBeNull();
  });
});
