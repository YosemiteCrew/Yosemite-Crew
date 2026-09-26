import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import PhoneCalendar from '@/app/features/appointments/components/Calendar/responsive/PhoneCalendar';
import useIsTabletCalendar from '@/app/features/appointments/components/Calendar/responsive/useIsTabletCalendar';
import TabletCalendarTitleBand from '@/app/features/appointments/components/Calendar/responsive/TabletCalendarTitleBand';
import CalendarBlocksPanel from '@/app/features/appointments/components/Calendar/CalendarBlocksPanel';
import {
  createCalendarBlock,
  deleteCalendarBlock,
  fetchCalendarBlocks,
  updateCalendarBlock,
  type CalendarBlock,
  type CalendarBlockInput,
} from '@/app/features/appointments/services/calendarBlockService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
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
  const isPhone = useIsPhone();
  const isTablet = useIsTabletCalendar();
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
  const [calendarBlockState, setCalendarBlockState] = useState<{
    organisationId: string | null;
    blocks: CalendarBlock[];
  }>({ organisationId: null, blocks: [] });
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const calendarBlocks =
    calendarBlockState.organisationId === primaryOrgId ? calendarBlockState.blocks : [];
  const updateCalendarBlocks = useCallback(
    (update: (blocks: CalendarBlock[]) => CalendarBlock[]) => {
      if (!primaryOrgId) return;
      setCalendarBlockState((current) => ({
        organisationId: primaryOrgId,
        blocks: update(current.organisationId === primaryOrgId ? current.blocks : []),
      }));
    },
    [primaryOrgId]
  );
  const teams = useTeamForPrimaryOrg();
  const rooms = useRoomsForPrimaryOrg();
  useLoadRoomsForPrimaryOrg();
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

  const blockRange = useMemo(() => {
    const start = new Date(activeCalendar === 'week' ? weekStart : currentDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 9);
    return { from: start, to: end };
  }, [activeCalendar, currentDate, weekStart]);

  useEffect(() => {
    if (!primaryOrgId) {
      return;
    }
    let current = true;
    void fetchCalendarBlocks(primaryOrgId, blockRange.from, blockRange.to)
      .then((blocks) => {
        if (current) updateCalendarBlocks(() => blocks);
      })
      .catch(() => {
        if (current)
          notify('warning', {
            title: 'Calendar blocks unavailable',
            text: 'Try reloading the calendar.',
          });
      });
    return () => {
      current = false;
    };
  }, [blockRange, notify, primaryOrgId, updateCalendarBlocks]);

  const handleSaveCalendarBlock = useCallback(
    async (id: string | null, input: CalendarBlockInput) => {
      if (!primaryOrgId) throw new Error('No organisation selected');
      const saved = id
        ? await updateCalendarBlock(primaryOrgId, id, input)
        : await createCalendarBlock(primaryOrgId, input);
      updateCalendarBlocks((blocks) =>
        id ? blocks.map((block) => (block.id === id ? saved : block)) : [...blocks, saved]
      );
    },
    [primaryOrgId, updateCalendarBlocks]
  );

  const handleDeleteCalendarBlock = useCallback(
    async (id: string) => {
      if (!primaryOrgId) return;
      await deleteCalendarBlock(primaryOrgId, id);
      updateCalendarBlocks((blocks) => blocks.filter((block) => block.id !== id));
    },
    [primaryOrgId, updateCalendarBlocks]
  );

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

  // Phones get purpose-built views instead of a shrunken time grid; the desktop
  // header and grids are not rendered at all below 768px.
  if (isPhone) {
    return (
      <div className="h-full min-h-0 w-full overflow-hidden rounded-2xl border border-card-border">
        <PhoneCalendar
          appointments={filteredList}
          dayEvents={dayEvents}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          activeCalendar={activeCalendar}
          setActiveCalendar={setActiveCalendar}
          onSelectAppointment={handleViewAppointment}
          onOpenWorkspace={onOpenWorkspace}
          onCreateFromCalendarSlot={onCreateFromCalendarSlot}
          canEditAppointments={canEditAppointments}
          currentUserPractitionerId={getCurrentUserPractitionerId() ?? ''}
        />
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 w-full flex flex-col overflow-hidden rounded-[18px] border"
      style={{
        borderColor: 'var(--hairline)',
        backgroundColor: 'var(--screen)',
        boxShadow: '0 1px 2px var(--sh03), 0 8px 22px var(--sh05)',
      }}
    >
      <Header
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        setWeekStart={setWeekStart}
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
      <CalendarBlocksPanel
        blocks={calendarBlocks}
        teams={teams}
        rooms={rooms}
        canEdit={canEditAppointments}
        onSave={handleSaveCalendarBlock}
        onDelete={handleDeleteCalendarBlock}
      />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {/* The tablet frame names the visible period above the grid and carries
          the status legend there; desktop keeps the header alone. */}
      {isTablet ? (
        <TabletCalendarTitleBand
          activeCalendar={activeCalendar}
          currentDate={currentDate}
          weekStart={weekStart}
          appointmentCount={activeCalendar === 'week' ? weekEvents.length : dayEvents.length}
        />
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          {...appointmentActionProps}
          {...appointmentDragProps}
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          handleDetailAppointment={handleViewAppointment}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          {...appointmentActionProps}
          {...appointmentDragProps}
          events={weekEvents}
          zoomMode={zoomMode}
          weekStart={weekStart}
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
          getVisibleAvailabilityIntervals={getViewAvailabilityIntervals}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
