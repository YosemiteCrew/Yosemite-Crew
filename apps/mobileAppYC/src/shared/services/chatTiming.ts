/**
 * Chat timing helpers for appointment-based chat activation.
 *
 * Chat is active from (appointment - activationMinutes) until (appointment + 30 minutes).
 */

/**
 * Check if chat should be active based on appointment time.
 *
 * @param appointmentTime - ISO8601 timestamp (UTC with Z suffix, or UTC date+time)
 * @param activationMinutes - Minutes before appointment when chat unlocks (default: 5)
 * @returns boolean - Whether chat is currently active
 */
export const isChatActive = (
  appointmentTime: string,
  activationMinutes: number = 5,
): boolean => {
  const now = new Date();

  const isoTime = appointmentTime.endsWith('Z')
    ? appointmentTime
    : `${appointmentTime}Z`;

  const appointment = new Date(isoTime);

  if (Number.isNaN(appointment.getTime())) {
    console.warn('[ChatTiming] Invalid appointment time:', appointmentTime);
    return false;
  }

  const activationTime = new Date(
    appointment.getTime() - activationMinutes * 60000,
  );

  const endTime = new Date(appointment.getTime() + 30 * 60000);

  const isActive = now >= activationTime && now <= endTime;

  return isActive;
};

/**
 * Format appointment time for display.
 */
export const formatAppointmentTime = (appointmentTime: string): string => {
  const isoTime = appointmentTime.endsWith('Z')
    ? appointmentTime
    : `${appointmentTime}Z`;

  const date = new Date(isoTime);

  if (Number.isNaN(date.getTime())) {
    console.warn('[ChatTiming] Invalid appointment time for formatting:', appointmentTime);
    return appointmentTime;
  }

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  return `${dateStr} at ${timeStr}`;
};

/**
 * Get time remaining until chat activation.
 */
export const getTimeUntilChatActivation = (
  appointmentTime: string,
  activationMinutes: number = 5,
): {minutes: number; seconds: number} | null => {
  const now = new Date();

  const isoTime = appointmentTime.endsWith('Z')
    ? appointmentTime
    : `${appointmentTime}Z`;

  const appointment = new Date(isoTime);

  if (Number.isNaN(appointment.getTime())) {
    console.warn('[ChatTiming] Invalid appointment time for countdown:', appointmentTime);
    return null;
  }

  const activationTime = new Date(
    appointment.getTime() - activationMinutes * 60000,
  );

  if (now >= activationTime) {
    return null;
  }

  const diffMs = activationTime.getTime() - now.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return {minutes, seconds};
};
