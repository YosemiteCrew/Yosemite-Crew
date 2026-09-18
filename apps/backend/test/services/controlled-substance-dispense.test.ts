import {
  resolveDeaSchedule,
  resolveDrugUnit,
  resolveItemDeaSchedule,
} from "src/services/controlled-substance-dispense";

describe("resolveDeaSchedule", () => {
  it.each([
    ["Schedule II", "II"],
    ["Schedule III", "III"],
    ["Schedule IV", "IV"],
    ["Schedule V", "V"],
    ["schedule 2", "II"],
    ["Schedule 5", "V"],
    ["C-II", "II"],
    ["CIV", "IV"],
    ["  iv  ", "IV"],
    ["V", "V"],
  ])("maps %s to %s", (raw, expected) => {
    expect(resolveDeaSchedule(raw)).toBe(expected);
  });

  // Every one of these has to be null rather than a nearest guess: the register
  // files an entry under a legal category, so a wrong schedule is worse than
  // the refusal it would replace.
  it.each([
    ["Non-scheduled"],
    ["non scheduled"],
    ["Schedule I"],
    ["I"],
    ["Schedule VI"],
    ["OTC"],
    [""],
    ["   "],
  ])("refuses to guess a schedule from %s", (raw) => {
    expect(resolveDeaSchedule(raw)).toBeNull();
  });

  it.each([[undefined], [null], [4], [{}], [["IV"]]])(
    "returns null for the non-string %s",
    (raw) => {
      expect(resolveDeaSchedule(raw)).toBeNull();
    },
  );
});

describe("resolveItemDeaSchedule", () => {
  it("reads the Add Inventory form's attributes.drugSchedule", () => {
    expect(
      resolveItemDeaSchedule({ drugSchedule: "Schedule II", species: ["DOG"] }),
    ).toBe("II");
  });

  it("accepts deaSchedule as an alias for an API-created item", () => {
    expect(resolveItemDeaSchedule({ deaSchedule: "IV" })).toBe("IV");
  });

  it("prefers drugSchedule when both are present", () => {
    expect(
      resolveItemDeaSchedule({ drugSchedule: "Schedule V", deaSchedule: "II" }),
    ).toBe("V");
  });

  it("falls through to deaSchedule when drugSchedule is unusable", () => {
    expect(
      resolveItemDeaSchedule({
        drugSchedule: "Non-scheduled",
        deaSchedule: "III",
      }),
    ).toBe("III");
  });

  it.each([[null], [undefined], ["Schedule II"], [42], [{}], [{ name: "x" }]])(
    "returns null for %s",
    (attributes) => {
      expect(resolveItemDeaSchedule(attributes)).toBeNull();
    },
  );
});

describe("resolveDrugUnit", () => {
  it.each([
    ["ml", "ML"],
    ["mL", "ML"],
    ["millilitre", "ML"],
    ["milliliter", "ML"],
    ["cc", "ML"],
    ["mg", "MG"],
    ["milligrams", "MG"],
    ["mcg", "MCG"],
    ["ug", "MCG"],
    ["micrograms", "MCG"],
    ["tab", "TABLET"],
    ["Tablets", "TABLET"],
    ["cap", "CAPSULE"],
    ["Capsules", "CAPSULE"],
    ["patch", "PATCH"],
    ["patches", "PATCH"],
    ["units", "UNIT"],
  ])("maps %s to %s", (raw, expected) => {
    expect(resolveDrugUnit(raw)).toBe(expected);
  });

  it("takes the first candidate it recognises", () => {
    expect(resolveDrugUnit("bottle", "ml")).toBe("ML");
  });

  it("skips non-strings without giving up on later candidates", () => {
    expect(resolveDrugUnit(null, undefined, 7, "tablet")).toBe("TABLET");
  });

  // Unlike the schedule, an unknown unit must not block a dispense: UNIT is the
  // register enum's own catch-all.
  it.each([["bottle"], ["each"], [""], [undefined]])(
    "falls back to UNIT for %s",
    (raw) => {
      expect(resolveDrugUnit(raw)).toBe("UNIT");
    },
  );

  it("falls back to UNIT when given no candidates at all", () => {
    expect(resolveDrugUnit()).toBe("UNIT");
  });
});
