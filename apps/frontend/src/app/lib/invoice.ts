import { Appointment } from '@yosemite-crew/types';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';

export const normalizeAppointmentId = (appointmentId: string | undefined): string | undefined => {
  const raw = String(appointmentId ?? '').trim();
  if (!raw) return undefined;

  // Accept values like "Appointment/123", full URLs, and plain IDs.
  const withoutQuery = raw.split(/[?#]/)[0];
  const tail = withoutQuery.split('/').findLast(Boolean);
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
  return formatCompanionNameWithOwnerLastName(match?.companion?.name, match?.companion?.parent);
};

export const getParentNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return getOwnerFirstName(match?.companion?.parent) || '-';
};
