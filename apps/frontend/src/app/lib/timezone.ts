import countries from '@/app/lib/data/countryList';

const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';
const TIMEZONE_MANUAL_OVERRIDE_BY_ORG_KEY = 'yc_timezone_manual_override_by_org';
const TIMEZONE_SYNC_MODE_BY_ORG_KEY = 'yc_timezone_sync_mode_by_org';
const DEFAULT_TIMEZONE = 'Europe/Berlin';
const DEFAULT_TIMEZONE_SYNC_MODE = 'device';

export type TimezoneSyncMode = 'device' | 'custom';

export type TimezoneOption = {
  label: string;
  value: string;
};

const FALLBACK_TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: 'Germany (Europe/Berlin)', value: 'Europe/Berlin' },
  { label: 'IST (Asia/Kolkata)', value: 'Asia/Kolkata' },
  { label: 'UTC', value: 'UTC' },
  { label: 'US Eastern (America/New_York)', value: 'America/New_York' },
  { label: 'US Central (America/Chicago)', value: 'America/Chicago' },
  { label: 'US Mountain (America/Denver)', value: 'America/Denver' },
  { label: 'US Pacific (America/Los_Angeles)', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Europe/Madrid', value: 'Europe/Madrid' },
  { label: 'Europe/Rome', value: 'Europe/Rome' },
  { label: 'Europe/Amsterdam', value: 'Europe/Amsterdam' },
  { label: 'Europe/Dublin', value: 'Europe/Dublin' },
  { label: 'Asia/Dubai', value: 'Asia/Dubai' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Asia/Hong_Kong', value: 'Asia/Hong_Kong' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' },
  { label: 'Pacific/Auckland', value: 'Pacific/Auckland' },
];

const COUNTRY_CODE_TO_TIMEZONE: Record<string, string> = {
  IN: 'Asia/Kolkata',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  IE: 'Europe/Dublin',
  GB: 'Europe/London',
  UK: 'Europe/London',
  US: 'America/New_York',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  SG: 'Asia/Singapore',
  AE: 'Asia/Dubai',
  JP: 'Asia/Tokyo',
  CN: 'Asia/Shanghai',
  KR: 'Asia/Seoul',
  SA: 'Asia/Riyadh',
  ZA: 'Africa/Johannesburg',
  BR: 'America/Sao_Paulo',
  MX: 'America/Mexico_City',
  AR: 'America/Argentina/Buenos_Aires',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  BE: 'Europe/Brussels',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',
  CZ: 'Europe/Prague',
  HU: 'Europe/Budapest',
  RO: 'Europe/Bucharest',
  GR: 'Europe/Athens',
  TR: 'Europe/Istanbul',
};

const hasWindow = () => typeof window !== 'undefined';

const parseManualOverrideMap = (): Record<string, boolean> => {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(TIMEZONE_MANUAL_OVERRIDE_BY_ORG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, Boolean(value)]));
  } catch {
    return {};
  }
};

