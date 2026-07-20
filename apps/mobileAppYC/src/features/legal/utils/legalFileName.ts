// Trims leading/trailing dashes with a plain scan instead of a `-+$`-style
// regex, which a regex engine can backtrack over quadratically on input with
// many separate dash runs.
const trimDashes = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '-') {
    start += 1;
  }
  while (end > start && value[end - 1] === '-') {
    end -= 1;
  }
  return value.slice(start, end);
};

/** Builds a safe local file name from arbitrary label parts, e.g. `buildLegalFileName(['Terms & Conditions', 'v1'])` -> `Terms-Conditions-v1.pdf`. */
export const buildLegalFileName = (
  parts: Array<string | undefined | null>,
): string => {
  const slug = trimDashes(
    parts
      .filter((part): part is string => Boolean(part?.trim()))
      .join('-')
      .replaceAll(/[^a-zA-Z0-9]+/g, '-'),
  );
  return `${slug || 'document'}.pdf`;
};
