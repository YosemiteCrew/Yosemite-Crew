import { AppointmentStatus } from '@/app/features/appointments/types/appointments';

export const allowReschedule = (status: AppointmentStatus) => {
  return !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status);
};

export const allowCalendarDrag = (status: AppointmentStatus) => {
  return !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status);
};
