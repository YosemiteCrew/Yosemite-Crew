import { Appointment } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { canEnterAppointmentWorkspace } from '@/app/lib/appointmentWorkspace';
import { useMarkerInteractions } from './useMarkerInteractions';

type UseSlotMarkerInteractionsArgs = {
  handleOpenPopover: (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ) => void;
  setActivePopoverKey: (key: string | null) => void;
  handleOpenWorkspace?: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleDetailAppointment?: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
};

/**
 * Slot marker interactions: shared click/double-click/context-menu handling
 * (useMarkerInteractions) with the slot's double-click action — enter the
 * workspace only for eligible statuses, else fall back to detail/view — and an
 * outside-click dismiss that ignores clicks inside any [data-context-menu].
 */
export function useSlotMarkerInteractions({
  handleOpenPopover,
  setActivePopoverKey,
  handleOpenWorkspace,
  handleDetailAppointment,
  handleViewAppointment,
}: UseSlotMarkerInteractionsArgs) {
  return useMarkerInteractions({
    handleOpenPopover,
    setActivePopoverKey,
    dismissIgnoreSelector: '[data-context-menu]',
    onMarkerDoubleClick: (appointment) => {
      if (handleOpenWorkspace && canEnterAppointmentWorkspace(appointment.status)) {
        handleOpenWorkspace(appointment);
        return;
      }
      (handleDetailAppointment ?? handleViewAppointment)(appointment);
    },
  });
}
