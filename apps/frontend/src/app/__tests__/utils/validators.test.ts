import { validatePhone, getCountryCode, isValidEmail } from "../../utils/validators";

// --- Mocks ---

// Mock the country list JSON to ensure deterministic tests
// virtual: true helps if the file doesn't actually exist in the test environment context
jest.mock("@/app/utils/countryList.json", () => [
  { name: "TestLand", dial_code: "+1", code: "TL" },
  { name: "Wonderland", dial_code: "+99", code: "WL" },
], { virtual: true });

describe("Validators Utils", () => {

  // --- Section 1: Phone Validation ---
  describe("validatePhone", () => {
    it("returns true for a valid phone number", () => {
      // Using a real valid format that libphonenumber-js recognizes
      // (Assuming US +1 for the test, library behavior is standard)
      expect(validatePhone("+14155552671")).toBe(true);
    });

    it("returns false for an obviously invalid phone number", () => {
      expect(validatePhone("123")).toBe(false);
    });

    it("returns false when parsing returns undefined (e.g. non-numeric input)", () => {
      // "abc" causes parsePhoneNumberFromString to return undefined,
      // triggering the right side of 'number?.isValid() || false'
      expect(validatePhone("abc")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validatePhone("")).toBe(false);
    });
  });

  // --- Section 2: Country Code Lookup ---
  describe("getCountryCode", () => {
    it("returns null if country input is undefined", () => {
      expect(getCountryCode(undefined)).toBeNull();
    });

    it("returns null if country input is an empty string", () => {
      expect(getCountryCode("")).toBeNull();
    });

    it("returns the country object when a matching name is found", () => {
      // Matches the mocked data defined at the top
      const result = getCountryCode("TestLand");
      expect(result).toEqual({ name: "TestLand", dial_code: "+1", code: "TL" });
    });

    it("returns null when the country name does not exist in the list", () => {
      expect(getCountryCode("Narnia")).toBeNull();
    });
  });

  // --- Section 3: Email Validation ---
  describe("isValidEmail", () => {
    it("returns true for a standard valid email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("trims whitespace and returns true for a valid email", () => {
      // Covers the 'const cleaned = email.trim()' line
      expect(isValidEmail("  user@example.com  ")).toBe(true);
    });

    it("returns false for an invalid email format", () => {
      expect(isValidEmail("user@.com")).toBe(false);
    });

    it("returns false for a string without @", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    it("returns false for an empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });
  });
});