/**
 * Drop any trailing slashes so a configured base URL can be joined to a path
 * without producing a double slash.
 *
 * Scanned backwards rather than matched with `/\/+$/`: a quantifier tied to an
 * end anchor is retried from every start offset, so that regex degrades to
 * super-linear runtime on a long run of slashes. This walk is linear.
 */
export const stripTrailingSlash = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === "/") end -= 1;
  return value.slice(0, end);
};
