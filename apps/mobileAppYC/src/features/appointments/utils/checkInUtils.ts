/**
 * Shared check-in validation and formatting utilities
 */

import {normalizeTimeString} from './timeFormatting';

const CHECKIN_BUFFER_MS = 5 * 60 * 1000;
const CHECKIN_RADIUS_METERS = 200;

/**
 * Check if current time is within the check-in window
 */
export const isWithinCheckInWindow = (dateStr: string, timeStr?: string | null): boolean => {
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
export const formatCheckInTime = (dateStr: string, timeStr?: string | null): string => {
  const normalizedTime = normalizeTimeString(timeStr ?? '00:00');
  const start = new Date(`${dateStr}T${normalizedTime}Z`);
  if (Number.isNaN(start.getTime())) {
    return timeStr ?? '';
  }
  return start.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
};

export const getCheckInConstants = () => ({
  CHECKIN_BUFFER_MS,
  CHECKIN_RADIUS_METERS,
});
