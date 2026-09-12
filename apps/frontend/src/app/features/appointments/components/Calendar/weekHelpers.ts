import { Appointment } from '@yosemite-crew/types';
import { formatDisplayDate } from '@/app/lib/date';
import {
  buildPreferredTimeZoneDayInstant,
  getDatePartsInPreferredTimeZone,
  getHourInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';

export const HOURS_IN_DAY = 24;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(weekStart: Date): Date[] {
  const base = startOfDay(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

/**
 * Noon-anchored instant for the preferred-timezone calendar day containing `date`.
 *
 * Unlike `startOfDay`, which zeroes the *browser's* local clock, this reads the
 * calendar day from the clinic's preferred timezone and re-anchors it at noon in
 * that same zone - noon sits far from any day boundary, so the result survives
 * being reinterpreted through the browser's own (possibly very different) offset
 * without drifting onto a neighbouring date (see `buildPreferredTimeZoneDayInstant`).
 */
export function startOfPreferredTimeZoneDay(date: Date): Date {
  const { year, month, day } = getDatePartsInPreferredTimeZone(date);
  return buildPreferredTimeZoneDayInstant(year, month, day);
}

/**
 * The seven days of the week beginning at `weekStart`, anchored in the clinic's
 * preferred timezone rather than the browser's. `getWeekDays` derives its
 * columns from a browser-local midnight, which can land on the wrong clinic
 * calendar day for a browser far enough from the preferred zone; this instead
 * steps the *preferred-zone* calendar date forward, so column N is always the
 * clinic's own Nth day of the week regardless of where the browser sits.
 */
export function getWeekDaysInPreferredTimeZone(weekStart: Date): Date[] {
  const { year, month, day } = getDatePartsInPreferredTimeZone(weekStart);
  return Array.from({ length: 7 }, (_, i) =>
    buildPreferredTimeZoneDayInstant(year, month, day + i)
  );
}

export function eventsForDayHour(events: Appointment[], day: Date, hour: number): Appointment[] {
  return events.filter((ev) => {
    return (
      isOnPreferredTimeZoneCalendarDay(ev.startTime, day) &&
      getHourInPreferredTimeZone(ev.startTime) === hour
    );
  });
}

export function getNextWeek(currentWeekStart: Date): Date {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

export function getPrevWeek(currentWeekStart: Date): Date {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() - 7);
  return d;
}

export function getStartOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = (day - weekStartsOn + 7) % 7; // how many days since week start
  d.setDate(d.getDate() - diff); // go BACK to the start of the week
  return d;
}

export function getShortWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function getDateNumberPadded(date: Date): string {
  return String(date.getDate()).padStart(2, '0');
}

export function getFormattedDate(date: Date): string {
  return formatDisplayDate(date);
}
