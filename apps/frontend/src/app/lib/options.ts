/**
 * Shared shape for `{ label, value }` select/option entries built from pair tuples.
 */
export type LabelValueOption<V extends string = string> = {
  label: string;
  value: V;
};

/**
 * Build a `{ label, value }` option list from compact `[label, value]` pairs, so
 * declarative option tables stay one line per entry instead of repeating the
 * object literal shape for every row.
 */
export const makeOptions = <V extends string = string>(
  pairs: ReadonlyArray<readonly [label: string, value: V]>
): LabelValueOption<V>[] => pairs.map(([label, value]) => ({ label, value }));
