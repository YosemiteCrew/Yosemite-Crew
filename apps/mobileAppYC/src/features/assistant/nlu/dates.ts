/**
 * Natural date phrases to ISO timestamps.
 *
 * Deliberately small and deterministic. The assistant only needs the phrases
 * people actually use for pet care ("tonight", "tomorrow morning", "in 3
 * days", "on Friday"), and a wrong guess here would silently schedule a dose
 * at the wrong time, so anything unrecognised returns null rather than a
 * best effort.
 */
import {normalizeText} from './normalize';

/**
 * Lower-cases and folds accents but KEEPS `:` and `.`, which carry the minutes.
 *
 * `normalizeText` collapses every non-alphanumeric run to a space. Running it
 * before the clock regexes destroyed the separator they need, so "8:30 pm"
 * parsed as null and "at 8:30 pm" fell through to the bare-hour rule and
 * resolved to eight the NEXT morning - exactly the mis-scheduled dose this
 * module's header warns about.
 */
const normalizeKeepingClock = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9:.]+/g, ' ')
    .trim();

/** Hour-of-day each named part of the day resolves to. */
const DAY_PART_HOURS: Record<string, number> = {
  morning: 8,
  afternoon: 14,
  evening: 19,
  night: 21,
  tonight: 21,
  noon: 12,
  midnight: 0,
  // Spanish. `manana` is deliberately absent: alone it means tomorrow, which
  // RELATIVE_DAYS already covers, and treating it as "morning" would turn
  // "manana" into today at 08:00.
  noche: 21,
  tarde: 14,
  mediodia: 12,
  madrugada: 6,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

/** Words that shift the day relative to today, in either shipped language. */
const RELATIVE_DAYS: Record<string, number> = {
  today: 0,
  tonight: 0,
  hoy: 0,
  esta: 0,
  tomorrow: 1,
  manana: 1,
  overmorrow: 2,
};

const DEFAULT_HOUR = 9;

const atTime = (base: Date, hour: number, minute: number): Date => {
  const result = new Date(base);
  result.setHours(hour, minute, 0, 0);
  return result;
};

const addDays = (base: Date, days: number): Date => {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
};

interface ClockTime {
  hour: number;
  minute: number;
}

/**
 * Reads an explicit clock time: "8pm", "8:30 pm", "20:30", "at 7".
 *
 * A bare number is only treated as a time when preceded by "at", so "give 2
 * tablets" does not become 2 o'clock.
 */
/** "8pm", "8:30 pm" - an hour of 1-12 qualified by am/pm. */
const parseMeridiemTime = (normalized: string): ClockTime | null => {
  const match = /(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(am|pm)\b/.exec(normalized);
  if (!match) {
    return null;
  }
  const rawHour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (rawHour < 1 || rawHour > 12 || minute >= 60) {
    return null;
  }
  return {hour: (rawHour % 12) + (match[3] === 'pm' ? 12 : 0), minute};
};

/** "20:30" - a bare 24-hour reading. */
const parse24HourTime = (normalized: string): ClockTime | null => {
  const match = /\b(\d{1,2})\s*[:.]\s*(\d{2})\b/.exec(normalized);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? {hour, minute} : null;
};

/**
 * "at 7" - a bare hour, and only after "at".
 *
 * The preposition is what keeps "give 2 tablets" from becoming 2 o'clock.
 */
const parseBareHourAfterAt = (normalized: string): ClockTime | null => {
  const match = /\bat\s+(\d{1,2})\b/.exec(normalized);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  return hour < 24 ? {hour, minute: 0} : null;
};

/**
 * Reads an explicit clock time: "8pm", "8:30 pm", "20:30", "at 7".
 *
 * The readings are tried most specific first, so "13:30 pm" - whose hour is
 * out of range for a meridiem - still resolves through the 24-hour rule.
 */
export const parseClockTime = (text: string): ClockTime | null => {
  const normalized = normalizeKeepingClock(text);
  return (
    parseMeridiemTime(normalized) ??
    parse24HourTime(normalized) ??
    parseBareHourAfterAt(normalized)
  );
};

/** Finds a named part of the day, e.g. "tonight" or "in the morning". */
const parseDayPart = (normalized: string): number | null => {
  for (const [word, hour] of Object.entries(DAY_PART_HOURS)) {
    if (new RegExp(String.raw`\b${word}\b`).test(normalized)) {
      return hour;
    }
  }
  return null;
};

/**
 * Resolves a date phrase against `now`.
 *
 * Returns null when the text carries no date information at all, so callers
 * can tell "no date mentioned" apart from "date mentioned but unparseable".
 */
/** Units accepted by an "in N ..." phrase, with the days each one contributes. */
const RELATIVE_UNITS: ReadonlyArray<{pattern: RegExp; days: number}> = [
  {pattern: /\bin\s+(\d{1,3})\s+(?:day|days|dias|dia)\b/, days: 1},
  {pattern: /\bin\s+(\d{1,2})\s+(?:week|weeks|semana|semanas)\b/, days: 7},
];

/** "in 3 days", "in 2 weeks". */
const resolveInDays = (
  normalized: string,
  now: Date,
  hour: number,
  minute: number,
): string | null => {
  for (const unit of RELATIVE_UNITS) {
    const match = unit.pattern.exec(normalized);
    if (match) {
      return atTime(
        addDays(now, Number(match[1]) * unit.days),
        hour,
        minute,
      ).toISOString();
    }
  }
  return null;
};

/** "in 5 hours". Deliberately ignores any stated clock time or day part. */
const resolveInHours = (normalized: string, now: Date): string | null => {
  const match = /\bin\s+(\d{1,3})\s+(?:hour|hours|hora|horas)\b/.exec(
    normalized,
  );
  if (!match) {
    return null;
  }
  const result = new Date(now);
  result.setHours(result.getHours() + Number(match[1]), 0, 0, 0);
  return result.toISOString();
};

/** "today", "tomorrow", "esta noche". */
const resolveRelativeDay = (
  normalized: string,
  now: Date,
  dayPartHour: number | null,
  hour: number,
  minute: number,
): string | null => {
  for (const [word, offset] of Object.entries(RELATIVE_DAYS)) {
    // "esta" only means today when it qualifies a part of the day
    // ("esta noche"); on its own it is just a determiner.
    if (word === 'esta' && dayPartHour === null) {
      continue;
    }
    if (new RegExp(String.raw`\b${word}\b`).test(normalized)) {
      return atTime(addDays(now, offset), hour, minute).toISOString();
    }
  }
  return null;
};

/** "on Friday". Always looks forward, so the same weekday means next week. */
const resolveWeekday = (
  normalized: string,
  now: Date,
  hour: number,
  minute: number,
): string | null => {
  for (const [word, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(String.raw`\b${word}\b`).test(normalized)) {
      const delta = (weekday - now.getDay() + 7) % 7 || 7;
      return atTime(addDays(now, delta), hour, minute).toISOString();
    }
  }
  return null;
};

/** A time with no day means the next occurrence of that time. */
const resolveNextOccurrence = (
  now: Date,
  hour: number,
  minute: number,
): string => {
  const todayAt = atTime(now, hour, minute);
  const target = todayAt > now ? todayAt : addDays(todayAt, 1);
  return target.toISOString();
};

/**
 * Resolves a date phrase against `now`.
 *
 * Returns null when the text carries no date information at all, so callers
 * can tell "no date mentioned" apart from "date mentioned but unparseable".
 */
export const parseWhen = (text: string, now: Date): string | null => {
  const normalized = normalizeText(text);
  if (normalized.length === 0) {
    return null;
  }

  const clock = parseClockTime(text);
  const dayPartHour = parseDayPart(normalized);
  const hour = clock?.hour ?? dayPartHour ?? DEFAULT_HOUR;
  const minute = clock?.minute ?? 0;

  const dated =
    resolveInDays(normalized, now, hour, minute) ??
    resolveInHours(normalized, now) ??
    resolveRelativeDay(normalized, now, dayPartHour, hour, minute) ??
    resolveWeekday(normalized, now, hour, minute);
  if (dated) {
    return dated;
  }

  if (clock) {
    return resolveNextOccurrence(now, clock.hour, clock.minute);
  }
  if (dayPartHour !== null) {
    return resolveNextOccurrence(now, dayPartHour, 0);
  }
  return null;
};
