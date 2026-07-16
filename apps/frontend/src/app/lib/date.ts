import { Option } from '@/app/features/companions/types/companion';
import {
  formatDateInPreferredTimeZone,
  formatUtcClockTimeLabel,
  getDatePartsInPreferredTimeZone,
} from '@/app/lib/timezone';

type DateInput = Date | string | number | null;

const toValidDate = (value?: DateInput): Date | null => {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateUTC = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getAgeInYears(dateOfBirth: Date | string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

/**
 * Whole months elapsed since `dateOfBirth`. NaN for an unparseable date, and
 * negative for a future date, so callers can reject both with one finite check.
 */
export function getAgeInMonths(dateOfBirth: Date | string): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return Number.NaN;
  const today = new Date();

  let months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());

  // The birth day-of-month has not come round yet this month, so the final
  // month is still in progress.
  if (today.getDate() < dob.getDate()) months--;

  return months;
}

/**
 * Companion age label. Under a year it reads in months, so a newborn shows
 * "0 Mos" rather than a misleading "0 Yrs"; a year and over it reads in years.
 * `long` switches the suffix to the spelled-out form used by the Age / DOB rows.
 * Returns '' when the date of birth is missing, unparseable, or in the future,
 * leaving the fallback copy to the caller.
 */
export function formatCompanionAge(
  dateOfBirth?: Date | string | null,
  options?: { long?: boolean }
): string {
  if (dateOfBirth == null || dateOfBirth === '') return '';

  const months = getAgeInMonths(dateOfBirth);
  if (!Number.isFinite(months) || months < 0) return '';

  const long = options?.long ?? false;

  if (months < 12) {
    const unit = long ? (months === 1 ? 'month' : 'months') : months === 1 ? 'Mo' : 'Mos';
    return `${months} ${unit}`;
  }

  const years = Math.floor(months / 12);
  const unit = long ? (years === 1 ? 'year' : 'years') : years === 1 ? 'Yr' : 'Yrs';
  return `${years} ${unit}`;
}

export const buildUtcDateFromDateAndTime = (selectedDate: Date, startTime: string): Date => {
  const [hours, minutes] = startTime.split(':').map(Number);

  return new Date(
    Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes,
      0,
      0
    )
  );
};

export const getDurationMinutes = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  return eh * 60 + em - (sh * 60 + sm);
};

export function generateTimeSlots(intervalMinutes = 15): Option[] {
  const slots: Option[] = [];
  const baseDateUTC = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
  for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
    const utcDate = new Date(baseDateUTC.getTime() + minutes * 60_000);
    const value = utcDate.toISOString().slice(11, 16);
    const label = formatUtcClockTimeLabel(value);
    slots.push({ value, label });
  }
  return slots;
}

export function applyUtcTime(base: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

export const getUtcTimeValue = (value?: DateInput, fallback = '00:00'): string => {
  const date = toValidDate(value);
  if (!date) return fallback;
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const getPreferredTimeValue = (value?: DateInput, fallback = '00:00'): string => {
  const date = toValidDate(value);
  if (!date) return fallback;
  const parts = getDatePartsInPreferredTimeZone(date);
  const hours = String(parts.hour).padStart(2, '0');
  const minutes = String(parts.minute).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const formatDisplayDate = (value?: DateInput, fallback = ''): string => {
  const date = toValidDate(value);
  if (!date) return fallback;
  return formatDateInPreferredTimeZone(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatDateTimeLocal = (value?: DateInput, fallback = 'Not available'): string => {
  const date = toValidDate(value);
  if (!date) return fallback;
  const formattedDate = formatDisplayDate(date, fallback);
  const formattedTime = formatDateInPreferredTimeZone(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${formattedDate}, ${formattedTime}`;
};

export const formatTimeInPreferredTimeZone = (value?: DateInput, fallback = ''): string => {
  const date = toValidDate(value);
  if (!date) return fallback;
  return formatDateInPreferredTimeZone(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const toUtcCalendarDate = (value?: DateInput): Date => {
  const date = toValidDate(value);
  if (!date) return new Date();
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};
