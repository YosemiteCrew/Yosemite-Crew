import { generatePet, generatePets, demoData } from "../../../pages/Companions/demo";

describe("Companions Demo Data Generator", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    // Restore the global crypto object after every test
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
    });
    jest.restoreAllMocks();
  });

  // --- Section 1: Standard Functionality (Using Crypto) ---

  it("generatePet returns a valid CompanionProps object with expected structure", () => {
    // Ensure crypto exists for this test
    const mockGetRandomValues = jest.fn((buf) => {
      buf[0] = 123456789; // Return a predictable number
      return buf;
    });

    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: mockGetRandomValues },
      writable: true,
    });

    const pet = generatePet();

    // Verify all keys exist
    expect(pet).toHaveProperty("image");
    expect(pet).toHaveProperty("name");
    expect(pet).toHaveProperty("breed");
    expect(pet).toHaveProperty("species");
    expect(pet).toHaveProperty("parent");
    expect(pet).toHaveProperty("gender");
    expect(pet).toHaveProperty("status");

    // Verify specific formats logic
    expect(pet.age).toContain("years");
    expect(pet.weight).toContain("kg");
    expect(pet.parentEmail).toMatch(/@example\.com$/);
    expect(pet.coParentEmail).toMatch(/@example\.com$/);
    expect(pet.parentNumber).toMatch(/^\+91 \d{10}$/);
    expect(pet.microchipNumber).toMatch(/^MC-\d+/);
    expect(pet.passportNumber).toMatch(/^PET-\d+/);
    expect(pet.insuranceNumber).toMatch(/^INS-\d+/);

    // Verify crypto was used
    expect(mockGetRandomValues).toHaveBeenCalled();
  });

  // --- Section 2: Branch Coverage (Fallback to Math.random) ---

  it("falls back to Math.random() when crypto is undefined", () => {
    // 1. Remove crypto from global scope to trigger the 'else' (fallback) branch
    // This covers the branch: if (typeof crypto !== "undefined" ...) -> False
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      writable: true,
    });

    // 2. Spy on Math.random to verify it gets called instead
    const mathSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    // 3. Execute function
    const pet = generatePet();

    // 4. Assertions
    expect(pet).toBeDefined();
    expect(pet.name).toBeDefined();
    expect(mathSpy).toHaveBeenCalled();
  });

  it("falls back to Math.random() when getRandomValues is missing from crypto", () => {
    // 1. Define crypto but WITHOUT getRandomValues
    // This covers the branch: ... && "getRandomValues" in crypto -> False
    Object.defineProperty(globalThis, "crypto", {
      value: {}, // Empty object
      writable: true,
    });

    const mathSpy = jest.spyOn(Math, "random").mockReturnValue(0.3);

    const pet = generatePet();

    expect(pet).toBeDefined();
    expect(mathSpy).toHaveBeenCalled();
  });

  // --- Section 3: Helper & Array Generators ---

  it("generatePets(count) returns an array of the specified length", () => {
    const count = 5;
    const pets = generatePets(count);

    expect(Array.isArray(pets)).toBe(true);
    expect(pets).toHaveLength(count);

    // Verify contents are valid objects
    pets.forEach((pet) => {
      expect(pet).toHaveProperty("name");
      expect(pet).toHaveProperty("breed");
    });
  });

  // --- Section 4: Exported Constant ---

  it("demoData is generated correctly on load", () => {
    expect(Array.isArray(demoData)).toBe(true);
    expect(demoData).toHaveLength(20);
    expect(demoData[0]).toHaveProperty("name");
  });
});