const parseSyncModeMap = (): Record<string, TimezoneSyncMode> => {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(TIMEZONE_SYNC_MODE_BY_ORG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .map(([key, value]) => [key, String(value).trim().toLowerCase()] as const)
      .filter(([, value]) => value === 'device' || value === 'custom')
      .map(([key, value]) => [key, value as TimezoneSyncMode] as const);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const writeSyncModeMap = (value: Record<string, TimezoneSyncMode>): boolean => {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(TIMEZONE_SYNC_MODE_BY_ORG_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const getCanonicalTimezoneValues = (): string[] => {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (!supportedValuesOf) {
    return FALLBACK_TIMEZONE_OPTIONS.map((option) => option.value);
  }
  try {
    const zones = supportedValuesOf('timeZone');
    const preferred = [
      'Europe/Berlin',
      'Asia/Kolkata',
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Asia/Dubai',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Australia/Sydney',
    ];
    return Array.from(new Set([...preferred, ...zones]));
  } catch {
    return FALLBACK_TIMEZONE_OPTIONS.map((option) => option.value);
  }
};

export const isValidTimeZone = (value?: string | null): value is string => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const parseTimezoneFromProfileValue = (timezone?: string | null): string => {
  if (!timezone) return DEFAULT_TIMEZONE;
  const timezoneValue = String(timezone);
  const isValidTimezone = (value?: string | null): boolean => isValidTimeZone(value);
  if (isValidTimezone(timezoneValue)) return timezoneValue;
  const segment = timezoneValue.split(' - ').at(-1)?.trim();
  if (segment && isValidTimezone(segment)) return segment;
  return DEFAULT_TIMEZONE;
};

export const getSystemTimeZone = (): string => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimeZone(tz)) return tz;
  } catch {
    // no-op
  }
  return DEFAULT_TIMEZONE;
};

export const getTimezoneSyncModeForOrg = (orgId?: string | null): TimezoneSyncMode => {
  const normalizedOrgId = String(orgId ?? '').trim();
  if (!normalizedOrgId) return DEFAULT_TIMEZONE_SYNC_MODE;
  const modeMap = parseSyncModeMap();
  const mode = modeMap[normalizedOrgId];
  if (mode === 'device' || mode === 'custom') return mode;

  // Migration path from legacy manual override flag.
  const manualOverrideMap = parseManualOverrideMap();
  if (manualOverrideMap[normalizedOrgId]) return 'custom';
  return DEFAULT_TIMEZONE_SYNC_MODE;
};

export const setTimezoneSyncModeForOrg = (
  orgId: string | undefined,
  mode: TimezoneSyncMode
): boolean => {
  const normalizedOrgId = String(orgId ?? '').trim();
  if (!normalizedOrgId || (mode !== 'device' && mode !== 'custom')) return false;
  const map = parseSyncModeMap();
  map[normalizedOrgId] = mode;
  return writeSyncModeMap(map);
};

export const getPreferredTimeZone = (): string => {
  if (!hasWindow()) return DEFAULT_TIMEZONE;
  try {
    const savedToken = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (!savedToken) return DEFAULT_TIMEZONE;
    const token = Number.parseInt(savedToken, 10);
    if (!Number.isInteger(token)) return DEFAULT_TIMEZONE;
    const values = getCanonicalTimezoneValues();
    const resolved = values[token];
    if (isValidTimeZone(resolved)) return resolved;
  } catch {
    // no-op
  }
  return DEFAULT_TIMEZONE;
};

export const setPreferredTimeZone = (timeZone: string): boolean => {
  if (!isValidTimeZone(timeZone) || !hasWindow()) return false;
  try {
    const values = getCanonicalTimezoneValues();
    const token = values.findIndex((value) => value === timeZone);
    if (token < 0) return false;
    // Persist canonical token instead of raw value to avoid clear-text timezone storage.
    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, String(token));
    window.dispatchEvent(
      new CustomEvent('yc:timezone-changed', {
        detail: { timeZone },
      })
    );
    return true;
  } catch {
    return false;
  }
};

const getGmtOffsetLabel = (timeZone: string): string => {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'shortOffset',
    });
    const parts = dtf.formatToParts(new Date());
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    return raw.replace('GMT', 'UTC');
  } catch {
    return 'UTC';
  }
};

const buildLabel = (timeZone: string): string => {
  if (timeZone === 'Asia/Kolkata') {
    return `IST (${getGmtOffsetLabel(timeZone)}) - ${timeZone}`;
  }
  return `${getGmtOffsetLabel(timeZone)} - ${timeZone}`;
};

export const getTimezoneOptions = (): TimezoneOption[] => {
  return getCanonicalTimezoneValues().map((value) => ({
    value,
    label: buildLabel(value),
  }));
};

export const resolveTimezoneFromCountry = (country?: string | null): string | null => {
  if (!country) return null;
  const normalizedCountry = country.trim().toLowerCase();
  if (!normalizedCountry) return null;

  const match = countries.find(
    (item) =>
      String(item?.name ?? '')
        .trim()
        .toLowerCase() === normalizedCountry
  );
  const code = String(match?.code ?? '').toUpperCase();
  if (!code) return null;
  const resolved = COUNTRY_CODE_TO_TIMEZONE[code];
  return resolved && isValidTimeZone(resolved) ? resolved : null;
};

