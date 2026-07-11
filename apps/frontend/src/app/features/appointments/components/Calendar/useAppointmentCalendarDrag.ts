import { Dispatch, MutableRefObject, useCallback, useReducer, useRef } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { allowCalendarDrag } from '@/app/lib/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { logger } from '@/app/lib/logger';
import { useAppointmentDragAvailability } from '@/app/features/appointments/components/Calendar/useAppointmentDragAvailability';
import {
  useAppointmentDragAutoScroll,
  useDragAutoScrollSuppression,
} from '@/app/features/appointments/components/Calendar/useAppointmentDragAutoScroll';
import { useAppointmentMove } from '@/app/features/appointments/components/Calendar/useAppointmentMove';
import {
  DragAction,
  DragContext,
  dragReducer,
  getAppointmentDragLabel,
  getAppointmentDurationMinutes,
  initialDragState,
  normalizeCalendarDragId,
  resolvePractitionerIdFromTeams,
  teamSupportsSpeciality,
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

const useCalendarDragTeamHelpers = (
  teams: ReturnType<typeof useTeamForPrimaryOrg>,
  canEditAppointments: boolean
) => {
  const normalizeId = useCallback((value?: string) => normalizeCalendarDragId(value), []);

  const isAppointmentDraggable = useCallback(
    (appointment: Appointment) =>
      !!appointment.id && canEditAppointments && allowCalendarDrag(appointment.status),
    [canEditAppointments]
  );

  const resolvePractitionerId = useCallback(
    (candidateId?: string) => resolvePractitionerIdFromTeams(teams, candidateId),
    [teams]
  );

  const supportsSpeciality = useCallback(
    (targetLeadId: string, appointment: Appointment) =>
      teamSupportsSpeciality(teams, targetLeadId, appointment),
    [teams]
  );

  return { isAppointmentDraggable, normalizeId, resolvePractitionerId, supportsSpeciality };
};

type UseAppointmentDragHandlersOptions = {
  clearDragAvailability: () => void;
  dispatchDrag: Dispatch<DragAction>;
  dragContextRef: MutableRefObject<DragContext | null>;
  ensureDragAvailability: (date: Date, targetLeadId?: string) => Promise<number[]>;
  isAppointmentDraggable: (appointment: Appointment) => boolean;
  markDropped: () => void;
  moveAppointment: (date: Date, minute: number, targetLeadId?: string) => Promise<void>;
  prefetchDragAvailabilityForView: () => void;
};

const useAppointmentDragHandlers = ({
  clearDragAvailability,
  dispatchDrag,
  dragContextRef,
  ensureDragAvailability,
  isAppointmentDraggable,
  markDropped,
  moveAppointment,
  prefetchDragAvailabilityForView,
}: UseAppointmentDragHandlersOptions) => {
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
    [
      clearDragAvailability,
      dispatchDrag,
      dragContextRef,
      isAppointmentDraggable,
      prefetchDragAvailabilityForView,
    ]
  );

  const handleAppointmentDragEnd = useCallback(() => {
    dragContextRef.current = null;
    dispatchDrag({ type: 'end' });
  }, [dispatchDrag, dragContextRef]);

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
    handleAppointmentDragEnd,
    handleAppointmentDragStart,
    handleAppointmentDropAt,
    handleDragHoverTarget,
  };
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
  const dragContextRef = useRef<DragContext | null>(null);

  const { isAppointmentDraggable, normalizeId, resolvePractitionerId, supportsSpeciality } =
    useCalendarDragTeamHelpers(teams, canEditAppointments);

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

  const { markDropped, suppressAutoScroll } = useDragAutoScrollSuppression();

  const { moveAppointment } = useAppointmentMove({
    allAppointments,
    appointmentId: dragState.appointmentId,
    buildAppointmentStartFromCalendarMinutes,
    dispatchDrag,
    ensureDragAvailability,
    isAppointmentDraggable,
    normalizeId,
    notify,
    resolvePractitionerId,
    supportsSpeciality,
    teams,
  });

  const {
    handleAppointmentDragEnd,
    handleAppointmentDragStart,
    handleAppointmentDropAt,
    handleDragHoverTarget,
  } = useAppointmentDragHandlers({
    clearDragAvailability,
    dispatchDrag,
    dragContextRef,
    ensureDragAvailability,
    isAppointmentDraggable,
    markDropped,
    moveAppointment,
    prefetchDragAvailabilityForView,
  });

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
