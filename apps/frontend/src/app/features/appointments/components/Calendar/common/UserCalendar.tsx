import React, { useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  appointentsForUser,
  getFirstRelevantTimedEventStart,
  getNowTopPxForHourRange,
  nextDay,
  scrollContainerToTarget,
  startOfDayDate,
} from '@/app/features/appointments/components/Calendar/helpers';
import {
  eventsForDayHour,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import Slot from '@/app/features/appointments/components/Calendar/common/Slot';
import { Appointment } from '@yosemite-crew/types';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useCalendarNavigation } from '@/app/hooks/useCalendarNavigation';
import {
  CalendarZoomMode,
  formatHourLabel,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  getMinutesSinceStartOfDayInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';

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
    if (zoomMode === 'out' || forceFullDayInZoomIn)
      return { startHour: 0, endHour: HOURS_IN_DAY - 1 };

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

    if (!minutes.length) return { startHour: 0, endHour: HOURS_IN_DAY - 1 };

    const minMinute = Math.max(0, Math.min(...minutes) - 30);
    const maxMinute = Math.min(24 * 60 - 1, Math.max(...minutes) + 30);
    const startHour = Math.max(0, Math.floor(minMinute / 60));
    const endHour = Math.min(23, Math.ceil(maxMinute / 60));
    return { startHour, endHour: Math.max(startHour + 2, endHour) };
  }, [date, events, forceFullDayInZoomIn, getVisibleAvailabilityIntervals, team, zoomMode]);

  const visibleHours = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, visibleHourRange.endHour - visibleHourRange.startHour + 1) },
        (_, i) => visibleHourRange.startHour + i
      ),
    [visibleHourRange.endHour, visibleHourRange.startHour]
  );
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
  const nowTimeLabel = useMemo(() => {
    if (!nowPosition) return null;
    return formatDateInPreferredTimeZone(now, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [now, nowPosition]);
  const slotOffsetMinutes = useMemo(() => {
    const step = Math.max(5, Math.round(slotStepMinutes || 15));
    if (step >= 60) return [];
    const offsets: number[] = [];
    for (let minute = step; minute < 60; minute += step) {
      offsets.push(minute);
    }
    return offsets;
  }, [slotStepMinutes]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const rangeStart = startOfDayDate(date);
    const rangeEnd = nextDay(date);
    const focusStart = getFirstRelevantTimedEventStart(events, rangeStart, rangeEnd);
    const focusMinutes = focusStart
      ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : ((focusMinutes - visibleHourRange.startHour * 60) / 60) * height + HOUR_ROW_TOP_OFFSET_PX;
    scrollContainerToTarget(scrollRef.current, topPx);
  }, [date, events, height, nowPosition, visibleHourRange.startHour]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative rounded-b-2xl"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col">
          <div className="grid border-b border-grey-light py-2 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
            <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
              <Back onClick={handlePrevDay} />
            </div>
            <div className="bg-white min-w-max flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="text-body-4 text-text-brand">{weekday}</div>
                <div className="text-body-4-emphasis text-white h-8 w-8 flex items-center justify-center rounded-full bg-text-brand">
                  {dateNumber}
                </div>
              </div>
              <UserLabels team={team} columnsStyle={teamColumnsStyle} />
            </div>
            <div className="sticky right-0 z-30 bg-white flex items-center justify-center">
              <Next onClick={handleNextDay} />
            </div>
          </div>

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
                  <div
                    className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2! relative"
                    style={{ height: height + 'px' }}
                  >
                    <span className="absolute top-0 -translate-y-1/2">{formatHourLabel(hour)}</span>
                  </div>
                  <div className="grid min-w-max" style={teamColumnsStyle}>
                    {team?.map((user, index) => {
                      const slotEvents = eventsForDayHour(
                        appointentsForUser(events, user),
                        date,
                        hour
                      );
                      return (
                        <div
                          key={`${user._id}-${hour}`}
                          className="relative"
                          style={{ height: `${height}px` }}
                        >
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
                            draggedAppointmentDurationMinutes={draggedAppointmentDurationMinutes}
                            dropDate={date}
                            dropHour={hour}
                            dropPractitionerId={user.practionerId || user._id}
                            invoicesByAppointmentId={invoicesByAppointmentId}
                          />
                          <div className="pointer-events-none absolute inset-0 z-10">
                            <div className="absolute inset-x-0 top-0 border-t border-[#C3CEDC]" />
                            {slotOffsetMinutes.map((minute) => (
                              <div
                                key={`${user._id}-${hour}-slot-${minute}`}
                                className="absolute inset-x-0 border-t border-[#E9EDF3]"
                                style={{
                                  top: `${(minute / 60) * 100}%`,
                                }}
                              />
                            ))}
                            {hour === lastVisibleHour && (
                              <div className="absolute inset-x-0 top-full border-t border-[#C3CEDC]" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-20 bg-white" style={{ height: height + 'px' }} />
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />
              {nowPosition && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                    <div />
                    <div className="relative">
                      <div
                        className="absolute left-0 right-2 z-20"
                        style={{
                          top: nowPosition.topPx,
                        }}
                      >
                        {nowTimeLabel && (
                          <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-red-500 whitespace-nowrap">
                            {nowTimeLabel}
                          </div>
                        )}
                        <div className="absolute -left-[12px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
                        <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
                      </div>
                    </div>
                    <div />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
