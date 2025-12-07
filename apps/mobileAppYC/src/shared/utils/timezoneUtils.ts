/**
 * Timezone conversion utilities for handling UTC times from backend
 *
 * The backend returns appointment times in UTC format.
 * This utility converts them to local timezone for proper display.
 */

/**
 * Convert UTC date and time to local time representation
 *
 * Backend provides:
 * - date: YYYY-MM-DD (in UTC)
 * - time: HH:MM or HH:MM:SS (in UTC)
 *
 * This creates a proper Date object accounting for timezone offset
 */
export const convertUtcToLocalDateTime = (
  utcDate: string,
  utcTime: string,
): Date => {
  // Create ISO string with Z to indicate UTC
  const normalized = utcTime.length === 5 ? `${utcTime}:00` : utcTime;
  const isoString = `${utcDate}T${normalized}Z`;

  // Parse as UTC time
  const utcDate_ = new Date(isoString);

  if (Number.isNaN(utcDate_.getTime())) {
    console.warn('[Timezone] Invalid date/time:', {utcDate, utcTime});
    return new Date();
  }

  return utcDate_;
};

/**
 * Get appointment datetime as ISO string treating input as UTC
 *
 * @param date - YYYY-MM-DD date string (UTC)
 * @param time - HH:MM or HH:MM:SS time string (UTC)
 * @returns ISO string with Z suffix indicating UTC
 */
export const getAppointmentTimeAsIso = (date: string, time: string): string => {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${date}T${normalized}Z`;
};

/**
 * Get local date from UTC appointment date
 * Handles timezone offset properly
 */
export const getLocalDateFromUtc = (utcDate: string): Date => {
  // Create date in UTC
  const date = new Date(`${utcDate}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    console.warn('[Timezone] Invalid date:', utcDate);
    return new Date();
  }

  return date;
};

/**
 * Check if appointment is today (in local timezone)
 * Properly handles UTC times
 */
export const isAppointmentToday = (utcDate: string): boolean => {
  const appointmentDate = getLocalDateFromUtc(utcDate);
  const todayDate = new Date();

  return (
    appointmentDate.getFullYear() === todayDate.getFullYear() &&
    appointmentDate.getMonth() === todayDate.getMonth() &&
    appointmentDate.getDate() === todayDate.getDate()
  );
};

/**
 * Get timezone-aware appointment display time
 *
 * @param utcDate - YYYY-MM-DD (UTC)
 * @param utcTime - HH:MM or HH:MM:SS (UTC)
 * @returns Formatted time string respecting local timezone
 */
export const getAppointmentDisplayTime = (
  utcDate: string,
  utcTime: string,
): string => {
  const appointmentTime = convertUtcToLocalDateTime(utcDate, utcTime);

  return appointmentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format appointment time for display with date
 *
 * @param utcDate - YYYY-MM-DD (UTC)
 * @param utcTime - HH:MM or HH:MM:SS (UTC)
 * @returns "Today at HH:MM AM/PM" or "MMM DD at HH:MM AM/PM"
 */
export const formatAppointmentTimeWithDate = (
  utcDate: string,
  utcTime: string,
): string => {
  const appointmentDate = convertUtcToLocalDateTime(utcDate, utcTime);
  const now = new Date();

  const isToday = appointmentDate.toDateString() === now.toDateString();

  const timeStr = appointmentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const dateStr = appointmentDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  return `${dateStr} at ${timeStr}`;
};
