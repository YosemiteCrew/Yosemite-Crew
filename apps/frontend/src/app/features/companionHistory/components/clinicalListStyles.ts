/**
 * Class strings and the date formatter shared by the clinical record lists in
 * the companion record. Kept apart from `ClinicalListChrome.tsx` so that module
 * exports only components.
 */

export const cardClass =
  'flex w-full flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
export const rowClass = 'flex items-start justify-between gap-3 px-4 py-3';
export const titleClass = 'text-[13px] font-bold text-[var(--ink)]';
export const metaClass = 'text-[11.5px] text-[var(--ink-faint)]';
export const fieldLabelClass = 'text-[11.5px] font-semibold text-[var(--ink-muted)]';
export const controlClass =
  'w-full rounded-xl border border-[var(--hairline)] bg-[var(--screen)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--blue)]';

/** Short, locale-aware date. Null when the value is absent or unparseable. */
export const formatDate = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
