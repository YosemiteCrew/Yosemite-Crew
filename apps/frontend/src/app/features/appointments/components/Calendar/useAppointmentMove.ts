import { Dispatch, useCallback, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  DragAction,
  ErrorCandidate,
  clampMinutes,
  getErrorMessageFromCandidate,
  hasAppointmentConflict,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';

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
      if (!appointmentId) return;
      const appointment = allAppointments.find((item) => item.id === appointmentId);
      if (!appointment) {
        warnDrag('Unable to move this appointment.');
        return;
      }
      if (!isAppointmentDraggable(appointment)) {
        warnDrag('Only requested and upcoming appointments can be moved.');
        return;
      }

      const snappedMinutes = clampMinutes(minutesSinceMidnight);
      const nextStart = buildAppointmentStartFromCalendarMinutes(date, snappedMinutes);
      const durationMs = Math.max(
        5 * 60 * 1000,
        new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()
      );
      const nextEnd = new Date(nextStart.getTime() + durationMs);
      const appointmentServiceId = appointment.appointmentType?.id;
      const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);

      if (nextStart.getTime() < Date.now()) {
        warnDrag('Cannot move an appointment to a past time.');
        return;
      }
      if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) {
        warnDrag('Selected team member is not configured for this speciality.');
        return;
      }
      if (appointmentServiceId && targetPractitionerId) {
        const availableStartMinutes = await ensureDragAvailability(date, targetLeadId);
        if (availableStartMinutes.length === 0 || !availableStartMinutes.includes(snappedMinutes)) {
          warnDrag('No available slot for this service at the selected position.');
          return;
        }
      }
      if (
        hasAppointmentConflict(
          appointment,
          nextStart,
          nextEnd,
          allAppointments,
          targetPractitionerId
        )
      ) {
        warnDrag('Scheduling conflict detected with another appointment.');
        return;
      }

      try {
        dispatchDrag({ type: 'setError', error: null });
        await updateAppointment({
          ...appointment,
          lead: targetPractitionerId
            ? {
                id: targetPractitionerId,
                name:
                  teams.find(
                    (member) =>
                      normalizeId(member.practionerId || '') ===
                        normalizeId(targetPractitionerId) ||
                      normalizeId(member._id || '') === normalizeId(targetPractitionerId)
                  )?.name ||
                  appointment.lead?.name ||
                  targetPractitionerId,
              }
            : appointment.lead,
          startTime: nextStart,
          endTime: nextEnd,
          appointmentDate: nextStart,
        });
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
