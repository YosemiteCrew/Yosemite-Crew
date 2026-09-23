import type { DeaSchedule, DrugUnit } from "./controlled-substance-log.service";

// The register stores a DEA schedule as an enum, but the only schedule the
// system holds for an inventory item is the Add Inventory dropdown's label,
// kept verbatim in InventoryItem.attributes.drugSchedule ("Schedule II" ...
// "Non-scheduled"). So a dispense has to read the schedule back out of free
// text, and anything the register cannot name - "Non-scheduled", "Schedule I",
// a blank, a typo - has to resolve to null rather than to a guess: a register
// entry filed under the wrong schedule is worse than the missing entry this
// fixes.
const SCHEDULE_BY_TOKEN: Record<string, DeaSchedule> = {
  II: "II",
  "2": "II",
  III: "III",
  "3": "III",
  IV: "IV",
  "4": "IV",
  V: "V",
  "5": "V",
};

// "Schedule II" | "schedule 2" | "C-II" | "CII" | "II" -> "II".
export const resolveDeaSchedule = (raw: unknown): DeaSchedule | null => {
  if (typeof raw !== "string") return null;
  const token = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^SCHEDULE/, "")
    .replace(/^C/, "");
  return SCHEDULE_BY_TOKEN[token] ?? null;
};

// attributes is a free-form JSON bag on InventoryItem, so it is read
// defensively rather than cast.
export const resolveItemDeaSchedule = (
  attributes: unknown,
): DeaSchedule | null => {
  if (typeof attributes !== "object" || attributes === null) return null;
  const bag = attributes as Record<string, unknown>;
  return (
    resolveDeaSchedule(bag.drugSchedule) ?? resolveDeaSchedule(bag.deaSchedule)
  );
};

const DRUG_UNIT_BY_TOKEN: Record<string, DrugUnit> = {
  ML: "ML",
  MILLILITRE: "ML",
  MILLILITER: "ML",
  CC: "ML",
  MG: "MG",
  MILLIGRAM: "MG",
  MILLIGRAMS: "MG",
  MCG: "MCG",
  UG: "MCG",
  MICROGRAM: "MCG",
  MICROGRAMS: "MCG",
  TAB: "TABLET",
  TABS: "TABLET",
  TABLET: "TABLET",
  TABLETS: "TABLET",
  CAP: "CAPSULE",
  CAPS: "CAPSULE",
  CAPSULE: "CAPSULE",
  CAPSULES: "CAPSULE",
  PATCH: "PATCH",
  PATCHES: "PATCH",
  UNIT: "UNIT",
  UNITS: "UNIT",
};

// Unlike the schedule, an unrecognised unit does not block a dispense: UNIT is
// the register enum's own catch-all, and the amount is recorded in whatever
// whole stock units the item is counted in either way. The schedule decides a
// legal filing category; the unit only describes the amount beside it.
export const resolveDrugUnit = (...candidates: unknown[]): DrugUnit => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const unit =
      DRUG_UNIT_BY_TOKEN[candidate.toUpperCase().replace(/[^A-Z]/g, "")];
    if (unit) return unit;
  }
  return "UNIT";
};
