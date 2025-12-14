import { specialties, specialtiesByKey } from "@/app/utils/specialities";

describe("Specialties Utility", () => {
  // --- 1. Specialties Array Tests ---

  it("should contain a list of specialties", () => {
    expect(Array.isArray(specialties)).toBe(true);
    expect(specialties.length).toBeGreaterThan(0);
  });

  it("should have correct structure for each specialty", () => {
    const surgery = specialties.find((s) => s.name === "Surgery");

    expect(surgery).toBeDefined();
    expect(surgery).toHaveProperty("name", "Surgery");
    expect(Array.isArray(surgery?.services)).toBe(true);
    expect(surgery?.services).toContain("Spay / Neuter");
    expect(surgery?.services).toContain("General Consult");
  });

  it("should contain specific expected specialties", () => {
    const names = specialties.map((s) => s.name);

    expect(names).toContain("General Practice");
    expect(names).toContain("Internal Medicine");
    expect(names).toContain("Dermatology");
    expect(names).toContain("Dentistry");
    expect(names).toContain("Emergency & Critical Care");
  });

  // --- 2. SpecialtiesByKey Object Tests ---

  it("should create a valid lookup object keyed by specialty name", () => {
    // Verify the transformation logic: Object.fromEntries(map(...))

    // Check if keys match names
    const keys = Object.keys(specialtiesByKey);
    expect(keys).toContain("Cardiology");
    expect(keys).toContain("Nutrition & Dietetics");
    expect(keys.length).toEqual(specialties.length);
  });

  it("should allow accessing data via the key map", () => {
    const cardio = specialtiesByKey["Cardiology"];

    expect(cardio).toBeDefined();
    expect(cardio.name).toBe("Cardiology");
    expect(cardio.services).toContain("Heart Check-up");
    expect(cardio.services).toContain("ECG / Echocardiogram");
  });

  it("should maintain referential integrity between array and object map", () => {
    // The object values should reference the exact same objects as the array
    const arrayItem = specialties.find(s => s.name === "Behavior & Training");
    const mapItem = specialtiesByKey["Behavior & Training"];

    expect(arrayItem).toBe(mapItem);
  });
});