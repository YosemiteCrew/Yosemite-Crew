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

/**
 * Units that mark a dotted number as a measured dose, not a clock reading.
 *
 * "0.25 ml" and "1.25 mg" are among the commonest things an owner says here,
 * and in this domain a dot is a decimal point far more often than it is a
 * clock separator. The fraction only has to land in 00-59 to read as valid
 * minutes, which .25, .30 and .50 all do - so the dose became the hour and
 * "give Max 0.25 ml tomorrow" scheduled the reminder for twenty-five past
 * midnight instead of the 09:00 default. That is the mis-scheduled dose this
 * module's header exists to prevent.
 *
 * The guard is not limited to the dot form, because a colon reading followed
 * by a unit ("8:30 ml") is not something anyone says - narrowing it would add
 * a branch no utterance can tell apart.
 */
const DOSE_UNITS: ReadonlySet<string> = new Set([
  'ml',
  'mls',
  'l',
  'mg',
  'mcg',
  'ug',
  'g',
  'kg',
  'cc',
  'iu',
  'unit',
  'units',
  'tab',
  'tabs',
  'tablet',
  'tablets',
  'cap',
  'caps',
  'capsule',
  'capsules',
  'drop',
  'drops',
  'pill',
  'pills',
  'sachet',
  'sachets',
  'scoop',
  'scoops',
  'puff',
  'puffs',
  'spray',
  'sprays',
]);

/** The next whole word, already lower-cased by `normalizeKeepingClock`. */
const NEXT_WORD = /^\s*([a-z]+)/;

/**
 * Whether what follows a clock candidate names a unit of measurement.
 *
 * Matching the whole word rather than a prefix is what keeps a real time from
 * being thrown away: in "at 20.30 go out" the next word is "go", not the unit
 * "g".
 */
const followedByDoseUnit = (rest: string): boolean => {
  const next = NEXT_WORD.exec(rest);
  return next !== null && DOSE_UNITS.has(next[1]);
};

/**
 * Words that name a dilution, whose "1:10" is a ratio and not a clock time.
 *
 * A colon was left carrying the 24-hour rule on the grounds that it brings its
 * own evidence, because nobody writes a dose or a price with one. A dilution
 * is the case where somebody does: "dilute 1:10 and bathe him tomorrow"
 * scheduled the reminder for 01:10 instead of the 09:00 default, which is the
 * mis-scheduled medication this module's header exists to prevent.
 *
 * The ratio has no unit after it for `followedByDoseUnit` to catch and no
 * shape of its own - 1:10, 1:20 and 1:50 are all valid times - so the word
 * that introduces it is the only evidence there is. Both shipped languages are
 * listed, as everywhere else in this module; accents are already folded by
 * `normalizeKeepingClock`, so "dilucion" is the form that arrives here.
 */
const RATIO_WORDS: ReadonlySet<string> = new Set([
  'dilute',
  'diluted',
  'diluting',
  'dilution',
  'dilutions',
  'mix',
  'mixed',
  'mixing',
  'ratio',
  'ratios',
  // Spanish.
  'diluir',
  'diluye',
  'diluido',
  'dilucion',
  'mezcla',
  'mezclar',
  'proporcion',
]);

/**
 * How far back a dilution word is taken as introducing the number.
 *
 * Three words is what the reported utterances need - "dilute the shampoo 1:20"
 * puts a determiner and a noun between the two - and deliberately no more.
 * Unbounded, the word would disqualify every later candidate in the sentence
 * as well, and "dilute 1:10 then walk him at 20:30" would lose the 20:30 that
 * the all-candidates scan exists to find.
 */
const RATIO_WORD_WINDOW = 3;

/**
 * Whether one of the last few words before a clock candidate names a dilution.
 *
 * Counting words rather than characters is what keeps an ordinary time safe:
 * in "mix his food at 18:30" the dilution word is four words back, too far to
 * be introducing the number, and the time is read as said.
 */
const precededByRatioWord = (before: string): boolean => {
  const words = before.match(/[a-z]+/g);
  return (
    words !== null &&
    words.slice(-RATIO_WORD_WINDOW).some(word => RATIO_WORDS.has(word))
  );
};

/**
 * "20:30" - a bare 24-hour reading. The separator must be a colon.
 *
 * A dot was accepted here and cannot be. In this domain a dot is a decimal
 * point far more often than a clock separator, and the fraction only has to
 * land in 00-59 to pass as minutes - .25, .30 and .50 all do - so a quantity
 * read as the hour and the dose was scheduled for just after midnight.
 *
 * Four discriminators were tried against real utterances and every one was
 * refuted, which is why none of them is here:
 *
 *   a preposition introduces it        "spent around 12.50", "reduce it by 0.50"
 *   only one a quantity cannot follow  "set his dose at 0.50 of a tablet"
 *   a day or day-part word is evidence "remind me tomorrow 0.50 of the pill"
 *   an hour only a clock would use     "keep the infusion rate at 16.50"
 *
 * Every word that can introduce a time can introduce an amount, and a dose or
 * an infusion rate takes any magnitude, so neither the neighbours nor the
 * number's own shape decides it. Reading no time is the safe failure: the
 * owner sees the 09:00 default in a prefilled form and corrects it in one tap,
 * whereas a dose at the wrong hour is the mis-scheduled medication this
 * module's header exists to prevent.
 *
 * The dotted forms that carry their own evidence are unaffected. "8.30 pm"
 * goes through `parseMeridiemTime`, which runs first and accepts `[:.]`, and
 * "20:30" is one keystroke away. No dose is written either way.
 *
 * Every candidate is read rather than only the first, so a colon reading
 * skipped as a quantity does not hide a time said after it.
 */
