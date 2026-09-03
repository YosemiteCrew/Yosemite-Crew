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
  const result = new Date(base.getTime());
  result.setHours(hour, minute, 0, 0);
  return result;
};

const addDays = (base: Date, days: number): Date => {
  const result = new Date(base.getTime());
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
export const parseClockTime = (text: string): ClockTime | null => {
  const normalized = normalizeKeepingClock(text);

  const meridiem = /(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(am|pm)\b/.exec(
    normalized,
  );
  if (meridiem) {
    const rawHour = Number(meridiem[1]);
    if (rawHour >= 1 && rawHour <= 12) {
      const minute = meridiem[2] ? Number(meridiem[2]) : 0;
      if (minute < 60) {
        const isPm = meridiem[3] === 'pm';
        const hour = (rawHour % 12) + (isPm ? 12 : 0);
        return {hour, minute};
      }
    }
  }

  const twentyFour = /\b(\d{1,2})\s*[:.]\s*(\d{2})\b/.exec(normalized);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour < 24 && minute < 60) {
      return {hour, minute};
    }
  }

  const bareAfterAt = /\bat\s+(\d{1,2})\b/.exec(normalized);
  if (bareAfterAt) {
    const hour = Number(bareAfterAt[1]);
    if (hour < 24) {
      return {hour, minute: 0};
    }
  }

  return null;
};

/** Finds a named part of the day, e.g. "tonight" or "in the morning". */
const parseDayPart = (normalized: string): number | null => {
  for (const [word, hour] of Object.entries(DAY_PART_HOURS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) {
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
export const parseWhen = (text: string, now: Date): string | null => {
  const normalized = normalizeText(text);
  if (normalized.length === 0) {
    return null;
  }

  const clock = parseClockTime(text);
  const dayPartHour = parseDayPart(normalized);

  const inDays = /\bin\s+(\d{1,3})\s+(day|days|dias|dia)\b/.exec(normalized);
  if (inDays) {
    const base = addDays(now, Number(inDays[1]));
    return atTime(
      base,
      clock?.hour ?? dayPartHour ?? DEFAULT_HOUR,
      clock?.minute ?? 0,
    ).toISOString();
  }

  const inWeeks = /\bin\s+(\d{1,2})\s+(week|weeks|semana|semanas)\b/.exec(
    normalized,
  );
  if (inWeeks) {
    const base = addDays(now, Number(inWeeks[1]) * 7);
    return atTime(
      base,
      clock?.hour ?? dayPartHour ?? DEFAULT_HOUR,
      clock?.minute ?? 0,
    ).toISOString();
  }

  const inHours = /\bin\s+(\d{1,3})\s+(hour|hours|hora|horas)\b/.exec(
    normalized,
  );
  if (inHours) {
    const result = new Date(now.getTime());
    result.setHours(result.getHours() + Number(inHours[1]), 0, 0, 0);
    return result.toISOString();
  }

  for (const [word, offset] of Object.entries(RELATIVE_DAYS)) {
    // "esta" only means today when it qualifies a part of the day
    // ("esta noche"); on its own it is just a determiner.
    if (word === 'esta' && dayPartHour === null) {
      continue;
    }
    if (new RegExp(`\\b${word}\\b`).test(normalized)) {
      const base = addDays(now, offset);
      return atTime(
        base,
        clock?.hour ?? dayPartHour ?? DEFAULT_HOUR,
        clock?.minute ?? 0,
      ).toISOString();
    }
  }

  for (const [word, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) {
      const current = now.getDay();
      // Always look forward: "on Monday" said on a Monday means next Monday.
      const delta = (weekday - current + 7) % 7 || 7;
      const base = addDays(now, delta);
      return atTime(
        base,
        clock?.hour ?? dayPartHour ?? DEFAULT_HOUR,
        clock?.minute ?? 0,
      ).toISOString();
    }
  }

  // A time with no day means the next occurrence of that time.
  if (clock) {
    const todayAt = atTime(now, clock.hour, clock.minute);
    const target =
      todayAt.getTime() > now.getTime() ? todayAt : addDays(todayAt, 1);
    return target.toISOString();
  }

  if (dayPartHour !== null) {
    const todayAt = atTime(now, dayPartHour, 0);
    const target =
      todayAt.getTime() > now.getTime() ? todayAt : addDays(todayAt, 1);
    return target.toISOString();
  }

  return null;
};
