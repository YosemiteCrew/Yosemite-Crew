import { describe, it, expect } from "@jest/globals";
import {
  getCompanionSpeciesTokens,
  isSpeciesCompatible,
  normalizeStringTokens,
} from "../../../src/services/shared/normalize-tokens";

describe("normalizeStringTokens", () => {
  it("returns an empty array for non-array input", () => {
    expect(normalizeStringTokens(undefined)).toEqual([]);
    expect(normalizeStringTokens(null)).toEqual([]);
    expect(normalizeStringTokens("dog")).toEqual([]);
    expect(normalizeStringTokens({ species: "dog" })).toEqual([]);
  });

  it("trims, lowercases, dedupes, and drops non-string or empty entries", () => {
    expect(
      normalizeStringTokens([" Dog ", "CAT", "dog", "", "   ", 42, null]),
    ).toEqual(["dog", "cat"]);
  });
});

describe("getCompanionSpeciesTokens", () => {
  it("collects the type, species code, and known aliases", () => {
    const tokens = getCompanionSpeciesTokens({
      type: " Dog ",
      speciesCode: " K9 ",
    });
    expect(tokens).toEqual(new Set(["dog", "k9", "canine"]));
  });

  it("handles cat and horse aliases", () => {
    expect(
      getCompanionSpeciesTokens({ type: "cat", speciesCode: null }),
    ).toEqual(new Set(["cat", "feline"]));
    expect(
      getCompanionSpeciesTokens({ type: "Horse", speciesCode: null }),
    ).toEqual(new Set(["horse", "equine"]));
  });

  it("skips blank type and missing species code", () => {
    expect(
      getCompanionSpeciesTokens({ type: "  ", speciesCode: null }),
    ).toEqual(new Set());
    expect(
      getCompanionSpeciesTokens({ type: "lizard", speciesCode: "  " }),
    ).toEqual(new Set(["lizard"]));
  });
});

describe("isSpeciesCompatible", () => {
  const dog = { type: "dog", speciesCode: null };

  it("is compatible when there are no constraints", () => {
    expect(isSpeciesCompatible(undefined, dog)).toBe(true);
    expect(isSpeciesCompatible([], dog)).toBe(true);
    expect(isSpeciesCompatible(["", "  "], dog)).toBe(true);
  });

  it("matches constraints against species tokens, including aliases", () => {
    expect(isSpeciesCompatible(["Canine"], dog)).toBe(true);
    expect(isSpeciesCompatible(["dog", "cat"], dog)).toBe(true);
    expect(
      isSpeciesCompatible(["k9"], { type: "dog", speciesCode: "K9" }),
    ).toBe(true);
  });

  it("is incompatible when no constraint matches", () => {
    expect(isSpeciesCompatible(["feline"], dog)).toBe(false);
    expect(isSpeciesCompatible(["bird"], dog)).toBe(false);
  });
});
