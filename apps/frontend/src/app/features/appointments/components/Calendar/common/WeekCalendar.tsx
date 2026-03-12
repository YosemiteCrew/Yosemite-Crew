import React, { useEffect, useMemo, useRef } from 'react';
import {
  eventsForDayHour,
  getNextWeek,
  getPrevWeek,
  getWeekDays,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  getFirstRelevantTimedEventStart,
  getNowTopPxForHourRange,
  isAllDayForDate,
  nextDay,
  scrollContainerToTarget,
} from '@/app/features/appointments/components/Calendar/helpers';
import Slot from '@/app/features/appointments/components/Calendar/common/Slot';
import { getStatusStyle } from '@/app/config/statusConfig';
import { Appointment } from '@yosemite-crew/types';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import {
  CalendarZoomMode,
  formatHourLabel,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  formatDateInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
const HOUR_ROW_TOP_OFFSET_PX = 0;
type WeekCalendarProps = {
  events: Appointment[];
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: any;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
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
  slotStepMinutes?: number;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  zoomMode = 'in',
  handleViewAppointment,
  weekStart,
  setWeekStart,
  setCurrentDate,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  handleChangeRoomAppointment,
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
  slotStepMinutes = 15,
}) => {
  const days = useMemo<Date[]>(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const now = useCalendarNow();
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);
  const height = getHourRowHeightPx(zoomMode);
  const dayColumnsStyle = useMemo(
    () => getCalendarColumnGridStyle(days.length, zoomMode === 'out' ? 96 : 140),
    [days.length, zoomMode]
  );

  const { allDayByDay, timedEvents } = useMemo(() => {
    const byDay: Appointment[][] = days.map(() => []);
    const timed: Appointment[] = [];
    for (const ev of events) {
      let isAllDaySomeDay = false;
      for (let idx = 0; idx < days.length; idx++) {
        const day = days[idx];
        if (isAllDayForDate(ev, day)) {
          byDay[idx].push(ev);
          isAllDaySomeDay = true;
        }
      }
      if (!isAllDaySomeDay) {
        timed.push(ev);
      }
    }
    return { allDayByDay: byDay, timedEvents: timed };
  }, [events, days]);

  const visibleHourRange = useMemo(() => {
    if (zoomMode === 'out') return { startHour: 0, endHour: HOURS_IN_DAY - 1 };

    const minutes: number[] = [];
    days.forEach((day) => {
      const availability = getVisibleAvailabilityIntervals?.(day) ?? [];
      availability.forEach((interval) => {
        minutes.push(interval.startMinute, interval.endMinute);
      });
    });
    timedEvents.forEach((event) => {
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
  }, [days, getVisibleAvailabilityIntervals, timedEvents, zoomMode]);

  const visibleHours = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, visibleHourRange.endHour - visibleHourRange.startHour + 1) },
        (_, i) => visibleHourRange.startHour + i
      ),
    [visibleHourRange.endHour, visibleHourRange.startHour]
  );
  const lastVisibleHour = visibleHours[visibleHours.length - 1] ?? visibleHourRange.endHour;

  const handlePrevWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getPrevWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getNextWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  };

  const nowPosition = useMemo(() => {
    const todayIndex = days.findIndex((day) => isOnPreferredTimeZoneCalendarDay(now, day));
    if (todayIndex === -1) return null;

    const topPx = getNowTopPxForHourRange(
      days[todayIndex],
      visibleHourRange.startHour,
      visibleHourRange.endHour,
      height,
      now,
      HOUR_ROW_TOP_OFFSET_PX
    );
    if (topPx == null) return null;

    return { topPx, todayIndex };
  }, [days, height, now, visibleHourRange.endHour, visibleHourRange.startHour]);
  const nowTimeLabel = useMemo(() => {
    if (!nowPosition) return null;
    return formatDateInPreferredTimeZone(now, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [now, nowPosition]);

  useEffect(() => {
    if (!scrollRef.current) return;

    const rangeStart = new Date(days[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const lastDay = days.at(-1);
    if (!lastDay) return;
    const rangeEnd = nextDay(lastDay);
    const focusStart = getFirstRelevantTimedEventStart(timedEvents, rangeStart, rangeEnd);

    const focusMinutes = focusStart
      ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : ((focusMinutes - visibleHourRange.startHour * 60) / 60) * height + HOUR_ROW_TOP_OFFSET_PX;

    scrollContainerToTarget(scrollRef.current, topPx);
  }, [days, height, nowPosition, timedEvents, visibleHourRange.startHour]);

  const hasAnyAllDay = allDayByDay.some((list) => list.length > 0);
  const slotOffsetMinutes = useMemo(() => {
    const step = Math.max(5, Math.round(slotStepMinutes || 15));
    if (step >= 60) return [];
    const offsets: number[] = [];
    for (let minute = step; minute < 60; minute += step) {
      offsets.push(minute);
    }
    return offsets;
  }, [slotStepMinutes]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto relative rounded-2xl"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col">
          <div className="z-30 bg-white">
            <div className="grid border-b border-grey-light py-3 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
              <div className="sticky left-0 z-40 bg-white flex items-center justify-center">
                <Back onClick={handlePrevWeek} />
              </div>
              <div className="grid bg-white" style={dayColumnsStyle}>
                {days.map((day) => {
                  const weekday = day.toLocaleDateString('en-US', {
                    weekday: 'short',
                  });
                  const dateNumber = day.getDate();
                  const isToday = isOnPreferredTimeZoneCalendarDay(now, day);
                  const dateNumberClass = isToday
                    ? 'bg-text-brand text-white border-transparent'
                    : 'bg-card-bg text-text-secondary border-transparent';
                  return (
                    <div key={day.toISOString()} className="flex items-center justify-center gap-2">
                      <div
                        className={`text-body-4 ${
                          isToday ? 'text-text-brand' : 'text-text-primary'
                        }`}
                      >
                        {weekday}
                      </div>
                      <div
                        className={`text-body-4-emphasis h-10 w-10 flex items-center justify-center rounded-full border ${dateNumberClass}`}
                      >
                        {dateNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="sticky right-0 z-40 bg-white flex items-center justify-center">
                <Next onClick={handleNextWeek} />
              </div>
            </div>

            {hasAnyAllDay && (
              <div className="border-b border-grey-light bg-slate-50">
                <div className="grid py-2 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div className="sticky left-0 z-40 bg-slate-50 text-xs font-satoshi text-[#747473] flex items-start pr-2">
                    All-day
                  </div>
                  <div className="grid min-w-max" style={dayColumnsStyle}>
                    {days.map((day, idx) => {
                      const dayAllEvents = allDayByDay[idx];
                      return (
                        <div key={day.toISOString()} className="flex flex-col gap-1 pr-2">
                          {dayAllEvents.map((ev) => (
                            <button
                              key={`${ev.companion.name}-${ev.startTime.toISOString()}`}
                              type="button"
                              onClick={() => handleViewAppointment(ev)}
                              className="w-full rounded-md! px-2 py-1 text-[11px] font-satoshi text-left truncate"
                              style={{
                                ...({
                                  ...getStatusStyle(ev.status),
                                  padding: undefined,
                                } as React.CSSProperties),
                              }}
                            >
                              <div className="font-medium truncate">
                                {ev.companion.name} • {ev.concern || ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-40 bg-slate-50" />
                </div>
              </div>
            )}
          </div>

          <div
            ref={scrollRef}
            className="min-w-max flex-1 min-h-0"
            style={{
              height: '100%',
              maxHeight: '100%',
              minHeight: 0,
              overflowY: 'auto',
              paddingBottom: zoomMode === 'out' ? 30 : 40,
            }}
            data-calendar-scroll="true"
          >
            <div className="relative pb-4">
              {visibleHours.map((hour) => (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div
                    className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2! relative"
                    style={{ height: height + 'px' }}
                  >
                    <span
                      className={`absolute top-0 ${
                        hour === visibleHours[0] ? 'translate-y-0' : '-translate-y-1/2'
                      }`}
                    >
                      {formatHourLabel(hour)}
                    </span>
                  </div>
                  <div className="grid min-w-max" style={dayColumnsStyle}>
                    {days.map((day, dayIndex) => {
                      const slotEvents = eventsForDayHour(timedEvents, day, hour);
                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className="relative"
                          style={{ height: `${height}px` }}
                        >
                          <Slot
                            slotEvents={slotEvents}
                            height={height}
                            zoomMode={zoomMode}
                            dayIndex={dayIndex}
                            handleViewAppointment={handleViewAppointment}
                            handleRescheduleAppointment={handleRescheduleAppointment}
                            handleChangeStatusAppointment={handleChangeStatusAppointment}
                            handleChangeRoomAppointment={handleChangeRoomAppointment}
                            canEditAppointments={canEditAppointments}
                            length={days.length - 1}
                            draggedAppointmentId={draggedAppointmentId}
                            draggedAppointmentLabel={draggedAppointmentLabel}
                            canDragAppointment={canDragAppointment}
                            onAppointmentDragStart={onAppointmentDragStart}
                            onAppointmentDragEnd={onAppointmentDragEnd}
                            onAppointmentDropAt={onAppointmentDropAt}
                            onDragHoverTarget={onDragHoverTarget}
                            onCreateAppointmentAt={onCreateAppointmentAt}
                            dropAvailabilityIntervals={getDropAvailabilityIntervals?.(day) ?? []}
                            draggedAppointmentDurationMinutes={draggedAppointmentDurationMinutes}
                            dropDate={day}
                            dropHour={hour}
                            invoicesByAppointmentId={invoicesByAppointmentId}
                          />
                          <div className="pointer-events-none absolute inset-0 z-10">
                            <div className="absolute inset-x-0 top-0 border-t border-[#C3CEDC]" />
                            {slotOffsetMinutes.map((minute) => (
                              <div
                                key={`${day.toISOString()}-${hour}-slot-${minute}`}
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
                  <div className="sticky right-0 z-20 bg-white" style={{ height }} />
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />

              {nowPosition && (
                <div className="pointer-events-none absolute inset-0" style={{ top: 0 }}>
                  <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                    <div />
                    <div className="grid min-w-max" style={dayColumnsStyle}>
                      {days.map((day, dayIndex) => (
                        <div key={`appointment-now-${day.toISOString()}`} className="relative">
                          {dayIndex === nowPosition.todayIndex && (
                            <div
                              className="absolute left-0 right-2 z-20 w-full"
                              style={{
                                top: nowPosition.topPx,
                              }}
                            >
                              {nowTimeLabel && (
                                <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-red-500 whitespace-nowrap">
                                  {nowTimeLabel}
                                </div>
                              )}
                              <div className="absolute left-[-5px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
                              <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
                            </div>
                          )}
                        </div>
                      ))}
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

export default WeekCalendar;
