import { AppointmentStatus } from '@/app/features/appointments/types/appointments';

export type LegacyAppointmentStatus = AppointmentStatus | 'NO_PAYMENT';

export const normalizeAppointmentStatus = (
  status?: LegacyAppointmentStatus
): AppointmentStatus | undefined => {
  if (!status) return undefined;
  return status === 'NO_PAYMENT' ? 'REQUESTED' : status;
};

export const allowReschedule = (status: AppointmentStatus) => {
  if (status === 'UPCOMING') {
    return true;
  }
  return false;
};

export const allowCalendarDrag = (status: AppointmentStatus) => {
  const normalizedStatus = normalizeAppointmentStatus(status) ?? 'REQUESTED';
  if (normalizedStatus === 'REQUESTED' || normalizedStatus === 'UPCOMING') {
    return true;
  }
  return false;
};
