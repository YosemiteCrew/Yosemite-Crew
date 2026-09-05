/**
 * Validation for the organisation discount-cap field.
 *
 * Split out of index.tsx because a module that exports both React components and
 * plain values loses per-component Fast Refresh: an edit here would invalidate the
 * whole page module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
export const MIN_DISCOUNT_PERCENT = 0;
export const MAX_DISCOUNT_PERCENT = 100;

/** Parse the cap input. Empty means "no cap"; anything non-numeric or out of 0-100 is invalid. */
export const parseCapInput = (
  raw: string
): { ok: true; value: number | null } | { ok: false; message: string } => {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return {
      ok: false,
      message: 'Enter a number between 0 and 100, or leave it empty for no cap.',
    };
  }
  if (parsed < MIN_DISCOUNT_PERCENT || parsed > MAX_DISCOUNT_PERCENT) {
    return { ok: false, message: 'The cap must be between 0 and 100 percent.' };
  }
  return { ok: true, value: parsed };
};
