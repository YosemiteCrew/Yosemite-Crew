/** Text normalisation shared by the parser and the pet-name matcher. */

/**
 * Lower-cases, strips accents and collapses punctuation to single spaces.
 *
 * Accent folding matters because the app ships Spanish: "¿Cuándo?" and
 * "cuando" have to reach the same keyword table.
 */
export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    // Combining diacritical marks. Removing them folds "á" to "a".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Splits normalised text into word tokens. */
export const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  return normalized.length === 0 ? [] : normalized.split(' ');
};

/**
 * True when every word of `phrase` appears in `tokens`, in order but not
 * necessarily adjacent. "when is vaccine" matches "when is the next vaccine".
 */
export const containsPhrase = (
  tokens: readonly string[],
  phrase: readonly string[],
): boolean => {
  if (phrase.length === 0) {
    return false;
  }
  let cursor = 0;
  for (const token of tokens) {
    if (token === phrase[cursor]) {
      cursor += 1;
      if (cursor === phrase.length) {
        return true;
      }
    }
  }
  return false;
};
