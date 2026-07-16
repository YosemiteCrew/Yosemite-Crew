import type { Appointment } from '@yosemite-crew/types';

/**
 * Pure derivation for the phone "week as a load list" view.
 *
 * The phone does not shrink the week grid — it turns the week into seven rows,
 * each carrying that day's load. Everything the row renders (its summary
 * sentence, its attention flag and the proportional segments of its load bar)
 * is derived here so the React component stays a dumb renderer.
 *
 * No React, no stores, no browser APIs — plain data in, plain data out.
 */

/** Fallback booking capacity used to scale a day's load bar. */
export const DEFAULT_DAY_CAPACITY = 18;

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 86_400_000;
/** En dash — the range separator the design uses ("6 – 12 Jul"). */
const RANGE_SEPARATOR = ' – ';

/** Which coloured band of the load bar an appointment falls into. */
export type PhoneWeekSegmentKind =
  'completed' | 'inProgress' | 'emergency' | 'upcoming' | 'requested' | 'walkIn';

/** Order matters: this is the left-to-right order of the bands in the bar. */
const SEGMENT_ORDER: PhoneWeekSegmentKind[] = [
  'completed',
  'inProgress',
  'emergency',
  'upcoming',
  'requested',
  'walkIn',
];

/**
 * Design tokens per band. `--danger` / `--danger-border` are not yet declared in
 * globals.css, so the emergency band falls back to the shipped danger tokens.
 */
export const SEGMENT_COLORS: Record<PhoneWeekSegmentKind, string> = {
  completed: 'var(--status-completed-border)',
  inProgress: 'var(--status-in-progress-border)',
  emergency: 'var(--danger, var(--danger-text))',
  upcoming: 'var(--status-upcoming-border)',
  requested: 'var(--status-requested-border)',
  walkIn: 'var(--blue)',
};

/** Per-day context the calendar knows but a list of appointments cannot tell us. */
export type PhoneWeekDayMeta = {
  /** The clinic is shut — the row shows "Closed" and drops its load bar. */
  isClosed?: boolean;
  /** Short editorial clause, e.g. "OR block am" or "Open clinic 09:00–13:00 · walk-ins". */
  note?: string;
  /** Names of vets off that day, e.g. ["Dr. Keller"]. */
  vetsOff?: string[];
  /** The day still has bookable room — adds the "room to book" clause. */
  hasRoomToBook?: boolean;
  /** Walk-in / open-clinic slots held that day; rendered as the blue band. */
  walkInCount?: number;
  /** Booking capacity for this day; overrides `defaultCapacity`. */
  capacity?: number;
};

export type PhoneWeekLoadInput = {
  /** First day of the week (Monday in the design). */
  weekStart: Date;
  /** Every appointment the caller has; days outside the week are ignored. */
  appointments: Appointment[];
  /** Per-day context keyed by local ISO date ("YYYY-MM-DD"). */
  dayMeta?: Record<string, PhoneWeekDayMeta>;
  /** Capacity used for days without their own `capacity`. */
  defaultCapacity?: number;
};

export type PhoneWeekLoadSegment = {
  kind: PhoneWeekSegmentKind;
  count: number;
  /** Share of the whole track, already clamped so the bands never overflow. */
  widthPercent: number;
  color: string;
};

export type PhoneWeekDayTone = 'closed' | 'done' | 'normal';

export type PhoneWeekDayRow = {
  /** Local ISO date, "YYYY-MM-DD". */
  dateKey: string;
  date: Date;
  /** "MON" */
  weekdayLabel: string;
  /** "6" */
  dayOfMonthLabel: string;
  tone: PhoneWeekDayTone;
  /** "14 appts · OR block am" */
  summary: string;
  /** "1 EMERGENCY", or null when nothing needs attention. */
  flag: string | null;
  segments: PhoneWeekLoadSegment[];
  /** Appointments that count as load (cancellations and no-shows excluded). */
  appointmentCount: number;
  showLoadBar: boolean;
};

export type PhoneWeekOverviewData = {
  /** "6 – 12 Jul" */
  rangeLabel: string;
  /** "Week 28" */
  weekLabel: string;
  /** "41 appointments · 3 vets" */
  summaryLabel: string;
  days: PhoneWeekDayRow[];
  totalAppointments: number;
  vetCount: number;
};

/** Local (not UTC) ISO day key, so a day boundary means the user's midnight. */
export const toDateKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

