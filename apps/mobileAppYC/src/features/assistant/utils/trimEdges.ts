/**
 * Character trimming that does not use an anchored regex.
 *
 * `/[^a-z]+$/` and friends read naturally but are super-linear: the engine
 * retries the unbounded quantifier from every start position, so a long run of
 * trimmable characters costs O(n^2). These walk in from each end instead, which
 * is O(n) and obvious.
 */

/** Drops leading characters while `shouldTrim` accepts them. */
export const trimStartWhile = (
  value: string,
  shouldTrim: (char: string) => boolean,
): string => {
  let start = 0;
  while (start < value.length && shouldTrim(value[start])) {
    start += 1;
  }
  return start === 0 ? value : value.slice(start);
};

/** Drops trailing characters while `shouldTrim` accepts them. */
export const trimEndWhile = (
  value: string,
  shouldTrim: (char: string) => boolean,
): string => {
  let end = value.length;
  while (end > 0 && shouldTrim(value[end - 1])) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
};

/** Drops characters `shouldTrim` accepts from both ends. */
export const trimEdgesWhile = (
  value: string,
  shouldTrim: (char: string) => boolean,
): string => trimEndWhile(trimStartWhile(value, shouldTrim), shouldTrim);

/** True for anything that is not an ASCII letter. */
export const isNotLetter = (char: string): boolean =>
  (char < 'A' || char > 'Z') && (char < 'a' || char > 'z');
