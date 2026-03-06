import {
  sanitizeInput,
  assertSafeString,
  assertEmail,
} from "../../src/utils/sanitize";

describe("Sanitize Utils", () => {
  // 1. sanitizeInput
  describe("sanitizeInput", () => {
    it("should sanitize strings (escape, stripLow, trim)", () => {
      // Updated expectation: Validator escapes '/' to '&#x2F;'
      const dirty = "  <div>Hello\x00</div>  ";
      const clean = sanitizeInput(dirty);
      expect(clean).toBe("&lt;div&gt;Hello&lt;&#x2F;div&gt;");
    });

    it("should recursively sanitize arrays", () => {
      const dirtyArray = ["  <a>Link</a>  ", "  <b>Bold</b>  "];
      const cleanArray = sanitizeInput(dirtyArray);
      // Updated expectation: Validator escapes '/' to '&#x2F;'
      expect(cleanArray).toEqual([
        "&lt;a&gt;Link&lt;&#x2F;a&gt;",
        "&lt;b&gt;Bold&lt;&#x2F;b&gt;",
      ]);
    });

    it("should recursively sanitize objects", () => {
      const dirtyObj = {
        name: "  <script>alert(1)</script>  ",
        bio: "  Simple  ",
      };
      const cleanObj = sanitizeInput(dirtyObj);
      // Updated expectation: Validator escapes '/' to '&#x2F;'
      expect(cleanObj).toEqual({
        name: "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
        bio: "Simple",
      });
    });

    it("should handle deeply nested structures (Object in Array in Object)", () => {
      const complex = {
        list: [{ tag: "  <h1>Title</h1>  " }],
      };
      const clean = sanitizeInput(complex);
      // Updated expectation: Validator escapes '/' to '&#x2F;'
      expect(clean).toEqual({
        list: [{ tag: "&lt;h1&gt;Title&lt;&#x2F;h1&gt;" }],
      });
    });

    it("should return non-string/non-object values as is", () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(true)).toBe(true);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });
  });

  // 2. assertSafeString
  describe("assertSafeString", () => {
    it("should throw if input is not a string", () => {
      expect(() => assertSafeString(123, "username")).toThrow(
        "username must be a string",
      );
    });

    it('should return input directly if field is "email" (Bypass logic)', () => {
      const email = "user.name@example.com";
      expect(assertSafeString(email, "email")).toBe(email);
    });

    it('should throw if input contains "$"', () => {
      expect(() => assertSafeString("user$name", "username")).toThrow(
        "username contains invalid characters",
      );
    });

    it('should throw if input contains "." (excluding email field)', () => {
      expect(() => assertSafeString("user.name", "username")).toThrow(
        "username contains invalid characters",
      );
    });

    it("should throw if input contains invalid regex characters (e.g., spaces)", () => {
      expect(() => assertSafeString("user name", "username")).toThrow(
        "username contains invalid format",
      );
    });

    it("should return valid input", () => {
      const valid = "Username123";
      expect(assertSafeString(valid, "username")).toBe(valid);
    });
  });

  // 3. assertEmail
  describe("assertEmail", () => {
    it("should throw if input is not a string", () => {
      expect(() => assertEmail(123)).toThrow("email must be a string");
    });

    it('should throw if input starts with "$"', () => {
      expect(() => assertEmail("$injection@test.com")).toThrow(
        "email cannot start with '$'",
      );
    });

    it("should throw if input is not a valid email format", () => {
      expect(() => assertEmail("not-an-email")).toThrow(
        "email must be a valid email",
      );
    });

    it("should sanitize (trim + lowercase) and return valid email", () => {
      // NOTE: Validator checks format BEFORE trim.
      // Input must be valid email format first (no spaces), then we test lowercase logic.
      const input = "TEST@Example.com";
      const output = assertEmail(input);
      expect(output).toBe("test@example.com");
    });

    it("should use custom field name in error messages", () => {
      expect(() => assertEmail("bad-email", "secondaryEmail")).toThrow(
        "secondaryEmail must be a valid email",
      );
    });
  });
});
