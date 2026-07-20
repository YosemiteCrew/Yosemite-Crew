import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { getIsoWeekNumber } from './phoneMonthModel';

/**
 * Pure derivation for the tablet calendar toolbar.
 *
 * The tablet frame condenses the desktop header into a single pager + title
 * line, so the toolbar needs a compact range label ("6 – 12 Jul") and a title
 * that names the period rather than repeating the month picker. Everything here
 * is formatting only — no state, no side effects — so it can be unit tested
 * without rendering the grid.
 */

const DAYS_IN_WEEK = 7;

export const addCalendarDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * The frame writes dates day-first ("6 – 12 Jul", "Tue 7 Jul"), which `en-US`
 * will not produce, so the day and month are composed by hand from the
 * preferred-timezone parts rather than handed wholesale to `Intl`.
 */
const getShortMonth = (date: Date): string =>
  formatDateInPreferredTimeZone(date, { month: 'short' });

const getShortWeekday = (date: Date): string =>
  formatDateInPreferredTimeZone(date, { weekday: 'short' });

/**
 * "6 – 12 Jul" when the week sits inside one month, "29 Jun – 5 Jul" when it
 * straddles two. Uses an en dash exactly as the frame does.
 */
export const getWeekRangeLabel = (weekStart: Date): string => {
  const weekEnd = addCalendarDays(weekStart, DAYS_IN_WEEK - 1);
  const startParts = getDatePartsInPreferredTimeZone(weekStart);
  const endParts = getDatePartsInPreferredTimeZone(weekEnd);
  const endLabel = `${endParts.day} ${getShortMonth(weekEnd)}`;

  if (startParts.month === endParts.month && startParts.year === endParts.year) {
    return `${startParts.day} – ${endLabel}`;
  }

  return `${startParts.day} ${getShortMonth(weekStart)} – ${endLabel}`;
};

/** "Tue 7 Jul" — the period label for the single-day and team views. */
export const getDayRangeLabel = (date: Date): string =>
  `${getShortWeekday(date)} ${getDatePartsInPreferredTimeZone(date).day} ${getShortMonth(date)}`;

export type TabletToolbarTitle = {
  /** e.g. `Week 28` or `Tue 7 Jul`. */
  title: string;
  /** e.g. `(41 appointments)`, or an empty string when the period is empty. */
  countLabel: string;
};

export type TabletToolbarTitleInput = {
  /** The shared page-level view key: `day` | `week` | `team`. */
  activeCalendar: string;
  currentDate: Date;
  weekStart: Date;
  /** Appointments already scoped to the visible period by the caller. */
  appointmentCount: number;
};

const pluralise = (count: number): string =>
  `${count} ${count === 1 ? 'appointment' : 'appointments'}`;

export const buildTabletToolbarTitle = ({
  activeCalendar,
  currentDate,
  weekStart,
  appointmentCount,
}: TabletToolbarTitleInput): TabletToolbarTitle => {
  const countLabel = appointmentCount > 0 ? `(${pluralise(appointmentCount)})` : '';

  if (activeCalendar === 'week') {
    const parts = getDatePartsInPreferredTimeZone(weekStart);
    return {
      title: `Week ${getIsoWeekNumber(parts.year, parts.month, parts.day)}`,
      countLabel,
    };
  }

  return { title: getDayRangeLabel(currentDate), countLabel };
};

/**
 * The pager steps a whole week in the week view and a single day everywhere
 * else, so one control drives both without changing which view is active.
 */
export const getPagerStepDays = (activeCalendar: string): number =>
  activeCalendar === 'week' ? DAYS_IN_WEEK : 1;
