import type { Appointment } from '@yosemite-crew/types';
import type { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { getDateKeyInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';

/**
 * Pure derivation layer for the phone month overview ("dot map + day peek").
 *
 * Everything here is calendar arithmetic on plain numbers, so it never depends
 * on the host machine's timezone. Appointments are bucketed by their date key in
 * the *preferred* timezone (an instant -> calendar-day conversion, which is the
 * only correct direction), and grid cells build their keys straight from
 * year/month/day parts, so a day can never shift under the bucket.
 */

/** Most dots a single day cell can ever show, however busy the day is. */
export const MAX_LOAD_DOTS = 3;

/**
 * Upper bound of each dot band. A day with <= 6 appointments reads as one dot,
 * <= 10 as two, anything heavier saturates at MAX_LOAD_DOTS.
 */
export const LOAD_DOT_THRESHOLDS: readonly number[] = [6, 10];

/** How many appointments the day peek lists before collapsing into "+N more". */
export const DAY_PEEK_LIMIT = 3;

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: 'REQUESTED',
  UPCOMING: 'UPCOMING',
  CHECKED_IN: 'CHECKED IN',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO SHOW',
};

export type PhoneMonthCell = {
  /** `YYYY-MM-DD` calendar key — the identity of the cell. Consumers derive a concrete instant on
   *  demand (via parseDateKey) only when a day is actually selected, never for every grid cell. */
  dateKey: string;
  dayOfMonth: number;
  /** True for the leading/trailing days borrowed from the adjacent months. */
  isOutsideMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  /** Always 0 for outside-month cells: they are padding, never load. */
  appointmentCount: number;
  dotCount: number;
  hasEmergency: boolean;
};

export type PhoneMonthWeek = {
  /** ISO-8601 week number, matching the "busiest week: 28" header. */
  isoWeek: number;
  appointmentCount: number;
  cells: PhoneMonthCell[];
};

export type PhoneMonthPeekItem = {
  id: string;
  /** 24h clock label in the preferred timezone, e.g. `08:30`. */
  time: string;
  title: string;
  subtitle: string;
  status: AppointmentStatus;
  /** Plain-language badge copy — never the raw enum. */
  statusLabel: string;
  isEmergency: boolean;
};

export type PhoneMonthPeek = {
  dateKey: string;
  /** e.g. `Tue 7 · 14 appointments`. */
  label: string;
  appointmentCount: number;
  items: PhoneMonthPeekItem[];
  hiddenCount: number;
};

export type PhoneMonthModel = {
  year: number;
  /** 1-12. */
  month: number;
  /** e.g. `July 2026` — the month navigator label. */
  monthLabel: string;
  /** e.g. `July` — the display title. */
  monthTitle: string;
  weeks: PhoneMonthWeek[];
  totalAppointments: number;
  /** ISO week number of the busiest row, or null when the month is empty. */
  busiestWeek: number | null;
  /** e.g. `148 appointments · busiest week: 28`. */
  summaryLabel: string;
  peek: PhoneMonthPeek | null;
};

export type PhoneMonthModelInput = {
  /** Any instant inside the month to render. */
  monthDate: Date;
  appointments: readonly Appointment[];
  today: Date;
  selectedDate?: Date | null;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const toDateKey = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

/** UTC is used purely as a fixed frame for calendar arithmetic — never as a timezone. */
const utcDate = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

/** Monday-first weekday index: 0 = Monday ... 6 = Sunday. */
export const getMondayFirstWeekday = (year: number, month: number, day: number): number =>
  (utcDate(year, month, day).getUTCDay() + 6) % DAYS_IN_WEEK;

export const getDaysInMonth = (year: number, month: number): number =>
  utcDate(year, month + 1, 0).getUTCDate();

/** ISO-8601 week number (weeks start Monday; week 1 holds the first Thursday). */
export const getIsoWeekNumber = (year: number, month: number, day: number): number => {
  const thursday = utcDate(year, month, day);
  thursday.setUTCDate(thursday.getUTCDate() - getMondayFirstWeekday(year, month, day) + 3);

  const firstThursday = utcDate(thursday.getUTCFullYear(), 1, 4);
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - getMondayFirstWeekday(thursday.getUTCFullYear(), 1, 4) + 3
  );

  return (
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (DAYS_IN_WEEK * MS_PER_DAY))
  );
};

