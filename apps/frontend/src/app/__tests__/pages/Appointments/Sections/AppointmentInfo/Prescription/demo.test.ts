import {
  DemoSubjective,
  DemoSubjectiveOptions,
  mapSubjectiveFields,
} from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/demo";

describe("Prescription Demo Data", () => {
  // --- Section 1: Static Data Verification ---

  it("should have correct DemoSubjective data structure", () => {
    expect(DemoSubjective).toBeDefined();
    expect(Array.isArray(DemoSubjective)).toBe(true);
    expect(DemoSubjective.length).toBeGreaterThan(0);

    const firstItem = DemoSubjective[0];
    expect(firstItem).toHaveProperty("name");
    expect(firstItem).toHaveProperty("id");
    expect(firstItem).toHaveProperty("description");
  });

  it("should contain specific expected records", () => {
    // Spot check a known record to ensure data integrity didn't change accidentally
    const chiefComplaint = DemoSubjective.find((s) => s.id === "subj-001");
    expect(chiefComplaint).toBeDefined();
    expect(chiefComplaint?.name).toBe("Chief Complaint");
    expect(chiefComplaint?.description).toContain("persistent lower back pain");
  });

  // --- Section 2: Helper Function Logic ---

  it("mapSubjectiveFields should correctly map an array of subjective items", () => {
    const input = [
      { name: "Test Item", id: "123", description: "desc" },
      { name: "Another Item", id: "456", description: "desc2" },
    ];

    const result = mapSubjectiveFields(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: "Test Item", key: "123" });
    expect(result[1]).toEqual({ value: "Another Item", key: "456" });
  });

  it("mapSubjectiveFields should handle empty arrays", () => {
    const result = mapSubjectiveFields([]);
    expect(result).toEqual([]);
  });

  // --- Section 3: Generated Options Export ---

  it("DemoSubjectiveOptions should be generated from DemoSubjective", () => {
    expect(DemoSubjectiveOptions).toHaveLength(DemoSubjective.length);

    // Verify mapping consistency for the first item
    expect(DemoSubjectiveOptions[0]).toEqual({
      value: DemoSubjective[0].name,
      key: DemoSubjective[0].id,
    });
  });

  // --- Section 4: Edge Cases & Type Safety ---

  it("mapSubjectiveFields should handle objects with missing properties gracefully (if typed loosely)", () => {
    // Since the function signature is `data: any`, we check robustness
    const input = [
      { name: "Only Name" }, // Missing ID
      { id: "Only ID" },     // Missing Name
    ];

    const result = mapSubjectiveFields(input);

    expect(result).toEqual([
      { value: "Only Name", key: undefined },
      { value: undefined, key: "Only ID" },
    ]);
  });
});