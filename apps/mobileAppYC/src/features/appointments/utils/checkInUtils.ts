/**
 * Shared check-in validation and formatting utilities
 */

import {normalizeTimeString} from './timeFormatting';

const DEFAULT_CHECKIN_BUFFER_MINUTES = 5;
const DEFAULT_CHECKIN_RADIUS_METERS = 200;

const parseNonNegativeInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
};

export const getCheckInConstants = (config?: {
  CHECKIN_BUFFER_MINUTES?: unknown;
  CHECKIN_RADIUS_METERS?: unknown;
}) => {
  const CHECKIN_BUFFER_MINUTES =
    parseNonNegativeInteger(config?.CHECKIN_BUFFER_MINUTES) ??
    DEFAULT_CHECKIN_BUFFER_MINUTES;
  const CHECKIN_RADIUS_METERS =
    parseNonNegativeInteger(config?.CHECKIN_RADIUS_METERS) ??
    DEFAULT_CHECKIN_RADIUS_METERS;
  return {
    CHECKIN_BUFFER_MINUTES,
    CHECKIN_BUFFER_MS: CHECKIN_BUFFER_MINUTES * 60 * 1000,
    CHECKIN_RADIUS_METERS,
  };
};

const parseLocalDateTime = (
  dateStr: string,
  timeStr?: string | null,
): Date | null => {
  const normalizedTime = normalizeTimeString(timeStr ?? '00:00');
  const [yearRaw, monthRaw, dayRaw] = dateStr.split('-');
  const [hourRaw, minuteRaw, secondRaw = '0'] = normalizedTime.split(':');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }
  return date;
};

/**
 * Check if current time is within the check-in window
 */
export const isWithinCheckInWindow = (
  dateStr: string,
  timeStr?: string | null,
  checkInBufferMinutes?: number,
): boolean => {
  const {CHECKIN_BUFFER_MS} = getCheckInConstants({
    CHECKIN_BUFFER_MINUTES: checkInBufferMinutes,
  });
  const startDate = parseLocalDateTime(dateStr, timeStr);
  if (!startDate) {
    return true;
  }
  return Date.now() >= startDate.getTime() - CHECKIN_BUFFER_MS;
};

/**
 * Format the local start time for check-in messages
 */
export const formatCheckInTime = (
  dateStr: string,
  timeStr?: string | null,
): string => {
  const startDate = parseLocalDateTime(dateStr, timeStr);
  if (!startDate) {
    return timeStr ?? '';
  }
  return startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};
