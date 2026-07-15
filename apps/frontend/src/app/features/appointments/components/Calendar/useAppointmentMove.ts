import { Dispatch, useCallback, useMemo } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  DragAction,
  ErrorCandidate,
  getErrorMessageFromCandidate,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
import { executeAppointmentMove } from '@/app/features/appointments/components/Calendar/appointmentMoveUtils';

type NotifyFn = (kind: 'warning', value: { title: string; text: string }) => void;

// Build the drag error/persistence handlers for a move. Pure factory kept out of
// the hook so useAppointmentMove stays focused on wiring.
const createMoveHandlers = (dispatchDrag: Dispatch<DragAction>, notify: NotifyFn) => ({
  onBlocked: (message: string) => {
    dispatchDrag({ type: 'setError', error: message });
    notify('warning', { title: 'Move blocked', text: message });
  },
  onUpdateError: (error: unknown) => {
    dispatchDrag({
      type: 'setError',
      error: getErrorMessageFromCandidate(
        error as ErrorCandidate,
        'Unable to update appointment. Please try again.'
      ),
    });
  },
  persistMovedAppointment: (payload: Parameters<typeof updateAppointment>[0]) => {
    dispatchDrag({ type: 'setError', error: null });
    return updateAppointment(payload);
  },
});

type UseAppointmentMoveOptions = {
  allAppointments: Appointment[];
  appointmentId: string | null;
  buildAppointmentStartFromCalendarMinutes: (date: Date, minuteOfDay: number) => Date;
  dispatchDrag: Dispatch<DragAction>;
  ensureDragAvailability: (date: Date, targetLeadId?: string) => Promise<number[]>;
  isAppointmentDraggable: (appointment: Appointment) => boolean;
  normalizeId: (value?: string) => string;
  notify: (kind: 'warning', value: { title: string; text: string }) => void;
  resolvePractitionerId: (candidateId?: string) => string | undefined;
  supportsSpeciality: (targetLeadId: string, appointment: Appointment) => boolean;
  teams: ReturnType<typeof useTeamForPrimaryOrg>;
};

export const useAppointmentMove = ({
  allAppointments,
  appointmentId,
  buildAppointmentStartFromCalendarMinutes,
  dispatchDrag,
  ensureDragAvailability,
  isAppointmentDraggable,
  normalizeId,
  notify,
  resolvePractitionerId,
  supportsSpeciality,
  teams,
}: UseAppointmentMoveOptions) => {
  const moveContext = useMemo(() => {
    const handlers = createMoveHandlers(dispatchDrag, notify);
    return {
      allAppointments,
      appointmentId,
      buildStart: buildAppointmentStartFromCalendarMinutes,
      ensureDragAvailability,
      isAppointmentDraggable,
      normalizeId,
      onBlocked: handlers.onBlocked,
      onUpdateError: handlers.onUpdateError,
      resolvePractitionerId,
      supportsSpeciality,
      teams,
      updateAppointment: handlers.persistMovedAppointment,
    };
  }, [
    allAppointments,
    appointmentId,
    buildAppointmentStartFromCalendarMinutes,
    dispatchDrag,
    ensureDragAvailability,
    isAppointmentDraggable,
    normalizeId,
    notify,
    resolvePractitionerId,
    supportsSpeciality,
    teams,
  ]);

  const moveAppointment = useCallback(
    (date: Date, minutesSinceMidnight: number, targetLeadId?: string) =>
      executeAppointmentMove({ ...moveContext, date, minutesSinceMidnight, targetLeadId }),
    [moveContext]
  );

  return { moveAppointment };
};
