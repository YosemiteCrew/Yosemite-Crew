/**
 * Shared time formatting utilities for appointments
 */

/**
 * Normalize time string to HH:MM:SS format
 */
export const normalizeTimeString = (timeStr?: string | null): string => {
  if (!timeStr) return '00:00:00';
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
};

/**
 * Format time in locale format (e.g., "2:30 PM")
 */
export const formatTimeLocale = (dateStr: string, timeStr?: string | null): string => {
  if (!timeStr) return '';
  const normalized = normalizeTimeString(timeStr);
  const asDate = new Date(`${dateStr}T${normalized}Z`);
  if (Number.isNaN(asDate.getTime())) {
    return timeStr;
  }
  return asDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format appointment time range (e.g., "2:30 PM - 3:00 PM")
 */
export const formatTimeRange = (
  dateStr: string,
  start?: string | null,
  end?: string | null,
): string | null => {
  const startLocal = formatTimeLocale(dateStr, start);
  const endLocal = formatTimeLocale(dateStr, end);
  if (startLocal && endLocal) {
    return `${startLocal} - ${endLocal}`;
  }
  return startLocal || start || null;
};

/**
 * Format date to locale format (e.g., "Dec 25, 2024")
 */
export const formatDateLocale = (iso: string): string => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format both date and time together (e.g., "Dec 25, 2024 • 2:30 PM")
 */
export const formatDateTime = (dateStr: string, timeStr?: string | null): string => {
  const normalized = normalizeTimeString(timeStr);
  const date = new Date(`${dateStr}T${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return timeStr ? `${dateStr} • ${timeStr}` : dateStr;
  }
  const formattedDate = formatDateLocale(dateStr);
  const formattedTime = timeStr
    ? date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  return formattedTime ? `${formattedDate} • ${formattedTime}` : formattedDate;
};
