/**
 * Canonical form for a breed code.
 *
 * The vocabulary holds the same breed under two separator conventions. On
 * production today `CodeEntry` has 1,749 breed codes that collapse to 1,713
 * distinct ones: 36 breeds exist as BOTH `SHIH_TZU` and `SHIH-TZU`,
 * `LHASA_APSO` and `LHASA-APSO`, and so on. Patient rows are split the same way
 * - of the seven coded companions in production, four are hyphenated and three
 * are not.
 *
 * The backend's own generator (`idexx-reference.service.ts`) emits underscores,
 * so underscore is the canonical form here.
 *
 * This matters more than a tidiness fix. A recommendation rule keyed on one
 * spelling would silently return nothing for every patient coded the other way,
 * and a recommendation that is silently absent looks exactly like a breed with
 * no guidance for it. Comparing canonical forms is what stops that.
 */
/**
 * Collapse runs of separators, without a regular expression.
 *
 * `/_{2,}/g` would read more compactly, but the security scan flags a quantified
 * pattern applied to caller-supplied text, and a breed code is not worth
 * arguing the point over. This is also exact at the edges: a single leading or
 * trailing separator survives, where a split/filter/join would silently eat it.
 */
const collapseSeparators = (value: string): string => {
  let out = "";
  let previousWasSeparator = false;
  for (const char of value) {
    const isSeparator = char === "_";
    if (!isSeparator || !previousWasSeparator) out += char;
    previousWasSeparator = isSeparator;
  }
  return out;
};

export const canonicalBreedCode = (
  code: string | null | undefined,
): string | null => {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  return collapseSeparators(trimmed.toUpperCase().replaceAll("-", "_"));
};

/** True when two breed codes name the same breed, whichever convention each uses. */
export const breedCodesMatch = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  const left = canonicalBreedCode(a);
  const right = canonicalBreedCode(b);
  // Two unknowns are not a match. This is used to decide whether a rule applies,
  // so anything unreadable has to fall through to "no".
  if (!left || !right) return false;
  return left === right;
};

/**
 * `Patient.speciesCode` uses the YSPEC vocabulary; `TaskLibraryDefinition` and
 * the rules use the `TaskLibrarySpecies` enum. Only the three species the enum
 * covers can map, and anything else yields null rather than a guess.
 */
const SPECIES_BY_CODE: Record<string, "dog" | "cat" | "horse"> = {
  "YSPEC:CANINE": "dog",
  "YSPEC:FELINE": "cat",
  "YSPEC:EQUINE": "horse",
};

export const taskSpeciesForCode = (
  speciesCode: string | null | undefined,
): "dog" | "cat" | "horse" | null => {
  if (typeof speciesCode !== "string") return null;
  return SPECIES_BY_CODE[speciesCode.trim().toUpperCase()] ?? null;
};

/**
 * Whole months from birth to `asOf`, floored, or null if the date of birth is
 * unusable. A future date of birth yields null rather than a negative age: it is
 * bad data, and a negative age would silently satisfy any `maxAgeMonths` bound.
 */
export const ageInMonths = (
  dateOfBirth: Date | null | undefined,
  asOf: Date,
): number | null => {
  if (!(dateOfBirth instanceof Date) || Number.isNaN(dateOfBirth.getTime())) {
    return null;
  }
  if (dateOfBirth.getTime() > asOf.getTime()) return null;

  let months =
    (asOf.getFullYear() - dateOfBirth.getFullYear()) * 12 +
    (asOf.getMonth() - dateOfBirth.getMonth());
  // Not a whole month yet if the day of the month has not come round.
  if (asOf.getDate() < dateOfBirth.getDate()) months -= 1;
  return Math.max(0, months);
};
