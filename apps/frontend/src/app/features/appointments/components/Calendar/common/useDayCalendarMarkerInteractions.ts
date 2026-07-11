import { Appointment } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useMarkerInteractions } from './useMarkerInteractions';

type UseDayCalendarMarkerInteractionsArgs = {
  handleOpenPopover: (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ) => void;
  setActivePopoverKey: (key: string | null) => void;
  handleOpenWorkspace?: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  handleDetailAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
};

/**
 * DayCalendar marker interactions: shared click/double-click/context-menu handling
 * (useMarkerInteractions) with the day calendar's double-click action — open the
 * workspace when available, else the detail view.
 */
export function useDayCalendarMarkerInteractions({
  handleOpenPopover,
  setActivePopoverKey,
  handleOpenWorkspace,
  handleDetailAppointment,
}: UseDayCalendarMarkerInteractionsArgs) {
  return useMarkerInteractions({
    handleOpenPopover,
    setActivePopoverKey,
    onMarkerDoubleClick: (appointment) => {
      if (handleOpenWorkspace) handleOpenWorkspace(appointment);
      else handleDetailAppointment(appointment);
    },
  });
}
