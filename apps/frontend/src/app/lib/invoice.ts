import { Appointment } from '@yosemite-crew/types';

export const normalizeAppointmentId = (appointmentId: string | undefined): string | undefined => {
  const raw = String(appointmentId ?? '').trim();
  if (!raw) return undefined;

  // Accept values like "Appointment/123", full URLs, and plain IDs.
  const withoutQuery = raw.split(/[?#]/)[0];
  const tail = withoutQuery.split('/').filter(Boolean).pop();
  return tail?.trim() || undefined;
};

export const appointmentIdsMatch = (
  leftId: string | undefined,
  rightId: string | undefined
): boolean => {
  const left = normalizeAppointmentId(leftId);
  const right = normalizeAppointmentId(rightId);
  return Boolean(left && right && left === right);
};

export const getAppointmentByIdFromList = (
  appointments: Appointment[],
  appointmentId: string | undefined
): Appointment | undefined => {
  if (!appointmentId) return undefined;
  return appointments.find((a) => appointmentIdsMatch(a.id, appointmentId));
};

export const getCompanionNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return match?.companion?.name || '-';
};

export const getParentNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return match?.companion?.parent?.name || '-';
};