/** Maps an appointment count onto the dot band it belongs to, capped at MAX_LOAD_DOTS. */
export const getLoadDotCount = (appointmentCount: number): number => {
  // NaN is checked explicitly rather than relying on `!(count > 0)`: a bare
  // `count <= 0` is false for NaN, which would fall through to findIndex and
  // report a NaN day as MAX_LOAD_DOTS - a full day - instead of an empty one.
  if (Number.isNaN(appointmentCount) || appointmentCount <= 0) return 0;
  const band = LOAD_DOT_THRESHOLDS.findIndex((threshold) => appointmentCount <= threshold);
  return band === -1 ? MAX_LOAD_DOTS : band + 1;
};

type DayBucket = {
  appointments: Appointment[];
  hasEmergency: boolean;
};

const bucketByDay = (appointments: readonly Appointment[]): Map<string, DayBucket> => {
  const buckets = new Map<string, DayBucket>();
  appointments.forEach((appointment) => {
    const key = getDateKeyInPreferredTimeZone(appointment.startTime);
    const bucket = buckets.get(key) ?? { appointments: [], hasEmergency: false };
    bucket.appointments.push(appointment);
    bucket.hasEmergency = bucket.hasEmergency || appointment.isEmergency === true;
    buckets.set(key, bucket);
  });
  return buckets;
};

const shiftDays = (
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } => {
  const shifted = utcDate(year, month, day + delta);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const formatMonthPart = (
  year: number,
  month: number,
  options: Intl.DateTimeFormatOptions
): string =>
  new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(utcDate(year, month, 1));

const SHORT_WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
});

const formatShortWeekday = (year: number, month: number, day: number): string =>
  SHORT_WEEKDAY_FORMAT.format(utcDate(year, month, day));

const pluraliseAppointments = (count: number): string =>
  `${count} ${count === 1 ? 'appointment' : 'appointments'}`;

const buildPeekItem = (appointment: Appointment, index: number): PhoneMonthPeekItem => {
  const parts = getDatePartsInPreferredTimeZone(appointment.startTime);
  const reason = appointment.appointmentType?.name ?? appointment.concern;
  const subtitle = [appointment.lead?.name, appointment.room?.name].filter(Boolean).join(' · ');

  return {
    id: appointment.id ?? `${getDateKeyInPreferredTimeZone(appointment.startTime)}-${index}`,
    time: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
    title: reason ? `${appointment.patient.name} · ${reason}` : appointment.patient.name,
    subtitle,
    status: appointment.status,
    statusLabel: STATUS_LABELS[appointment.status],
    isEmergency: appointment.isEmergency === true,
  };
};

const buildPeek = (
  cells: PhoneMonthCell[],
  buckets: Map<string, DayBucket>,
  selectedKey: string | null
): PhoneMonthPeek | null => {
  if (!selectedKey) return null;
  const cell = cells.find((candidate) => candidate.dateKey === selectedKey);
  if (!cell) return null;

  const appointments = [...(buckets.get(selectedKey)?.appointments ?? [])].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  const visible = cell.isOutsideMonth ? [] : appointments;
  const [year, month, day] = selectedKey.split('-').map(Number);

  return {
    dateKey: selectedKey,
    label: `${formatShortWeekday(year, month, day)} ${day} · ${pluraliseAppointments(
      visible.length
    )}`,
    appointmentCount: visible.length,
    items: visible
      .slice(0, DAY_PEEK_LIMIT)
      .map((appointment, index) => buildPeekItem(appointment, index)),
    hiddenCount: Math.max(visible.length - DAY_PEEK_LIMIT, 0),
  };
};

