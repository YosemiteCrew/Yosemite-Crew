/**
 * Build a partial update payload from the keys a caller actually supplied.
 *
 * Update params spell "leave this column unchanged" as `undefined` and "clear
 * this column" as `null`, so only the defined keys may be copied across. Taking
 * the key list explicitly - rather than copying every own property - keeps the
 * compiler checking each field against both the params type and the Prisma
 * update input, which a blanket cast would silently give up.
 */
export const pickDefined = <T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> => {
  const picked: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked;
};
