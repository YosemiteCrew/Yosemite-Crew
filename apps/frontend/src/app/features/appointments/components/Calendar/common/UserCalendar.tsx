import React, { useMemo, useRef } from 'react';
import {
  computeUnavailableSegments,
  appointentsForUser,
  getNowTopPxForHourRange,
} from '@/app/features/appointments/components/Calendar/helpers';
import {
  eventsForDayHour,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import CalendarDayHeader from '@/app/features/appointments/components/Calendar/common/CalendarDayHeader';
import Slot from '@/app/features/appointments/components/Calendar/common/Slot';
import { Appointment } from '@yosemite-crew/types';
import { useCalendarNavigation } from '@/app/hooks/useCalendarNavigation';
import {
  CalendarZoomMode,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import CalendarHourLabel from '@/app/features/appointments/components/Calendar/common/CalendarHourLabel';
import {
  getMinutesSinceStartOfDayInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import NowIndicator from '@/app/features/appointments/components/Calendar/common/NowIndicator';
import SlotGridLines from '@/app/features/appointments/components/Calendar/common/SlotGridLines';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import {
  getVisibleHourRange,
  getVisibleHours,
  useCalendarAutoScroll,
  useSlotOffsetMinutes,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';

type UserCalendarProps = {
  events: Appointment[];
  date: Date;
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: any;
  handleChangeStatusAppointment?: any;
  handleChangeRoomAppointment?: any;
  canEditAppointments: boolean;
  draggedAppointmentId?: string | null;
  draggedAppointmentLabel?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onAppointmentDropAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  onDragHoverTarget?: (date: Date, targetLeadId?: string) => void;
  onCreateAppointmentAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  getDropAvailabilityIntervals?: (
    date: Date,
    targetLeadId?: string
  ) => Array<{ startMinute: number; endMinute: number }>;
  getVisibleAvailabilityIntervals?: (
    date: Date,
    targetLeadId?: string
  ) => Array<{ startMinute: number; endMinute: number }>;
  draggedAppointmentDurationMinutes?: number;
  forceFullDayInZoomIn?: boolean;
  slotStepMinutes?: number;
  availabilityLoaded?: boolean;
};

const UserCalendar: React.FC<UserCalendarProps> = ({
  events,
  date,
  zoomMode = 'in',
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  handleChangeRoomAppointment,
  setCurrentDate,
  canEditAppointments,
  draggedAppointmentId,
  draggedAppointmentLabel,
  canDragAppointment,
  onAppointmentDragStart,
  onAppointmentDragEnd,
  onAppointmentDropAt,
  onDragHoverTarget,
  onCreateAppointmentAt,
  getDropAvailabilityIntervals,
  getVisibleAvailabilityIntervals,
  draggedAppointmentDurationMinutes,
  forceFullDayInZoomIn = false,
  slotStepMinutes = 15,
  availabilityLoaded = false,
}) => {
  const HOUR_ROW_TOP_OFFSET_PX = 8;
  const team = useTeamForPrimaryOrg();
  const now = useCalendarNow();
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const height = getHourRowHeightPx(zoomMode);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const teamColumnsStyle = useMemo(
    () => getCalendarColumnGridStyle(team.length, zoomMode === 'out' ? 108 : 170),
    [team.length, zoomMode]
  );
  const weekday = formatDateInPreferredTimeZone(date, { weekday: 'short' });
  const dateNumber = formatDateInPreferredTimeZone(date, { day: 'numeric' });

  const visibleHourRange = useMemo(() => {
    const minutes: number[] = [];
    team.forEach((member) => {
      const availability =
        getVisibleAvailabilityIntervals?.(date, member.practionerId || member._id) ?? [];
      availability.forEach((interval) => {
        minutes.push(interval.startMinute, interval.endMinute);
      });
    });
    events.forEach((event) => {
      minutes.push(
        getMinutesSinceStartOfDayInPreferredTimeZone(event.startTime),
        getMinutesSinceStartOfDayInPreferredTimeZone(event.endTime)
      );
    });

    return getVisibleHourRange(zoomMode, minutes, {
      forceFullDay: forceFullDayInZoomIn,
      endHour: HOURS_IN_DAY - 1,
    });
  }, [date, events, forceFullDayInZoomIn, getVisibleAvailabilityIntervals, team, zoomMode]);

  const visibleHours = useMemo(() => getVisibleHours(visibleHourRange), [visibleHourRange]);
  const lastVisibleHour = visibleHours.at(-1) ?? visibleHourRange.endHour;

  const nowPosition = useMemo(() => {
    if (!isOnPreferredTimeZoneCalendarDay(now, date)) return null;
    const topPx = getNowTopPxForHourRange(
      date,
      visibleHourRange.startHour,
      visibleHourRange.endHour,
      height,
      now,
      HOUR_ROW_TOP_OFFSET_PX
    );
    if (topPx == null) return null;
    return { topPx };
  }, [date, height, now, visibleHourRange.endHour, visibleHourRange.startHour]);
  const nowTimeLabel = useMemo(
    () =>
      nowPosition
        ? formatDateInPreferredTimeZone(now, { hour: 'numeric', minute: '2-digit' })
        : null,
    [now, nowPosition]
  );
  const unavailableByMember = useMemo(
    () =>
      team.map((user) => {
        const visible =
          getVisibleAvailabilityIntervals?.(date, user.practionerId || user._id) ?? [];
        return computeUnavailableSegments(
          visible,
          visibleHourRange.startHour,
          visibleHourRange.endHour,
          availabilityLoaded
        );
      }),
    [availabilityLoaded, date, getVisibleAvailabilityIntervals, team, visibleHourRange]
  );

  const { slotOffsetMinutes, showSlotTimeLabels } = useSlotOffsetMinutes(slotStepMinutes, zoomMode);

  useCalendarAutoScroll({
    date,
    events,
    height,
    nowPosition,
    scrollContainer: scrollRef.current,
    skip: !!draggedAppointmentId,
    focusStartHour: visibleHourRange.startHour,
    hourRowTopOffsetPx: HOUR_ROW_TOP_OFFSET_PX,
  });

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative rounded-b-2xl"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col">
          <CalendarDayHeader
            weekday={weekday}
            dateNumber={dateNumber}
            team={team}
            teamColumnsStyle={teamColumnsStyle}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
          />

          <div
            ref={scrollRef}
            className="relative flex-1 min-h-0"
            style={{
              height: '100%',
              maxHeight: '100%',
              minHeight: 0,
              overflowY: 'auto',
              paddingBottom: zoomMode === 'out' ? 30 : 40,
              paddingTop: 12,
            }}
            data-calendar-scroll="true"
          >
            <div className="relative pt-2 pb-4">
              {visibleHours.map((hour) => (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <CalendarHourLabel
                    hour={hour}
                    height={height}
                    slotOffsetMinutes={slotOffsetMinutes}
                    showSlotTimeLabels={showSlotTimeLabels}
                    className="sticky left-0 z-20 bg-white"
                  />
                  <div className="grid min-w-max" style={teamColumnsStyle}>
                    {team?.map((user, index) => {
                      const slotEvents = eventsForDayHour(
                        appointentsForUser(events, user),
                        date,
                        hour
                      );
                      const hourStart = hour * 60;
                      const hourEnd = hourStart + 60;
                      return (
                        <div
                          key={`${user._id}-${hour}`}
                          className="relative"
                          style={{ height: `${height}px` }}
                        >
                          {unavailableByMember[index]
                            .filter((seg) => seg.endMinute > hourStart && seg.startMinute < hourEnd)
                            .map((seg) => {
                              const clampedStart = Math.max(seg.startMinute, hourStart);
                              const clampedEnd = Math.min(seg.endMinute, hourEnd);
                              const topPct = ((clampedStart - hourStart) / 60) * 100;
                              const heightPct = ((clampedEnd - clampedStart) / 60) * 100;
                              return (
                                <div
                                  key={`unavail-${user._id}-${hour}-${seg.startMinute}`}
                                  className="pointer-events-none absolute left-0 right-0 z-1"
                                  style={{
                                    top: `${topPct}%`,
                                    height: `${heightPct}%`,
                                    backgroundColor: 'rgba(0,0,0,0.045)',
                                  }}
                                />
                              );
                            })}
                          <Slot
                            slotEvents={slotEvents}
                            height={height}
                            zoomMode={zoomMode}
                            dayIndex={index}
                            handleViewAppointment={handleViewAppointment}
                            handleRescheduleAppointment={handleRescheduleAppointment}
                            handleChangeStatusAppointment={handleChangeStatusAppointment}
                            handleChangeRoomAppointment={handleChangeRoomAppointment}
                            length={team.length - 1}
                            canEditAppointments={canEditAppointments}
                            draggedAppointmentId={draggedAppointmentId}
                            draggedAppointmentLabel={draggedAppointmentLabel}
                            canDragAppointment={canDragAppointment}
                            onAppointmentDragStart={onAppointmentDragStart}
                            onAppointmentDragEnd={onAppointmentDragEnd}
                            onAppointmentDropAt={onAppointmentDropAt}
                            onDragHoverTarget={onDragHoverTarget}
                            onCreateAppointmentAt={onCreateAppointmentAt}
                            dropAvailabilityIntervals={
                              getDropAvailabilityIntervals?.(date, user.practionerId || user._id) ??
                              []
                            }
                            unavailableSegments={unavailableByMember[index]}
                            draggedAppointmentDurationMinutes={draggedAppointmentDurationMinutes}
                            dropDate={date}
                            dropHour={hour}
                            dropPractitionerId={user.practionerId || user._id}
                            invoicesByAppointmentId={invoicesByAppointmentId}
                          />
                          <SlotGridLines
                            userId={user._id}
                            hour={hour}
                            lastVisibleHour={lastVisibleHour}
                            slotOffsetMinutes={slotOffsetMinutes}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-20 bg-white" style={{ height: height + 'px' }} />
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />
              {nowPosition && <NowIndicator topPx={nowPosition.topPx} timeLabel={nowTimeLabel} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
