import definitionsData from "@/app/pages/TermsAndConditions/data";

describe("TermsAndConditions Data (definitionsData)", () => {

  // --- 1. Structure & Top-level Properties ---

  it("exports the correct title and intro text", () => {
    expect(definitionsData).toBeDefined();
    expect(definitionsData.title).toBe("DEFINITIONS");
    expect(definitionsData.intro).toContain(
      "In addition to terms defined elsewhere in this Agreement"
    );
  });

  // --- 2. Array Integrity ---

  it("contains the correct number of definition entries", () => {
    // We expect exactly 5 definitions based on the source file provided
    expect(definitionsData.definitions).toHaveLength(5);
  });

  // --- 3. Content Verification (Spot Check) ---

  it("contains specific definitions with correct IDs and meanings", () => {
    // Check first item
    const adminAccount = definitionsData.definitions.find((d) => d.id === "1.1");
    expect(adminAccount).toBeDefined();
    expect(adminAccount?.term).toBe("Admin Account");
    expect(adminAccount?.meaning).toContain("most comprehensive rights");

    // Check last item
    const customerData = definitionsData.definitions.find((d) => d.id === "1.5");
    expect(customerData).toBeDefined();
    expect(customerData?.term).toBe("Customer Data");
    expect(customerData?.meaning).toContain("including but not limited to personal data");
  });

  // --- 4. Type Safety Check (Implicit) ---

  it("ensures all definitions follow the required schema", () => {
    definitionsData.definitions.forEach((def) => {
      expect(def).toHaveProperty("id");
      expect(typeof def.id).toBe("string");

      expect(def).toHaveProperty("term");
      expect(typeof def.term).toBe("string");

      expect(def).toHaveProperty("meaning");
      expect(typeof def.meaning).toBe("string");
    });
  });
});