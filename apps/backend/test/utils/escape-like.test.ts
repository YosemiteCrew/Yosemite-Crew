import { escapeLikePattern } from "../../src/utils/escape-like";

/**
 * Reproduce how PostgreSQL reads a LIKE pattern, so these tests assert what the
 * database will actually match rather than restating the implementation. In
 * LIKE, `%` matches any run of characters, `_` matches one, and a backslash
 * escapes the character that follows it - including an ordinary one, where it
 * is simply a no-op.
 */
type LikeToken =
  { kind: "literal"; char: string } | { kind: "anyRun" } | { kind: "oneChar" };

const tokenize = (pattern: string): LikeToken[] => {
  const tokens: LikeToken[] = [];

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];

    if (char === "\\" && i + 1 < pattern.length) {
      tokens.push({ kind: "literal", char: pattern[i + 1] });
      i += 1;
    } else if (char === "%") {
      tokens.push({ kind: "anyRun" });
    } else if (char === "_") {
      tokens.push({ kind: "oneChar" });
    } else {
      tokens.push({ kind: "literal", char });
    }
  }

  return tokens;
};

// Matched directly rather than by translating to a regular expression, so the
// test does not depend on a second escaping layer being right, and so no
// pattern is ever compiled from a built string.
const likeMatches = (pattern: string, subject: string): boolean => {
  const tokens = tokenize(pattern);
  let t = 0;
  let s = 0;
  let lastRun = -1;
  let lastRunSubject = 0;

  while (s < subject.length) {
    const token = tokens[t];

    if (token?.kind === "anyRun") {
      lastRun = t;
      lastRunSubject = s;
      t += 1;
    } else if (
      token?.kind === "oneChar" ||
      (token?.kind === "literal" && token.char === subject[s])
    ) {
      t += 1;
      s += 1;
    } else if (lastRun !== -1) {
      // Backtrack: let the previous % swallow one more character.
      t = lastRun + 1;
      lastRunSubject += 1;
      s = lastRunSubject;
    } else {
      return false;
    }
  }

  while (tokens[t]?.kind === "anyRun") {
    t += 1;
  }

  return t === tokens.length;
};

// Prisma's `contains` wraps the value in % on both sides.
const contains = (search: string, subject: string): boolean =>
  likeMatches(`%${escapeLikePattern(search)}%`, subject);

describe("escapeLikePattern", () => {
  it("escapes only the three characters LIKE gives meaning to", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_c")).toBe("a\\_c");
    expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves everything else untouched", () => {
    expect(escapeLikePattern("Jean-Luc")).toBe("Jean-Luc");
    expect(escapeLikePattern("O'Brien (Jr.)")).toBe("O'Brien (Jr.)");
    expect(escapeLikePattern("a.b*c+d?e^f$g|h")).toBe("a.b*c+d?e^f$g|h");
    expect(escapeLikePattern("")).toBe("");
    expect(escapeLikePattern("emoji 🐶 accents é")).toBe("emoji 🐶 accents é");
  });

  // The regression this replaced: the previous regex escape emitted \x2d for a
  // hyphen, which LIKE reads as the literal text "x2d", so a hyphenated name
  // matched nothing at all.
  it("finds hyphenated names, which the previous regex escape could not", () => {
    expect(contains("Jean-Luc", "Jean-Luc Picard")).toBe(true);
    expect(contains("Mary-Jane", "Mary-Jane Watson")).toBe(true);
    expect(contains("@sub-domain.com", "someone@sub-domain.com")).toBe(true);

    // What the old escape produced, shown to still be broken.
    const oldEscape = (v: string) =>
      v.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
    expect(likeMatches(`%${oldEscape("Jean-Luc")}%`, "Jean-Luc Picard")).toBe(
      false,
    );
  });

  it("stops a wildcard in user input from widening the search", () => {
    // Without escaping, "100%" would match anything starting with 100.
    expect(contains("100%", "100% cotton")).toBe(true);
    expect(contains("100%", "1000 units")).toBe(false);

    // Underscore must match an underscore, not any single character.
    expect(contains("a_c", "a_c")).toBe(true);
    expect(contains("a_c", "abc")).toBe(false);

    // A lone % must not match every row.
    expect(contains("%", "50% off")).toBe(true);
    expect(contains("%", "nothing here")).toBe(false);
  });

  it("keeps a literal backslash literal", () => {
    expect(contains("a\\b", "a\\b")).toBe(true);
    expect(contains("a\\b", "ab")).toBe(false);
  });

  it("still matches the ordinary names it always did", () => {
    for (const name of ["Bella", "O'Brien (Jr.)", "Ann.Marie", "Zoë"]) {
      expect(contains(name, `the ${name} record`)).toBe(true);
    }
  });

  it("rejects a non-string", () => {
    expect(() => escapeLikePattern(42 as unknown as string)).toThrow(TypeError);
  });
});
