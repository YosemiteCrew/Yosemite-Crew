import { Dispatch, useCallback, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  DragAction,
  ErrorCandidate,
  getErrorMessageFromCandidate,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
import {
  buildAppointmentMovePayload,
  createAppointmentMovePlan,
  getMoveAvailabilityBlockMessage,
} from '@/app/features/appointments/components/Calendar/appointmentMoveUtils';

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
  const [suppressAutoScroll, setSuppressAutoScroll] = useState(false);
  const suppressAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDropped = useCallback(() => {
    if (suppressAutoScrollTimerRef.current) clearTimeout(suppressAutoScrollTimerRef.current);
    setSuppressAutoScroll(true);
    suppressAutoScrollTimerRef.current = setTimeout(() => setSuppressAutoScroll(false), 4000);
  }, []);

  const warnDrag = useCallback(
    (message: string) => {
      dispatchDrag({ type: 'setError', error: message });
      notify('warning', { title: 'Move blocked', text: message });
    },
    [dispatchDrag, notify]
  );

  const moveAppointment = useCallback(
    async (date: Date, minutesSinceMidnight: number, targetLeadId?: string) => {
      const result = createAppointmentMovePlan({
        allAppointments,
        appointmentId,
        buildStart: buildAppointmentStartFromCalendarMinutes,
        date,
        isAppointmentDraggable,
        minutesSinceMidnight,
        resolvePractitionerId,
        supportsSpeciality,
        targetLeadId,
      });
      if (!result.ok) {
        if (result.message) warnDrag(result.message);
        return;
      }

      const availabilityBlockMessage = await getMoveAvailabilityBlockMessage(
        result.plan,
        date,
        targetLeadId,
        ensureDragAvailability
      );
      if (availabilityBlockMessage) {
        warnDrag(availabilityBlockMessage);
        return;
      }

      try {
        dispatchDrag({ type: 'setError', error: null });
        await updateAppointment(
          buildAppointmentMovePayload({
            appointment: result.plan.appointment,
            normalizeId,
            nextEnd: result.plan.nextEnd,
            nextStart: result.plan.nextStart,
            targetPractitionerId: result.plan.targetPractitionerId,
            teams,
          })
        );
      } catch (error) {
        dispatchDrag({
          type: 'setError',
          error: getErrorMessageFromCandidate(
            error as ErrorCandidate,
            'Unable to update appointment. Please try again.'
          ),
        });
      }
    },
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

  return {
    markDropped,
    moveAppointment,
    suppressAutoScroll,
  };
};
