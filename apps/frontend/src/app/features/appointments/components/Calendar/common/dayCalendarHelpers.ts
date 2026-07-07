import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

export const getCompanionDisplayName = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(
    (appointment.companion ?? appointment.patient).name,
    (appointment.companion ?? appointment.patient).parent
  );

export const getAllDayAppointmentAriaLabel = (appointment: Appointment) => {
  const concernSuffix = appointment.concern ? `. ${appointment.concern}` : '';
  return `All-day appointment for ${getCompanionDisplayName(appointment)}${concernSuffix}`;
};

export const getEventKey = (event: Appointment, index: number, source: 'all-day' | 'timed') =>
  `${source}-${(event.companion ?? event.patient).name}-${event.startTime.toISOString()}-${index}`;

export const setCustomDragGhost = (
  event: React.DragEvent<HTMLButtonElement>,
  appointment: Appointment
) => {
  const ghost = document.createElement('img');
  ghost.src = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(appointment.companion ?? appointment.patient),
    (appointment.companion ?? appointment.patient).species.toLowerCase() as ImageType
  );
  ghost.width = 24;
  ghost.height = 24;
  ghost.style.position = 'fixed';
  ghost.style.top = '-9999px';
  ghost.style.left = '-9999px';
  ghost.style.width = '24px';
  ghost.style.height = '24px';
  ghost.style.borderRadius = '999px';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 12, 12);
  globalThis.setTimeout(() => {
    ghost.remove();
  }, 0);
};
