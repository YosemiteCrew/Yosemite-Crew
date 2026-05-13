import React, { useEffect, useMemo, useRef } from 'react';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import {
  eventsForDayHour,
  getWeekDays,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  computeUnavailableSegments,
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
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import CalendarHourLabel from '@/app/features/appointments/components/Calendar/common/CalendarHourLabel';
import {
  formatDateInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import SlotGridLines from '@/app/features/appointments/components/Calendar/common/SlotGridLines';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import {
  getVisibleHourRange,
  getVisibleHours,
  useCalendarWeekNavigation,
  useSlotOffsetMinutes,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';

const HOUR_ROW_TOP_OFFSET_PX = 0;

const getAllDayAppointmentAriaLabel = (appointment: Appointment) => {
  const concernSuffix = appointment.concern ? `. ${appointment.concern}` : '';
  return `All-day appointment for ${formatCompanionNameWithOwnerLastName(
    appointment.companion.name,
    appointment.companion.parent
  )}${concernSuffix}`;
};

type WeekCalendarProps = {
  events: Appointment[];
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: any;
  handleDetailAppointment?: any;
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
  availabilityLoaded?: boolean;
  skipAutoScroll?: boolean;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  zoomMode = 'in',
  handleViewAppointment,
  handleDetailAppointment,
  weekStart,
  setWeekStart,
  setCurrentDate,
  handleRescheduleAppointment,
  handleChangeStatusAppointment: _handleChangeStatusAppointment,
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
  availabilityLoaded = false,
  skipAutoScroll = false,
}) => {
  const days = useMemo<Date[]>(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onWheelBoundary = useScrollBoundaryWheel();
  const onWheelHorizontal = useWheelToHorizontalScroll();
  const now = useCalendarNow();
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);
  const height = getHourRowHeightPx(zoomMode);
  const weekTimelineLabel = `Appointments week calendar starting ${formatDateInPreferredTimeZone(
    weekStart,
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  )}`;
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

    return getVisibleHourRange(zoomMode, minutes, { endHour: HOURS_IN_DAY - 1 });
  }, [days, getVisibleAvailabilityIntervals, timedEvents, zoomMode]);

  const visibleHours = useMemo(() => getVisibleHours(visibleHourRange), [visibleHourRange]);
  const timedEventsByDayHour = useMemo(() => {
    const entries = new Map<string, Appointment[]>();

    days.forEach((day) => {
      visibleHours.forEach((hour) => {
        const key = `${day.toISOString()}-${hour}`;
        entries.set(key, eventsForDayHour(timedEvents, day, hour));
      });
    });

    return entries;
  }, [days, timedEvents, visibleHours]);
  const lastVisibleHour = visibleHours.at(-1) ?? visibleHourRange.endHour;
  const { handlePrevWeek, handleNextWeek } = useCalendarWeekNavigation(
    setWeekStart,
    setCurrentDate
  );

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
  const nowTimeLabel = useMemo(
    () =>
      nowPosition
        ? formatDateInPreferredTimeZone(now, { hour: 'numeric', minute: '2-digit' })
        : null,
    [now, nowPosition]
  );

  // Track the weekStart key for which we've already scrolled so we don't
  // re-fire when availability loads and triggers additional renders.
  const scrolledWeekRef = useRef<string | null>(null);
  const weekStartKey = weekStart.toISOString();

  // Keep latest scroll inputs in refs — readable inside the effect without
  // being deps (avoids re-scrolling when only nowPosition/availability change).
  const nowPositionRef = useRef(nowPosition);
  nowPositionRef.current = nowPosition;
  const timedEventsRef = useRef(timedEvents);
  timedEventsRef.current = timedEvents;
  const visibleHourRangeRef = useRef(visibleHourRange);
  visibleHourRangeRef.current = visibleHourRange;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !!draggedAppointmentId || !days.length || skipAutoScroll) return;
    // Only scroll once per week. Re-renders from availability loading or
    // nowPosition updates must not cause a second jump.
    if (scrolledWeekRef.current === weekStartKey) return;
    scrolledWeekRef.current = weekStartKey;

    const currentNowPosition = nowPositionRef.current;
    const currentTimedEvents = timedEventsRef.current;
    const currentRange = visibleHourRangeRef.current;

    const rangeStart = days[0];
    const effectiveRangeEnd = days.at(-1) ? nextDay(days.at(-1) as Date) : nextDay(days[0]);

    let topPx: number;
    if (currentNowPosition) {
      topPx = Math.max(0, currentNowPosition.topPx);
    } else {
      const focusStart = getFirstRelevantTimedEventStart(
        currentTimedEvents,
        rangeStart,
        effectiveRangeEnd
      );
      const focusMinutes = focusStart
        ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
        : DEFAULT_CALENDAR_FOCUS_MINUTES;
      topPx = ((focusMinutes - currentRange.startHour * 60) / 60) * height + HOUR_ROW_TOP_OFFSET_PX;
    }
    scrollContainerToTarget(container, topPx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartKey, scrollRef.current, draggedAppointmentId, skipAutoScroll, days.length, height]);

  const unavailableByDay = useMemo(
    () =>
      days.map((day) => {
        const visible = getVisibleAvailabilityIntervals?.(day) ?? [];
        return computeUnavailableSegments(
          visible,
          visibleHourRange.startHour,
          visibleHourRange.endHour,
          availabilityLoaded
        );
      }),
    [availabilityLoaded, days, getVisibleAvailabilityIntervals, visibleHourRange]
  );

  const hasAnyAllDay = allDayByDay.some((list) => list.length > 0);
  const { slotOffsetMinutes, showSlotTimeLabels } = useSlotOffsetMinutes(slotStepMinutes, zoomMode);

  return (
    <div className="h-full flex flex-col">
      <section
        className="w-full flex-1 overflow-x-auto relative rounded-2xl scrollbar-x-float"
        data-calendar-scroll="true"
        aria-label={weekTimelineLabel}
        onWheel={onWheelHorizontal}
      >
        <div className="min-w-max h-full flex flex-col">
          <div className="z-30 bg-white shrink-0">
            <div className="grid border-b border-grey-light py-2 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
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
                          isToday ? 'text-(--color-primary-700)' : 'text-text-primary'
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
                  <div className="sticky left-0 z-40 bg-slate-50 text-xs font-satoshi text-grey-text flex items-start pr-2">
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
                              aria-label={getAllDayAppointmentAriaLabel(ev)}
                              className="w-full rounded-md! px-2 py-1 text-[11px] font-satoshi text-left truncate"
                              style={{
                                ...({
                                  ...getStatusStyle(ev.status),
                                  padding: undefined,
                                } as React.CSSProperties),
                              }}
                            >
                              <div className="font-medium truncate">
                                {formatCompanionNameWithOwnerLastName(
                                  ev.companion.name,
                                  ev.companion.parent
                                )}{' '}
                                • {ev.concern || ''}
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
            onWheel={onWheelBoundary}
            data-calendar-scroll="true"
          >
            <div className="relative pb-4">
              {visibleHours.map((hour) => (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <CalendarHourLabel
                    hour={hour}
                    height={height}
                    slotOffsetMinutes={slotOffsetMinutes}
                    showSlotTimeLabels={showSlotTimeLabels}
                    pinFirstHour
                    firstHour={visibleHours[0]}
                    className="sticky left-0 z-20 bg-white"
                  />
                  <div className="grid min-w-max" style={dayColumnsStyle}>
                    {days.map((day, dayIndex) => {
                      const slotEvents =
                        timedEventsByDayHour.get(`${day.toISOString()}-${hour}`) ?? [];
                      const hourStart = hour * 60;
                      const hourEnd = hourStart + 60;
                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className="relative"
                          style={{ height: `${height}px` }}
                        >
                          {unavailableByDay[dayIndex]
                            .filter((seg) => seg.endMinute > hourStart && seg.startMinute < hourEnd)
                            .map((seg) => {
                              const clampedStart = Math.max(seg.startMinute, hourStart);
                              const clampedEnd = Math.min(seg.endMinute, hourEnd);
                              const topPct = ((clampedStart - hourStart) / 60) * 100;
                              const heightPct = ((clampedEnd - clampedStart) / 60) * 100;
                              return (
                                <div
                                  key={`unavail-${dayIndex}-${hour}-${seg.startMinute}`}
                                  className="pointer-events-none absolute left-0 right-0 z-1"
                                  style={{
                                    top: `${topPct}%`,
                                    height: `${heightPct}%`,
                                    backgroundColor: 'rgba(0,0,0,0.045)',
                                    transition: 'opacity 0.25s ease',
                                  }}
                                />
                              );
                            })}
                          <Slot
                            slotEvents={slotEvents}
                            height={height}
                            zoomMode={zoomMode}
                            dayIndex={dayIndex}
                            handleViewAppointment={handleViewAppointment}
                            handleDetailAppointment={handleDetailAppointment}
                            handleRescheduleAppointment={handleRescheduleAppointment}
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
                            unavailableSegments={unavailableByDay[dayIndex]}
                            draggedAppointmentDurationMinutes={draggedAppointmentDurationMinutes}
                            dropDate={day}
                            dropHour={hour}
                            invoicesByAppointmentId={invoicesByAppointmentId}
                          />
                          <SlotGridLines
                            userId={day.toISOString()}
                            hour={hour}
                            lastVisibleHour={lastVisibleHour}
                            slotOffsetMinutes={slotOffsetMinutes}
                          />
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
                                <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-danger-700 whitespace-nowrap">
                                  {nowTimeLabel}
                                </div>
                              )}
                              <div className="absolute -left-1.25 w-3 h-3 rounded-full bg-red-500 -translate-y-1/2" />
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
      </section>
    </div>
  );
};

export default WeekCalendar;
