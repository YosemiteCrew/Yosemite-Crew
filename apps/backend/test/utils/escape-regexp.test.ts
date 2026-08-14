import { escapeRegExp } from "../../src/utils/escape-regexp";

describe("escapeRegExp", () => {
  // The published escape-string-regexp 5.0.0 implementation, inlined so the
  // replacement is asserted against the behaviour it replaces rather than
  // against a restatement of itself.
  const reference = (value: string) =>
    value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");

  it("escapes every character with meaning in a pattern", () => {
    expect(escapeRegExp("|\\{}()[]^$+*?.")).toBe(
      "\\|\\\\\\{\\}\\(\\)\\[\\]\\^\\$\\+\\*\\?\\.",
    );
  });

  // A plain `\-` is rejected by the stricter grammar Unicode-mode patterns use,
  // so the numeric escape is the form that is always valid.
  it("escapes a hyphen numerically rather than with a backslash", () => {
    expect(escapeRegExp("a-b")).toBe("a\\x2db");
    expect(escapeRegExp("a-b")).not.toContain("\\-");
  });

  it("leaves ordinary characters untouched", () => {
    expect(escapeRegExp("Bella the dog 123")).toBe("Bella the dog 123");
    expect(escapeRegExp("")).toBe("");
  });

  it("matches escape-string-regexp 5.0.0 across a spread of inputs", () => {
    const cases = [
      "",
      "plain",
      "a-b",
      "^start",
      "end$",
      "a.b*c+d?e",
      "(group)",
      "[set]",
      "{2,3}",
      "back\\slash",
      "pipe|pipe",
      "Bella (2) [good-dog] $$$",
      "emoji 🐶 and accents é",
      "-".repeat(5),
    ];
    for (const input of cases) {
      expect(escapeRegExp(input)).toBe(reference(input));
    }
  });

  // The point of the helper: whatever a user types must match itself literally
  // and never act as a pattern.
  it("makes an escaped string match itself literally", () => {
    for (const input of ["a.b", "a-b", "x+y", "[]", "(a|b)", "^$"]) {
      const pattern = new RegExp(escapeRegExp(input));
      expect(pattern.test(input)).toBe(true);
    }
    // A wildcard must stop being a wildcard.
    expect(new RegExp(escapeRegExp("a.c")).test("abc")).toBe(false);
  });

  it("stays valid inside a unicode-mode pattern", () => {
    for (const input of ["a-b", "a.b", "[x-y]"]) {
      expect(() => new RegExp(escapeRegExp(input), "u")).not.toThrow();
    }
  });

  it("rejects a non-string, as the package did", () => {
    expect(() => escapeRegExp(42 as unknown as string)).toThrow(TypeError);
    expect(() => escapeRegExp(undefined as unknown as string)).toThrow(
      "Expected a string",
    );
  });
});
