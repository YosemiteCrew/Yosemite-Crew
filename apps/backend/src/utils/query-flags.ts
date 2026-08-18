/**
 * Read an optional tri-state boolean filter out of a query string value.
 *
 * `"true"` and `"false"` select the matching records; anything else - including
 * an absent or malformed parameter - means "do not filter on this flag" and
 * yields `undefined`, so callers fall back to their unfiltered default.
 */
export const parseOptionalBooleanFlag = (
  value: unknown,
): boolean | undefined => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};