/** The seven dates of the week beginning at `weekStart`. */
export const getWeekDates = (weekStart: Date): Date[] => {
  const base = startOfLocalDay(weekStart);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const day = new Date(base);
    day.setDate(base.getDate() + index);
    return day;
  });
};

/**
 * ISO-8601 week number: weeks start Monday and week 1 is the one holding the
 * first Thursday of the year.
 */
export const getIsoWeekNumber = (date: Date): number => {
  const target = startOfLocalDay(date);
  // Shift to the Thursday of this ISO week (Sunday counts as day 7).
  const isoDayOfWeek = target.getDay() === 0 ? DAYS_IN_WEEK : target.getDay();
  target.setDate(target.getDate() + 4 - isoDayOfWeek);
  const firstOfYear = new Date(target.getFullYear(), 0, 1);
  const dayDelta = Math.round((target.getTime() - firstOfYear.getTime()) / MS_PER_DAY);
  return Math.floor(dayDelta / DAYS_IN_WEEK) + 1;
};

/** "6 – 12 Jul", or "29 Jun – 5 Jul" when the week straddles two months. */
export const formatWeekRange = (weekStart: Date, weekEnd: Date): string => {
  const endLabel = `${weekEnd.getDate()} ${MONTH_LABELS[weekEnd.getMonth()]}`;
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();
  const startLabel = sameMonth
    ? String(weekStart.getDate())
    : `${weekStart.getDate()} ${MONTH_LABELS[weekStart.getMonth()]}`;
  return `${startLabel}${RANGE_SEPARATOR}${endLabel}`;
};

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

/** Cancellations and no-shows are not load — they never reach the bar or the count. */
const isLoadBearing = (appointment: Appointment): boolean =>
  appointment.status !== 'CANCELLED' && appointment.status !== 'NO_SHOW';

/** An emergency only stays red while it is still open; once done it counts as done. */
const isOpenEmergency = (appointment: Appointment): boolean =>
  Boolean(appointment.isEmergency) && appointment.status !== 'COMPLETED';

const segmentKindFor = (appointment: Appointment): PhoneWeekSegmentKind => {
  if (isOpenEmergency(appointment)) return 'emergency';
  if (appointment.status === 'COMPLETED') return 'completed';
  if (appointment.status === 'CHECKED_IN' || appointment.status === 'IN_PROGRESS') {
    return 'inProgress';
  }
  if (appointment.status === 'REQUESTED') return 'requested';
  return 'upcoming';
};

/** One decimal is plenty for a 10px bar and keeps float noise out of snapshots. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

const countsByKind = (
  appointments: Appointment[],
  walkInCount: number
): Record<PhoneWeekSegmentKind, number> => {
  const counts: Record<PhoneWeekSegmentKind, number> = {
    completed: 0,
    inProgress: 0,
    emergency: 0,
    upcoming: 0,
    requested: 0,
    walkIn: walkInCount,
  };
  appointments.forEach((appointment) => {
    counts[segmentKindFor(appointment)] += 1;
  });
  return counts;
};

/**
 * Turn per-band counts into bar widths. Each band is `count / capacity` of the
 * track; the remainder stays as the `--inset` groove ("Free"). An overbooked day
 * would exceed 100%, so the bands are scaled down proportionally to exactly fill
 * the track instead of spilling out of it.
 */
const buildSegments = (
  counts: Record<PhoneWeekSegmentKind, number>,
  capacity: number
): PhoneWeekLoadSegment[] => {
  if (capacity <= 0) return [];

  const filled = SEGMENT_ORDER.reduce((total, kind) => total + counts[kind], 0);
  const scale = filled > capacity ? capacity / filled : 1;

  return SEGMENT_ORDER.filter((kind) => counts[kind] > 0).map((kind) => ({
    kind,
    count: counts[kind],
    widthPercent: round1((counts[kind] * scale * 100) / capacity),
    color: SEGMENT_COLORS[kind],
  }));
};

const buildVetsOffClause = (vetsOff: string[]): string | null => {
  if (vetsOff.length === 0) return null;
  if (vetsOff.length === 1) return `${vetsOff[0]} off`;
  return `${vetsOff.length} vets off`;
};

/**
 * The row's sentence. A day that is fully behind us gets the unhurried long form
 * ("8 appointments · all done"); a day still in play uses the compact "appts" and
 * spends the saved room on what needs a decision.
 */