const parse24HourTime = (normalized: string): ClockTime | null => {
  for (const match of normalized.matchAll(/\b(\d{1,2})\s*:\s*(\d{2})\b/g)) {
    const [whole, rawHour, rawMinute] = match;
    if (
      followedByDoseUnit(normalized.slice(match.index + whole.length)) ||
      precededByRatioWord(normalized.slice(0, match.index))
    ) {
      continue;
    }
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    if (hour < 24 && minute < 60) {
      return {hour, minute};
    }
  }
  return null;
};

/**
 * "at 7" - a bare hour, and only after "at".
 *
 * The preposition is what keeps "give 2 tablets" from becoming 2 o'clock.
 *
 * A decimal is refused whole rather than read down to its integer part. With
 * no dotted clock rule left, "at 0.50" arrives here directly, and reading it
 * as "at 0" is the midnight mis-scheduled dose in its own right. A trailing
 * sentence stop is not a decimal, so the lookahead needs the digit after it.
 *
 * The lookahead is deliberately loose about what sits between the two numbers,
 * because every tightening of it has been a hole:
 *
 *   at 0.50   an adjacent dot
 *   at 0 . 50 spaced, which is how a typed "0 . 50" survives normalising
 *   at 0,50   a comma, which normalising turns into a space, leaving "at 0 50"
 *   at 16:50  a rate the colon rule already declined as "16:50 ml"
 *
 * The comma is handled by the space it becomes, not by a comma in the class.
 * `normalizeKeepingClock` keeps only `[a-z0-9:.]`, so no comma ever reaches
 * here - a class member for one would be unreachable, and removing it from
 * the class changes no reading.
 *
 * The last one is the reason a colon is in the class. `parse24HourTime` runs
 * first, so a real "at 8:30" never reaches here; the only colon readings that
 * do are the ones it refused, and re-reading their hour is exactly the
 * mis-scheduled dose it refused to make. A separator is optional and a
 * trailing sentence stop is not a decimal, so what the lookahead really
 * requires is the second number.
 *
 * The separator carries the whitespace that follows it, rather than the
 * spelling `\s*[.:]?\s*` the list above reads like. Both accept exactly the
 * same strings, but with the separator optional on its own the two `\s*` can
 * divide a run of spaces between them in every possible way, so a long run
 * before a non-digit costs quadratic time to refuse. Grouping the separator
 * with its trailing space leaves one `\s*` to match a run with no separator
 * and removes the choice.
 */
const parseBareHourAfterAt = (normalized: string): ClockTime | null => {
  const match = /\bat\s+(\d{1,2})\b(?!\s*(?:[.:]\s*)?\d)/.exec(normalized);
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
 * The hour of a clock time said without am/pm, read against the day part.
 *
 * "at 8 tonight" and "9:30 in the evening" name no meridiem, so the clock
 * alone gave 08:00 and 09:30 and the dose landed in the morning. An
 * afternoon, evening or night day part moves a 1-11 hour past noon; a morning
 * day part, a 24-hour reading and an explicit am or pm are kept as said.
 */
const hourWithDayPartMeridiem = (
  text: string,
  hour: number,
  dayPartHour: number | null,
): number => {
  const saysMeridiem = parseMeridiemTime(normalizeKeepingClock(text)) !== null;
  const afterNoon = dayPartHour !== null && dayPartHour > 12;
  return !saysMeridiem && afterNoon && hour >= 1 && hour < 12
    ? hour + 12
    : hour;
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

/**
 * "today", "tomorrow", "esta noche".
 *
 * A day part whose time has already passed falls through rather than
 * resolving: "tonight" asked at 23:00 would otherwise schedule 21:00 today,
 * two hours in the past.
 *
 * That roll-forward is deliberately narrow. When the owner names a day and
 * nothing else ("today"), or names both a day and a time ("today at 8am"),
 * their words win even if the moment has passed - a handoff opens a prefilled
 * form where the date is visible and editable. Only an implied hour, taken
 * from a day part, is moved.
 */
const resolveRelativeDay = (
  normalized: string,
  now: Date,
  dayPartHour: number | null,
  hour: number,
  minute: number,
  hasExplicitClock: boolean,
): string | null => {
  for (const [word, offset] of Object.entries(RELATIVE_DAYS)) {
    // "esta" only means today when it qualifies a part of the day
    // ("esta noche"); on its own it is just a determiner.
    if (word === 'esta' && dayPartHour === null) {
      continue;
    }
    if (new RegExp(String.raw`\b${word}\b`).test(normalized)) {
      const target = atTime(addDays(now, offset), hour, minute);
      const impliedHourAlreadyPast =
        offset === 0 &&
        target <= now &&
        dayPartHour !== null &&
        !hasExplicitClock;
      return impliedHourAlreadyPast ? null : target.toISOString();
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
  const hour = clock
    ? hourWithDayPartMeridiem(text, clock.hour, dayPartHour)
    : (dayPartHour ?? DEFAULT_HOUR);
  const minute = clock?.minute ?? 0;

  const dated =
    resolveInDays(normalized, now, hour, minute) ??
    resolveInHours(normalized, now) ??
    resolveRelativeDay(
      normalized,
      now,
      dayPartHour,
      hour,
      minute,
      clock !== null,
    ) ??
    resolveWeekday(normalized, now, hour, minute);
  if (dated) {
    return dated;
  }

  if (clock) {
    return resolveNextOccurrence(now, hour, clock.minute);
  }
  if (dayPartHour !== null) {
    return resolveNextOccurrence(now, dayPartHour, 0);
  }
  return null;
};
