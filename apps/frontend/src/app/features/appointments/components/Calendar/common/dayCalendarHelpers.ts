import { Appointment } from '@yosemite-crew/types';
import { getCompanionDisplayName } from '@/app/features/appointments/components/Calendar/common/slotHelpers';

export {
  getCompanionDisplayName,
  setCustomDragGhost,
} from '@/app/features/appointments/components/Calendar/common/slotHelpers';

export const getAllDayAppointmentAriaLabel = (appointment: Appointment) => {
  const concernSuffix = appointment.concern ? `. ${appointment.concern}` : '';
  return `All-day appointment for ${getCompanionDisplayName(appointment)}${concernSuffix}`;
};

export const getEventKey = (event: Appointment, index: number, source: 'all-day' | 'timed') =>
  `${source}-${(event.companion ?? event.patient).name}-${event.startTime.toISOString()}-${index}`;
