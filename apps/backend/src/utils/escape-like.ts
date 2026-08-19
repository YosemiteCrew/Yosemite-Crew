/**
 * Escape a user-supplied string so Prisma's `contains` treats it as a literal.
 *
 * `contains` compiles to a PostgreSQL `LIKE`/`ILIKE` pattern, and Prisma passes
 * the value through without escaping, so `%` and `_` in user input act as
 * wildcards: a search for "a_c" also matches "abc", and a search for "100%"
 * matches everything starting with "100". Backslash is PostgreSQL's default
 * LIKE escape character, so escaping these three characters with it makes the
 * pattern mean exactly the text the user typed.
 *
 * This replaces an earlier regex escape on the same call sites. That was always
 * the wrong tool - `contains` is a LIKE pattern, not a regular expression - and
 * it only appeared to work because escaping an ordinary character with a
 * backslash is a no-op in LIKE. It stopped appearing to work when the escape
 * started emitting `\x2d` for a hyphen, which LIKE reads as the literal text
 * `x2d`, so "Jean-Luc" searched for "Jeanx2dLuc" and matched nothing.
 */
export function escapeLikePattern(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("Expected a string");
  }

  return value.replace(/[\\%_]/g, String.raw`\$&`);
}

export default escapeLikePattern;