const buildSummary = (
  appointmentCount: number,
  counts: Record<PhoneWeekSegmentKind, number>,
  meta: PhoneWeekDayMeta
): string => {
  // A blank note is no note — `??` alone would let an empty string through.
  const note = meta.note?.trim() || undefined;

  if (appointmentCount === 0) return note ?? 'No appointments';
  if (counts.completed === appointmentCount) {
    return `${pluralize(appointmentCount, 'appointment', 'appointments')} · all done`;
  }

  const clauses: string[] = [];
  if (note) {
    clauses.push(note);
  } else if (counts.requested > 0) {
    clauses.push(`${pluralize(counts.requested, 'request', 'requests')} to approve`);
  }

  const vetsOffClause = buildVetsOffClause(meta.vetsOff ?? []);
  if (vetsOffClause) clauses.push(vetsOffClause);
  if (meta.hasRoomToBook) clauses.push('room to book');

  return [`${appointmentCount} appts`, ...clauses].join(' · ');
};

const buildFlag = (emergencyCount: number): string | null => {
  if (emergencyCount === 0) return null;
  return `${emergencyCount} ${emergencyCount === 1 ? 'EMERGENCY' : 'EMERGENCIES'}`;
};

const buildDayRow = (
  date: Date,
  appointments: Appointment[],
  meta: PhoneWeekDayMeta,
  defaultCapacity: number
): PhoneWeekDayRow => {
  const dateKey = toDateKey(date);
  const weekdayLabel = WEEKDAY_LABELS[date.getDay()];
  const dayOfMonthLabel = String(date.getDate());

  if (meta.isClosed) {
    return {
      dateKey,
      date,
      weekdayLabel,
      dayOfMonthLabel,
      tone: 'closed',
      summary: 'Closed',
      flag: null,
      segments: [],
      appointmentCount: 0,
      showLoadBar: false,
    };
  }

  const load = appointments.filter(isLoadBearing);
  const counts = countsByKind(load, meta.walkInCount ?? 0);
  const capacity = meta.capacity ?? defaultCapacity;
  const appointmentCount = load.length;
  const allDone = appointmentCount > 0 && counts.completed === appointmentCount;

  return {
    dateKey,
    date,
    weekdayLabel,
    dayOfMonthLabel,
    tone: allDone ? 'done' : 'normal',
    summary: buildSummary(appointmentCount, counts, meta),
    flag: buildFlag(counts.emergency),
    segments: buildSegments(counts, capacity),
    appointmentCount,
    showLoadBar: true,
  };
};

/**
 * Build everything the phone week overview renders: the header labels and one
 * load row per weekday.
 */
export const buildPhoneWeekOverview = ({
  weekStart,
  appointments,
  dayMeta = {},
  defaultCapacity = DEFAULT_DAY_CAPACITY,
}: PhoneWeekLoadInput): PhoneWeekOverviewData => {
  const dates = getWeekDates(weekStart);

  // Seven days against one week of appointments — a scan per day is cheaper to
  // read than a lookup table, and appointments outside the week simply match no day.
  const groups = dates.map((date) => {
    const dateKey = toDateKey(date);
    return {
      date,
      meta: dayMeta[dateKey] ?? {},
      appointments: appointments.filter(
        (appointment) => toDateKey(new Date(appointment.appointmentDate)) === dateKey
      ),
    };
  });

  const days = groups.map((group) =>
    buildDayRow(group.date, group.appointments, group.meta, defaultCapacity)
  );

  const totalAppointments = days.reduce((total, day) => total + day.appointmentCount, 0);

  const vetIds = new Set<string>();
  groups.forEach((group) => {
    if (group.meta.isClosed) return;
    group.appointments.filter(isLoadBearing).forEach((appointment) => {
      if (appointment.lead?.id) vetIds.add(appointment.lead.id);
    });
  });

  return {
    rangeLabel: formatWeekRange(dates[0], dates[DAYS_IN_WEEK - 1]),
    weekLabel: `Week ${getIsoWeekNumber(dates[0])}`,
    summaryLabel: `${pluralize(totalAppointments, 'appointment', 'appointments')} · ${pluralize(
      vetIds.size,
      'vet',
      'vets'
    )}`,
    days,
    totalAppointments,
    vetCount: vetIds.size,
  };
};