// A month has a busiest week exactly when it has any load at all, so the null
// case here is the same case as a zero total.
const buildSummaryLabel = (total: number, busiestWeek: number | null): string =>
  busiestWeek === null
    ? 'No appointments'
    : `${pluraliseAppointments(total)} · busiest week: ${busiestWeek}`;

/**
 * Builds the whole phone month overview model: a Monday-first 7-column grid
 * padded with the adjacent months' leading/trailing days, per-day dot loads, the
 * ISO week rollups behind "busiest week", and the selected day's peek list.
 */
export const buildPhoneMonthModel = ({
  monthDate,
  appointments,
  today,
  selectedDate,
}: PhoneMonthModelInput): PhoneMonthModel => {
  const { year, month } = getDatePartsInPreferredTimeZone(monthDate);
  const todayKey = getDateKeyInPreferredTimeZone(today);
  const selectedKey = selectedDate ? getDateKeyInPreferredTimeZone(selectedDate) : null;
  const buckets = bucketByDay(appointments);

  const leadingDays = getMondayFirstWeekday(year, month, 1);
  const spannedDays = leadingDays + getDaysInMonth(year, month);
  const cellCount = Math.ceil(spannedDays / DAYS_IN_WEEK) * DAYS_IN_WEEK;

  const cells: PhoneMonthCell[] = Array.from({ length: cellCount }, (_, index) => {
    const ref = shiftDays(year, month, 1, index - leadingDays);
    const dateKey = toDateKey(ref.year, ref.month, ref.day);
    const isOutsideMonth = ref.year !== year || ref.month !== month;
    const bucket = isOutsideMonth ? undefined : buckets.get(dateKey);
    const appointmentCount = bucket?.appointments.length ?? 0;

    return {
      dateKey,
      dayOfMonth: ref.day,
      isOutsideMonth,
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      isSelected: dateKey === selectedKey,
      appointmentCount,
      dotCount: getLoadDotCount(appointmentCount),
      hasEmergency: bucket?.hasEmergency ?? false,
    };
  });

  const weeks: PhoneMonthWeek[] = [];
  for (let start = 0; start < cells.length; start += DAYS_IN_WEEK) {
    const weekCells = cells.slice(start, start + DAYS_IN_WEEK);
    const first = weekCells[0];
    weeks.push({
      isoWeek: getIsoWeekNumber(
        Number(first.dateKey.slice(0, 4)),
        Number(first.dateKey.slice(5, 7)),
        first.dayOfMonth
      ),
      appointmentCount: weekCells.reduce((sum, cell) => sum + cell.appointmentCount, 0),
      cells: weekCells,
    });
  }

  const totalAppointments = weeks.reduce((sum, week) => sum + week.appointmentCount, 0);
  const busiest = weeks.reduce<PhoneMonthWeek | null>(
    (best, week) =>
      week.appointmentCount > 0 && (!best || week.appointmentCount > best.appointmentCount)
        ? week
        : best,
    null
  );

  return {
    year,
    month,
    monthLabel: `${formatMonthPart(year, month, { month: 'long' })} ${year}`,
    monthTitle: formatMonthPart(year, month, { month: 'long' }),
    weeks,
    totalAppointments,
    busiestWeek: busiest?.isoWeek ?? null,
    summaryLabel: buildSummaryLabel(totalAppointments, busiest?.isoWeek ?? null),
    peek: buildPeek(cells, buckets, selectedKey),
  };
};

/** Mid-month noon-UTC anchor for the neighbouring month — safe to re-read in any timezone. */
export const shiftMonthAnchor = (monthDate: Date, delta: number): Date => {
  const { year, month } = getDatePartsInPreferredTimeZone(monthDate);
  return new Date(Date.UTC(year, month - 1 + delta, 15, 12, 0, 0));
};
