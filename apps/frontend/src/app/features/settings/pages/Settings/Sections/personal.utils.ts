import { AvailabilityState } from '@/app/features/appointments/components/Availability/utils';

const DISPLAY_DAYS: ReadonlyArray<{ key: string; abbr: string }> = [
  { key: 'Monday', abbr: 'Mon' },
  { key: 'Tuesday', abbr: 'Tue' },
  { key: 'Wednesday', abbr: 'Wed' },
  { key: 'Thursday', abbr: 'Thu' },
  { key: 'Friday', abbr: 'Fri' },
  { key: 'Saturday', abbr: 'Sat' },
  { key: 'Sunday', abbr: 'Sun' },
];

const rangeLabel = (start: number, end: number): string =>
  start === end
    ? DISPLAY_DAYS[start].abbr
    : `${DISPLAY_DAYS[start].abbr}–${DISPLAY_DAYS[end].abbr}`;

/**
 * Compact one-line summary of the practitioner's weekly availability, e.g.
 * "Mon–Fri · 08:00–17:00". Consecutive enabled days are compressed into ranges and
 * the widest interval across enabled days sets the time span. Returns null when nothing
 * is enabled so the caller can show a "Not set" affordance.
 */
export const summarizeAvailability = (state: AvailabilityState | null): string | null => {
  if (!state) return null;
  const enabledIdx: number[] = [];
  let minStart: string | null = null;
  let maxEnd: string | null = null;

  DISPLAY_DAYS.forEach((day, idx) => {
    const entry = state[day.key];
    const intervals = entry?.enabled
      ? (entry.intervals ?? []).filter((i) => i?.start && i?.end)
      : [];
    if (intervals.length === 0) return;
    enabledIdx.push(idx);
    for (const interval of intervals) {
      if (minStart === null || interval.start < minStart) minStart = interval.start;
      if (maxEnd === null || interval.end > maxEnd) maxEnd = interval.end;
    }
  });

  if (enabledIdx.length === 0 || minStart === null || maxEnd === null) return null;

  const ranges: string[] = [];
  let rangeStart = enabledIdx[0];
  let prev = enabledIdx[0];
  for (let i = 1; i <= enabledIdx.length; i++) {
    const current = enabledIdx[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(rangeLabel(rangeStart, prev));
    rangeStart = current;
    prev = current;
  }

  return `${ranges.join(', ')} · ${minStart}–${maxEnd}`;
};
