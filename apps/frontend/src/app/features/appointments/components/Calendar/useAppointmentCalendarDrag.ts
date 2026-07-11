import { useCallback, useReducer, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { allowCalendarDrag } from '@/app/lib/appointments';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { logger } from '@/app/lib/logger';
import { useAppointmentDragAvailability } from '@/app/features/appointments/components/Calendar/useAppointmentDragAvailability';
import { useAppointmentDragAutoScroll } from '@/app/features/appointments/components/Calendar/useAppointmentDragAutoScroll';
import {
  DragContext,
  ErrorCandidate,
  clampMinutes,
  dragReducer,
  getAppointmentDragLabel,
  getAppointmentDurationMinutes,
  getErrorMessageFromCandidate,
  hasAppointmentConflict,
  initialDragState,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';

type UseAppointmentCalendarDragOptions = {
  activeCalendar: string;
  allAppointments: Appointment[];
  authUserId: string;
  canEditAppointments: boolean;
  currentDate: Date;
  notify: (kind: 'warning', value: { title: string; text: string }) => void;
  teams: ReturnType<typeof useTeamForPrimaryOrg>;
  weekStart: Date;
};

export const useAppointmentCalendarDrag = ({
  activeCalendar,
  allAppointments,
  authUserId,
  canEditAppointments,
  currentDate,
  notify,
  teams,
  weekStart,
}: UseAppointmentCalendarDragOptions) => {
  const [dragState, dispatchDrag] = useReducer(dragReducer, initialDragState);
  const [suppressAutoScroll, setSuppressAutoScroll] = useState(false);
  const dragContextRef = useRef<DragContext | null>(null);
  const suppressAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeId = useCallback(
    (value?: string) =>
      String(value ?? '')
        .trim()
        .split('/')
        .pop()
        ?.toLowerCase() ?? '',
    []
  );

  const isAppointmentDraggable = useCallback(
    (appointment: Appointment) =>
      !!appointment.id && canEditAppointments && allowCalendarDrag(appointment.status),
    [canEditAppointments]
  );

  const resolvePractitionerId = useCallback(
    (candidateId?: string) => {
      if (!candidateId) return undefined;
      const normalizedCandidate = normalizeId(candidateId);
      const match = teams.find(
        (member) =>
          normalizeId(member.practionerId || '') === normalizedCandidate ||
          normalizeId(member._id || '') === normalizedCandidate
      );
      return match?.practionerId || candidateId;
    },
    [normalizeId, teams]
  );

  const supportsSpeciality = useCallback(
    (targetLeadId: string, appointment: Appointment) => {
      const normalizedTarget = normalizeId(targetLeadId);
      const target = teams.find(
        (member) =>
          normalizeId(member.practionerId || '') === normalizedTarget ||
          normalizeId(member._id || '') === normalizedTarget
      );
      if (!target) return false;
      const appointmentSpeciality = appointment.appointmentType?.speciality;
      if (!appointmentSpeciality) return true;
      if (!Array.isArray(target.speciality) || target.speciality.length === 0) return true;
      const expectedId = String((appointmentSpeciality as any).id ?? '').toLowerCase();
      const expectedName = String((appointmentSpeciality as any).name ?? '').toLowerCase();
      return target.speciality.some((spec: any) => {
        const id = String(spec?._id ?? spec?.id ?? '').toLowerCase();
        const name = String(spec?.name ?? spec ?? '').toLowerCase();
        return (expectedId && id === expectedId) || (expectedName && name === expectedName);
      });
    },
    [normalizeId, teams]
  );

  const {
    availabilityLoaded,
    buildAppointmentStartFromCalendarMinutes,
    clearDragAvailability,
    ensureDragAvailability,
    getCurrentUserPractitionerId,
    getCurrentUserViewAvailabilityIntervals,
    getDropAvailabilityIntervals,
    getViewAvailabilityIntervals,
    prefetchDragAvailabilityForView,
  } = useAppointmentDragAvailability({
    activeCalendar,
    allAppointments,
    authUserId,
    currentDate,
    dispatchDrag,
    dragContextRef,
    normalizeId,
    resolvePractitionerId,
    supportsSpeciality,
    teams,
    weekStart,
  });

  useAppointmentDragAutoScroll(dragState.appointmentId, dragState.availabilityVersion);

  const markDropped = useCallback(() => {
    if (suppressAutoScrollTimerRef.current) clearTimeout(suppressAutoScrollTimerRef.current);
    setSuppressAutoScroll(true);
    suppressAutoScrollTimerRef.current = setTimeout(() => setSuppressAutoScroll(false), 4000);
  }, []);

  const moveAppointment = useCallback(
    async (date: Date, minutesSinceMidnight: number, targetLeadId?: string) => {
      const warnDrag = (message: string) => {
        dispatchDrag({ type: 'setError', error: message });
        notify('warning', { title: 'Move blocked', text: message });
      };

      if (!dragState.appointmentId) return;
      const appointment = allAppointments.find((item) => item.id === dragState.appointmentId);
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
      buildAppointmentStartFromCalendarMinutes,
      dragState.appointmentId,
      ensureDragAvailability,
      isAppointmentDraggable,
      normalizeId,
      notify,
      resolvePractitionerId,
      supportsSpeciality,
      teams,
    ]
  );

  const handleAppointmentDragStart = useCallback(
    (appointment: Appointment) => {
      if (!isAppointmentDraggable(appointment)) return;
      clearDragAvailability();
      const context = {
        appointmentId: appointment.id ?? '',
        serviceId: appointment.appointmentType?.id,
        durationMinutes: getAppointmentDurationMinutes(appointment),
      };
      dragContextRef.current = context;
      dispatchDrag({
        type: 'start',
        appointmentId: appointment.id ?? null,
        label: getAppointmentDragLabel(appointment),
        context,
      });
      prefetchDragAvailabilityForView();
    },
    [clearDragAvailability, isAppointmentDraggable, prefetchDragAvailabilityForView]
  );

  const handleAppointmentDragEnd = useCallback(() => {
    dragContextRef.current = null;
    dispatchDrag({ type: 'end' });
  }, []);

  const handleDragHoverTarget = useCallback(
    (dropDate: Date, targetLeadId?: string) => {
      ensureDragAvailability(dropDate, targetLeadId).catch((error: unknown) => {
        logger.warn('Failed to refresh appointment drop availability while dragging.', error);
      });
    },
    [ensureDragAvailability]
  );

  const handleAppointmentDropAt = useCallback(
    (dropDate: Date, minute: number, targetLeadId?: string) => {
      markDropped();
      moveAppointment(dropDate, minute, targetLeadId).catch((error: unknown) => {
        logger.warn('Failed to move appointment from calendar drop.', error);
      });
      handleAppointmentDragEnd();
    },
    [handleAppointmentDragEnd, markDropped, moveAppointment]
  );

  return {
    availabilityLoaded,
    dragContext: dragState.context,
    draggedAppointmentId: dragState.appointmentId,
    draggedAppointmentLabel: dragState.label,
    dragError: dragState.error,
    getCurrentUserPractitionerId,
    getCurrentUserViewAvailabilityIntervals,
    getDropAvailabilityIntervals,
    getViewAvailabilityIntervals,
    handleAppointmentDragEnd,
    handleAppointmentDragStart,
    handleAppointmentDropAt,
    handleDragHoverTarget,
    isAppointmentDraggable,
    resolvePractitionerId,
    skipAutoScroll: suppressAutoScroll,
  };
};
