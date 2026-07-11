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
  const warnDrag = useCallback(
    (message: string) => {
      dispatchDrag({ type: 'setError', error: message });
      notify('warning', { title: 'Move blocked', text: message });
    },
    [dispatchDrag, notify]
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
        onBlocked: warnDrag,
        onUpdateError: (error) =>
          dispatchDrag({
            type: 'setError',
            error: getErrorMessageFromCandidate(
              error as ErrorCandidate,
              'Unable to update appointment. Please try again.'
            ),
          }),
        resolvePractitionerId,
        supportsSpeciality,
        targetLeadId,
        teams,
        updateAppointment: (payload) => {
          dispatchDrag({ type: 'setError', error: null });
          return updateAppointment(payload);
        },
      }),
    [
      allAppointments,
      appointmentId,
      buildAppointmentStartFromCalendarMinutes,
      dispatchDrag,
      ensureDragAvailability,
      isAppointmentDraggable,
      normalizeId,
      resolvePractitionerId,
      supportsSpeciality,
      teams,
      warnDrag,
    ]
  );

  return { moveAppointment };
};
