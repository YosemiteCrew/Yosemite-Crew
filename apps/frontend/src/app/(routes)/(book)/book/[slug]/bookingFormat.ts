import type { PublicSlot } from '@/app/features/publicBooking/services/publicBooking.service';

/**
 * The pure helpers behind the public booking pages.
 *
 * A plain `.ts` module, separate from the components, so neither file mixes
 * component and non-component exports - which is what stops Fast Refresh
 * preserving state.
 */

/**
 * Built once at module scope, not per call.
 *
 * `new Intl.DateTimeFormat()` is expensive, and `formatLongDay` runs on every
 * render of the day hint - which is every keystroke in the form beneath it,
 * since they share the same component's state.
 */
const SHORT_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const LONG_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const utcDay = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Pinned to en-GB and UTC so the strings are the same in jest, in CI and in the
// browser, whatever the machine's locale and zone.
export const formatShortDay = (iso: string) => SHORT_DAY.format(utcDay(iso));

export const formatLongDay = (iso: string) => LONG_DAY.format(utcDay(iso));

const RELATIVE_DAY_LABELS = ['Today', 'Tomorrow'] as const;

/** Indexed rather than nested ternaries, which Sonar rejects. */
export const quickDayLabel = (index: number, iso: string) =>
  RELATIVE_DAY_LABELS[index] ?? formatShortDay(iso);

export const DAY_PARTS = [
  { key: 'morning', label: 'Morning', from: 0, until: 12 },
  { key: 'afternoon', label: 'Afternoon', from: 12, until: 17 },
  { key: 'evening', label: 'Evening', from: 17, until: 24 },
] as const;

export type DayPartGroup = {
  key: string;
  label: string;
  slots: PublicSlot[];
};

/**
 * Twenty-seven identical capsules in one flat wrap is a wall, not a choice.
 *
 * One pass over the day parts building only the groups that have something in
 * them, rather than mapping and then filtering the result. `from` is a field on
 * each part rather than a lookback into the previous element, so nothing here
 * depends on the array's order.
 */
export const groupByDayPart = (slots: PublicSlot[]): DayPartGroup[] => {
  const groups: DayPartGroup[] = [];

  for (const part of DAY_PARTS) {
    const inPart = slots.filter((slot) => {
      const hour = Number(slot.startTime.slice(0, 2));
      return hour >= part.from && hour < part.until;
    });
    if (inPart.length > 0) {
      groups.push({ key: part.key, label: part.label, slots: inPart });
    }
  }

  return groups;
};

/**
 * Which of the two preconditions is missing, in words.
 *
 * The submit button is disabled from first paint until a time is chosen and
 * consent is ticked, and nothing on the page used to say which. Returns null
 * when neither is missing, and the caller shows the chosen summary instead.
 */
export const describeBlock = (selectedTime: string | null, consent: boolean) => {
  if (!selectedTime) return 'Choose a time above to send your request.';
  if (!consent) return 'Tick the box above to send your request.';
  return null;
};
