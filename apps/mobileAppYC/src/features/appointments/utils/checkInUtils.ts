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
  const normalizedTime = normalizeTimeString(timeStr ?? '00:00');
  const start = new Date(`${dateStr}T${normalizedTime}Z`).getTime();
  if (Number.isNaN(start)) {
    return true;
  }
  return Date.now() >= start - CHECKIN_BUFFER_MS;
};

/**
 * Format the local start time for check-in messages
 */
export const formatCheckInTime = (
  dateStr: string,
  timeStr?: string | null,
): string => {
  const normalizedTime = normalizeTimeString(timeStr ?? '00:00');
  const start = new Date(`${dateStr}T${normalizedTime}Z`);
  if (Number.isNaN(start.getTime())) {
    return timeStr ?? '';
  }
  return start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};
