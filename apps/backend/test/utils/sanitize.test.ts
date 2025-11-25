import { sanitizeInput, assertSafeString } from "../../src/utils/sanitize";

describe("sanitizeInput", () => {
  it("trims, strips low chars, and escapes strings", () => {
    const input = "  <script>\u0007 ";
    const result = sanitizeInput(input);
    expect(result).toBe("&lt;script&gt;");
  });

  it("sanitizes arrays recursively", () => {
    const input = ["  hello  ", "<b>world</b>"];
    const result = sanitizeInput(input);
    expect(result).toEqual(["hello", "&lt;b&gt;world&lt;&#x2F;b&gt;"]);
  });

  it("sanitizes objects recursively without mutating original", () => {
    const input = {
      name: " Alice ",
      nested: { note: "<test>" },
      count: 5,
    };

    const result = sanitizeInput(input);

    expect(result).toEqual({
      name: "Alice",
      nested: { note: "&lt;test&gt;" },
      count: 5,
    });
    expect(input.name).toBe(" Alice "); // ensure original untouched
  });
});

describe("assertSafeString", () => {
  it("throws when input is not a string", () => {
    expect(() => assertSafeString(123, "field")).toThrow(
      "field must be a string",
    );
  });

  it("throws when string contains mongo operators", () => {
    expect(() => assertSafeString("$ne:1", "username")).toThrow(
      "username contains invalid characters",
    );
    expect(() => assertSafeString("user.name", "username")).toThrow(
      "username contains invalid characters",
    );
  });

  it("throws when string contains disallowed characters", () => {
    expect(() => assertSafeString("bad#name", "username")).toThrow(
      "username contains invalid format",
    );
  });

  it("returns input when string is safe", () => {
    expect(assertSafeString("valid_name-123@example_com", "email")).toBe(
      "valid_name-123@example_com",
    );
  });
});
