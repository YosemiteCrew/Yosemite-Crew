/**
 * Escape a string so it can be embedded in a regular expression literally.
 *
 * This replaces the `escape-string-regexp` dependency. That package went
 * ESM-only at v5 (`"type": "module"` with no CommonJS export), and this backend
 * compiles to CommonJS, so `require`ing it throws at runtime. Pinning to the
 * last CommonJS release would leave the same wall in front of every future
 * bump, and the whole implementation is two replacements with a fixed spec.
 *
 * Behaviour matches escape-string-regexp 5.0.0 exactly, including the `\x2d`
 * form for a hyphen: a plain `\-` is valid in most patterns but rejected by the
 * stricter grammar Unicode-mode patterns use, so the numeric escape is the form
 * that is always safe.
 */
export function escapeRegExp(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("Expected a string");
  }

  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

export default escapeRegExp;
