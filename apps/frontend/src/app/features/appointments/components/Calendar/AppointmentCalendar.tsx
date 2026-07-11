import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DayCalendar from '@/app/features/appointments/components/Calendar/common/DayCalendar';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import WeekCalendar from '@/app/features/appointments/components/Calendar/common/WeekCalendar';
import { Appointment } from '@yosemite-crew/types';
import UserCalendar from '@/app/features/appointments/components/Calendar/common/UserCalendar';
import {
  AppointmentViewIntent,
  AppointmentDraftPrefill,
} from '@/app/features/appointments/types/calendar';
import { allowCalendarDrag, canAssignAppointmentRoom } from '@/app/lib/appointments';
import { updateAppointment } from '@/app/features/appointments/services/appointmentService';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useLoadAvailabilities } from '@/app/hooks/useAvailabiities';
import { useNotify } from '@/app/hooks/useNotify';
import {
  DropAvailabilityInterval,
  filterAppointmentsForWeek,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import {
  DragUiState,
  INITIAL_DRAG_UI,
  buildAppointmentStartFromCalendarMinutes,
  clampMinutes,
  findCurrentUserPractitionerId,
  getErrorMessageFromCandidate,
  hasAppointmentConflict,
  normalizeId,
  resolvePractitionerId,
  resolveViewAvailabilityIntervals,
  supportsSpeciality,
} from './appointmentCalendarHelpers';
import { useDragAvailability, useDragEdgeAutoScroll } from './useDragAvailability';
type AppointmentCalendarProps = {
  filteredList: Appointment[];
  allAppointments: Appointment[];
  setActiveAppointment?: (inventory: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  setDetailPopup?: (open: boolean) => void;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<AppointmentStatus | null>>;
  setChangeRoomPopup?: (open: boolean) => void;
  onOpenWorkspace?: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  activeCalendar: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
  canEditAppointments: boolean;
  onCreateFromCalendarSlot?: (prefill: AppointmentDraftPrefill) => void;
  onAddAppointment?: () => void;
  activeFilter?: string;
  setActiveFilter?: (v: string) => void;
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
  hasEmergency?: boolean;
  filterOptions?: { key: string; name: string }[];
  statusOptions?: { key: string; name: string; bg?: string; text?: string; border?: string }[];
};

type DragAvailabilityPrefetchTarget = {
  date: Date;
  targetLeadId?: string;
};

const useAppointmentCalendarView = ({
  filteredList,
  allAppointments,
  setActiveAppointment,
  setViewPopup,
  setDetailPopup,
  setViewIntent,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setChangeRoomPopup,
  onOpenWorkspace,
  activeCalendar,
  setActiveCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  setReschedulePopup,
  canEditAppointments,
  onCreateFromCalendarSlot,
  onAddAppointment,
  activeFilter,
  setActiveFilter,
  activeStatus,
  setActiveStatus,
  hasEmergency,
  filterOptions,
  statusOptions,
}: AppointmentCalendarProps) => {
  const { notify } = useNotify();
  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    return getErrorMessageFromCandidate(
      error as { response?: { data?: unknown } } | { data?: unknown } | { message?: string },
      fallback
    );
  }, []);

  const [dragUi, setDragUi] = useState<DragUiState>(INITIAL_DRAG_UI);
  const { draggedAppointmentId, draggedAppointmentLabel, dragError, dragContext } = dragUi;
  const setDragError = (message: string | null) =>
    setDragUi((ui) => ({ ...ui, dragError: message }));
  const [suppressAutoScroll, setSuppressAutoScroll] = useState(false);
  const suppressAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamAvailabilityFetchedRef = useRef<string | null>(null);
  const teams = useTeamForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const availabilityLoaded = availabilityStatus === 'loaded';
  useLoadAvailabilities();

  const {
    availabilityVersion,
    resetDragAvailability,
    ensureDragAvailability,
    getDropAvailabilityIntervals,
  } = useDragAvailability({ dragContext, allAppointments, teams });

  const beginAppointmentDrag = (appointment: Appointment) => {
    if (!isAppointmentDraggable(appointment)) return;
    resetDragAvailability();
    setDragUi({
      draggedAppointmentId: appointment.id ?? null,
      draggedAppointmentLabel: formatCompanionNameWithOwnerLastName(
        appointment.companion?.name,
        appointment.companion?.parent,
        'Appointment'
      ),
      dragError: null,
      dragContext: {
        appointmentId: appointment.id ?? '',
        serviceId: appointment.appointmentType?.id,
        durationMinutes: Math.max(
          5,
          Math.round(
            (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) /
              60000
          )
        ),
      },
    });
  };
  const endAppointmentDrag = () =>
    setDragUi((ui) => ({
      ...ui,
      draggedAppointmentId: null,
      draggedAppointmentLabel: null,
      dragContext: null,
    }));

  const markDropped = () => {
    if (suppressAutoScrollTimerRef.current) clearTimeout(suppressAutoScrollTimerRef.current);
    setSuppressAutoScroll(true);
    suppressAutoScrollTimerRef.current = setTimeout(() => setSuppressAutoScroll(false), 4000);
  };
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');

  useEffect(() => {
    if (activeCalendar === 'team' && primaryOrgId) {
      const fetchKey = primaryOrgId;
      if (teamAvailabilityFetchedRef.current === fetchKey) return;
      teamAvailabilityFetchedRef.current = fetchKey;
      loadTeamAvailability(primaryOrgId).catch(() => {
        teamAvailabilityFetchedRef.current = null;
      });
    }
  }, [activeCalendar, primaryOrgId]);

  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const isAppointmentDraggable = (appointment: Appointment) =>
    !!appointment.id && canEditAppointments && allowCalendarDrag(appointment.status);

  const getCurrentUserPractitionerId = useCallback(
    () => findCurrentUserPractitionerId(teams, authUserId),
    [authUserId, teams]
  );

  const moveAppointment = async (
    date: Date,
    minutesSinceMidnight: number,
    targetLeadId?: string
  ) => {
    const warnDrag = (message: string) => {
      setDragError(message);
      notify('warning', { title: 'Move blocked', text: message });
    };

    if (!draggedAppointmentId) return;
    const appointment = allAppointments.find((item) => item.id === draggedAppointmentId);
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
    const targetPractitionerId = resolvePractitionerId(teams, targetLeadId || appointment.lead?.id);

    if (nextStart.getTime() < Date.now()) {
      warnDrag('Cannot move an appointment to a past time.');
      return;
    }
    if (targetLeadId && !supportsSpeciality(teams, targetLeadId, appointment)) {
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
      hasAppointmentConflict(appointment, nextStart, nextEnd, allAppointments, targetPractitionerId)
    ) {
      warnDrag('Scheduling conflict detected with another appointment.');
      return;
    }

    try {
      setDragError(null);
      await updateAppointment({
        ...appointment,
        lead: targetPractitionerId
          ? {
              id: targetPractitionerId,
              name:
                teams.find(
                  (member) =>
                    normalizeId(member.practionerId || '') === normalizeId(targetPractitionerId) ||
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
      setDragError(getErrorMessage(error, 'Unable to update appointment. Please try again.'));
    }
  };

  const getViewAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] =>
      resolveViewAvailabilityIntervals({
        date,
        targetLeadId,
        primaryOrgId,
        availabilityIdsByOrgId,
        availabilitiesById,
        teams,
      }),
    [availabilityIdsByOrgId, availabilitiesById, primaryOrgId, teams]
  );

  const getCurrentUserViewAvailabilityIntervals = useCallback(
    (date: Date): DropAvailabilityInterval[] =>
      getViewAvailabilityIntervals(date, getCurrentUserPractitionerId() || authUserId),
    [authUserId, getCurrentUserPractitionerId, getViewAvailabilityIntervals]
  );

  const dragAvailabilityPrefetchTargets = useMemo<DragAvailabilityPrefetchTarget[]>(() => {
    if (!dragContext) return [];
    if (activeCalendar === 'day') return [{ date: currentDate }];
    if (activeCalendar === 'week') return getWeekDays(weekStart).map((date) => ({ date }));
    if (activeCalendar === 'team') {
      return (teams || []).map((member) => ({
        date: currentDate,
        targetLeadId: member.practionerId || member._id,
      }));
    }
    return [];
  }, [activeCalendar, currentDate, dragContext, teams, weekStart]);

  useEffect(() => {
    Promise.all(
      dragAvailabilityPrefetchTargets.map((target) =>
        ensureDragAvailability(target.date, target.targetLeadId)
      )
    ).catch(() => undefined);
  }, [dragAvailabilityPrefetchTargets, ensureDragAvailability]);

  useDragEdgeAutoScroll(draggedAppointmentId, availabilityVersion);

  const handleViewAppointment = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    if (setViewPopup) {
      setViewPopup(true);
      return;
    }
    setDetailPopup?.(true);
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    if (!allowCalendarDrag(appointment.status)) {
      notify('warning', {
        title: 'Reschedule blocked',
        text: 'Only requested and upcoming appointments can be rescheduled.',
      });
      return;
    }
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const handleAcceptAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeStatusPreferredStatus?.('UPCOMING');
    setChangeStatusPopup?.(true);
  };

  const handleChangeRoomAppointment = (appointment: Appointment) => {
    if (!canAssignAppointmentRoom(appointment.status)) {
      notify('warning', {
        title: 'Room update blocked',
        text: 'Room can only be changed for upcoming, checked-in, or in-progress appointments.',
      });
      return;
    }
    setActiveAppointment?.(appointment);
    setChangeRoomPopup?.(true);
  };

  const handleCreateFromCalendarSlot = useCallback(
    (date: Date, minuteOfDay: number, targetLeadId?: string) => {
      if (!onCreateFromCalendarSlot || !canEditAppointments) return;
      const defaultLeadId =
        activeCalendar === 'team'
          ? resolvePractitionerId(teams, targetLeadId)
          : getCurrentUserPractitionerId();
      onCreateFromCalendarSlot({
        date,
        minuteOfDay,
        leadId: defaultLeadId,
      });
    },
    [
      activeCalendar,
      canEditAppointments,
      getCurrentUserPractitionerId,
      onCreateFromCalendarSlot,
      teams,
    ]
  );

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isOnPreferredTimeZoneCalendarDay(event.startTime, currentDate)
      ),
    [filteredList, currentDate]
  );

  const weekEvents = useMemo(
    () => filterAppointmentsForWeek(filteredList, weekStart),
    [filteredList, weekStart]
  );

  const handleDragHoverTarget = (dropDate: Date, targetLeadId?: string) => {
    ensureDragAvailability(dropDate, targetLeadId).catch(() => undefined);
  };

  const handleAppointmentDropAt = (dropDate: Date, minute: number, targetLeadId?: string) => {
    markDropped();
    moveAppointment(dropDate, minute, targetLeadId).catch(() => undefined);
    endAppointmentDrag();
  };

  const sharedCalendarProps = {
    zoomMode,
    handleViewAppointment,
    handleOpenWorkspace: onOpenWorkspace,
    handleRescheduleAppointment,
    handleChangeRoomAppointment,
    handleAcceptAppointment,
    setCurrentDate,
    canEditAppointments,
    draggedAppointmentId,
    draggedAppointmentLabel,
    canDragAppointment: isAppointmentDraggable,
    onAppointmentDragStart: beginAppointmentDrag,
    onAppointmentDragEnd: endAppointmentDrag,
    onDragHoverTarget: handleDragHoverTarget,
    getDropAvailabilityIntervals,
    availabilityLoaded,
    draggedAppointmentDurationMinutes: dragContext?.durationMinutes,
    onAppointmentDropAt: handleAppointmentDropAt,
    onCreateAppointmentAt: handleCreateFromCalendarSlot,
    slotStepMinutes: 15,
    skipAutoScroll: suppressAutoScroll,
  };

  return (
    <div className="h-full min-h-0 border border-grey-light rounded-2xl overflow-hidden w-full flex flex-col">
      <Header
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        zoomMode={zoomMode}
        setZoomMode={setZoomMode}
        activeCalendar={activeCalendar}
        setActiveCalendar={setActiveCalendar}
        showAddButton={canEditAppointments}
        onAddButtonClick={onAddAppointment}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        activeStatus={activeStatus}
        setActiveStatus={setActiveStatus}
        hasEmergency={hasEmergency}
        filterOptions={filterOptions}
        statusOptions={statusOptions}
      />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          {...sharedCalendarProps}
          events={dayEvents}
          date={currentDate}
          handleDetailAppointment={handleViewAppointment}
          getVisibleAvailabilityIntervals={getCurrentUserViewAvailabilityIntervals}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          {...sharedCalendarProps}
          events={weekEvents}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          getVisibleAvailabilityIntervals={getCurrentUserViewAvailabilityIntervals}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          {...sharedCalendarProps}
          events={dayEvents}
          date={currentDate}
          forceFullDayInZoomIn
          getVisibleAvailabilityIntervals={getViewAvailabilityIntervals}
        />
      )}
    </div>
  );
};

const AppointmentCalendar = (props: AppointmentCalendarProps) => useAppointmentCalendarView(props);

export default AppointmentCalendar;
