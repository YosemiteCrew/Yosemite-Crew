import { Dispatch, useCallback } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  DragAction,
  ErrorCandidate,
  getErrorMessageFromCandidate,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
import { executeAppointmentMove } from '@/app/features/appointments/components/Calendar/appointmentMoveUtils';

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

type WarnDragOptions = Pick<UseAppointmentMoveOptions, 'dispatchDrag' | 'notify'>;

const handleMoveBlocked = ({ dispatchDrag, notify }: WarnDragOptions, message: string) => {
  dispatchDrag({ type: 'setError', error: message });
  notify('warning', { title: 'Move blocked', text: message });
};

const handleMoveUpdateError = (dispatchDrag: Dispatch<DragAction>, error: unknown) => {
  dispatchDrag({
    type: 'setError',
    error: getErrorMessageFromCandidate(
      error as ErrorCandidate,
      'Unable to update appointment. Please try again.'
    ),
  });
};

const updateMovedAppointment = (
  dispatchDrag: Dispatch<DragAction>,
  payload: Parameters<typeof updateAppointment>[0]
) => {
  dispatchDrag({ type: 'setError', error: null });
  return updateAppointment(payload);
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
  const onBlocked = useCallback(
    (message: string) => handleMoveBlocked({ dispatchDrag, notify }, message),
    [dispatchDrag, notify]
  );
  const onUpdateError = useCallback(
    (error: unknown) => handleMoveUpdateError(dispatchDrag, error),
    [dispatchDrag]
  );
  const persistMovedAppointment = useCallback(
    (payload: Parameters<typeof updateAppointment>[0]) =>
      updateMovedAppointment(dispatchDrag, payload),
    [dispatchDrag]
  );

  const moveAppointment = useCallback(
    (date: Date, minutesSinceMidnight: number, targetLeadId?: string) =>
      executeAppointmentMove({
        allAppointments,
        appointmentId,
        buildStart: buildAppointmentStartFromCalendarMinutes,
        date,
        ensureDragAvailability,
        isAppointmentDraggable,
        minutesSinceMidnight,
        normalizeId,
        onBlocked,
        onUpdateError,
        resolvePractitionerId,
        supportsSpeciality,
        targetLeadId,
        teams,
        updateAppointment: persistMovedAppointment,
      }),
    [
      allAppointments,
      appointmentId,
      buildAppointmentStartFromCalendarMinutes,
      ensureDragAvailability,
      isAppointmentDraggable,
      normalizeId,
      onBlocked,
      onUpdateError,
      persistMovedAppointment,
      resolvePractitionerId,
      supportsSpeciality,
      teams,
    ]
  );

  return { moveAppointment };
};
