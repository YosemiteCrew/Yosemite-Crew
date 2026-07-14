import React, { useCallback, useMemo, useState } from 'react';
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
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useAuthStore } from '@/app/stores/authStore';
import { useNotify } from '@/app/hooks/useNotify';
import { filterAppointmentsForWeek } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { useAppointmentCalendarDrag } from '@/app/features/appointments/components/Calendar/useAppointmentCalendarDrag';
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

const AppointmentCalendar = ({
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
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
  const teams = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const {
    availabilityLoaded,
    dragContext,
    draggedAppointmentId,
    draggedAppointmentLabel,
    dragError,
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
    skipAutoScroll,
  } = useAppointmentCalendarDrag({
    activeCalendar,
    allAppointments,
    authUserId,
    canEditAppointments,
    currentDate,
    notify,
    teams,
    weekStart,
  });

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
          ? resolvePractitionerId(targetLeadId)
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
      resolvePractitionerId,
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

  const appointmentActionProps = {
    handleViewAppointment,
    handleOpenWorkspace: onOpenWorkspace,
    handleRescheduleAppointment,
    handleChangeRoomAppointment,
    handleAcceptAppointment,
    canEditAppointments,
  };

  const appointmentDragProps = {
    draggedAppointmentId,
    draggedAppointmentLabel,
    canDragAppointment: isAppointmentDraggable,
    onAppointmentDragStart: handleAppointmentDragStart,
    onAppointmentDragEnd: handleAppointmentDragEnd,
    onDragHoverTarget: handleDragHoverTarget,
    getDropAvailabilityIntervals,
    getVisibleAvailabilityIntervals: getCurrentUserViewAvailabilityIntervals,
    availabilityLoaded,
    draggedAppointmentDurationMinutes: dragContext?.durationMinutes,
    onAppointmentDropAt: handleAppointmentDropAt,
    onCreateAppointmentAt: handleCreateFromCalendarSlot,
    slotStepMinutes: 15,
    skipAutoScroll,
  };

  return (
    <div className="h-full min-h-0 border border-card-border rounded-2xl overflow-hidden w-full flex flex-col">
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
          {...appointmentActionProps}
          {...appointmentDragProps}
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          handleDetailAppointment={handleViewAppointment}
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          {...appointmentActionProps}
          {...appointmentDragProps}
          events={weekEvents}
          zoomMode={zoomMode}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          {...appointmentActionProps}
          {...appointmentDragProps}
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          forceFullDayInZoomIn
          setCurrentDate={setCurrentDate}
          getVisibleAvailabilityIntervals={getViewAvailabilityIntervals}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