export const formatDateInPreferredTimeZone = (
  value: Date,
  options: Intl.DateTimeFormatOptions
): string => {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: getPreferredTimeZone(),
  }).format(value);
};

export const formatUtcClockTimeLabel = (value: string): string => {
  if (!value) return value;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0, 0));
  return formatDateInPreferredTimeZone(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const utcClockTimeToMinutesInPreferredTimeZone = (value: string): number => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return 0;
  const date = new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: getPreferredTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
};

export type PreferredTimeZoneClock = {
  minutes: number;
  dayOffset: number;
};

export const utcClockTimeToPreferredTimeZoneClock = (value: string): PreferredTimeZoneClock => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return { minutes: 0, dayOffset: 0 };
  const targetDate = new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0, 0));
  const tz = getPreferredTimeZone();

  const parseDateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');

    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
      hour: getPart('hour'),
      minute: getPart('minute'),
    };
  };

  const baseParts = parseDateParts(new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0)));
  const targetParts = parseDateParts(targetDate);

  const baseDayIndex = Math.floor(
    Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day) / 86_400_000
  );
  const targetDayIndex = Math.floor(
    Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day) / 86_400_000
  );

  return {
    minutes: targetParts.hour * 60 + targetParts.minute,
    dayOffset: targetDayIndex - baseDayIndex,
  };
};

export type PreferredTimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const getLocalDateKey = (value: Date): string => {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`;
};

export const getDatePartsInPreferredTimeZone = (value: Date): PreferredTimeZoneDateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: getPreferredTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
  };
};

export const getDateKeyInPreferredTimeZone = (value: Date): string => {
  const parts = getDatePartsInPreferredTimeZone(value);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(
    2,
    '0'
  )}`;
};

export const isOnPreferredTimeZoneCalendarDay = (value: Date, calendarDay: Date): boolean => {
  return getDateKeyInPreferredTimeZone(value) === getLocalDateKey(calendarDay);
};

export const getMinutesSinceStartOfDayInPreferredTimeZone = (value: Date): number => {
  const parts = getDatePartsInPreferredTimeZone(value);
  return parts.hour * 60 + parts.minute;
};

export const getPreciseMinutesSinceStartOfDayInPreferredTimeZone = (value: Date): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: getPreferredTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');
  return hour * 60 + minute + second / 60 + value.getMilliseconds() / 60_000;
};

export const getHourInPreferredTimeZone = (value: Date): number => {
  return getDatePartsInPreferredTimeZone(value).hour;
};

const getOffsetMinutesForTimeZoneAtInstant = (timeZone: string, instant: Date): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const offsetLabel = formatter
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(offsetLabel ?? '');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] ?? '0');
  const minutes = Number(match[3] ?? '0');
  return sign * (hours * 60 + minutes);
};

export const buildDateInPreferredTimeZone = (calendarDay: Date, minuteOfDay: number): Date => {
  const year = calendarDay.getFullYear();
  const month = calendarDay.getMonth();
  const day = calendarDay.getDate();
  const clampedMinute = Math.max(0, Math.min(24 * 60 - 1, Math.round(minuteOfDay)));
  const hour = Math.floor(clampedMinute / 60);
  const minute = clampedMinute % 60;
  const naiveUtcMs = Date.UTC(year, month, day, hour, minute, 0, 0);
  const timeZone = getPreferredTimeZone();

  let instant = new Date(naiveUtcMs);
  for (let attempt = 0; attempt < 3; attempt++) {
    const offsetMinutes = getOffsetMinutesForTimeZoneAtInstant(timeZone, instant);
    const nextInstant = new Date(naiveUtcMs - offsetMinutes * 60_000);
    if (Math.abs(nextInstant.getTime() - instant.getTime()) < 60_000) {
      instant = nextInstant;
      break;
    }
    instant = nextInstant;
  }

  return instant;
};

export { TIMEZONE_STORAGE_KEY, DEFAULT_TIMEZONE };
