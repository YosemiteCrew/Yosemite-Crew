import countries from '@/app/lib/data/countryList';

const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';
const DEFAULT_TIMEZONE = 'Europe/Berlin';

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

export { TIMEZONE_STORAGE_KEY, DEFAULT_TIMEZONE };
