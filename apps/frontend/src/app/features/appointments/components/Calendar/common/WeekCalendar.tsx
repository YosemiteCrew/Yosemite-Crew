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
import {
  CalendarZoomMode,
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
  useSlotOffsetMinutes,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';
import type { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import './WeekCalendar.css';

const HOUR_ROW_TOP_OFFSET_PX = 0;

/**
 * Day-column track for the week grid. Both the minimum column width and the
 * gutter live in `WeekCalendar.css` as custom properties so the tablet band can
 * collapse the week to fit the viewport — an inline style cannot carry a media
 * query, and the tablet keeps a real seven-day week rather than a phone shape.
 */
const getWeekDayColumnsStyle = (columnCount: number): React.CSSProperties => {
  const safeColumns = Math.max(1, columnCount);
  return {
    gridTemplateColumns: `repeat(${safeColumns}, minmax(var(--yc-week-day-min), 1fr))`,
    width: `max(100%, calc(${safeColumns} * var(--yc-week-day-min)))`,
  };
};

const getAllDayAppointmentAriaLabel = (appointment: Appointment) => {
  const concernSuffix = appointment.concern ? `. ${appointment.concern}` : '';
  return `All-day appointment for ${formatCompanionNameWithOwnerLastName(
    (appointment.companion ?? appointment.patient).name,
    (appointment.companion ?? appointment.patient).parent
  )}${concernSuffix}`;
};

/**
 * Scroll the week grid once per week change: to the current-time line when today
 * is visible, otherwise to the first relevant timed event (or the default focus
 * time). Re-renders from availability loading or clock ticks must not re-scroll,
 * so the scroll inputs are read through refs instead of effect deps.
 */
const useWeekAutoScroll = ({
  scrollRef,
  weekStartKey,
  draggedAppointmentId,
  skipAutoScroll,
  days,
  height,
  nowPosition,
  timedEvents,
  visibleHourRange,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  weekStartKey: string;
  draggedAppointmentId?: string | null;
  skipAutoScroll: boolean;
  days: Date[];
  height: number;
  nowPosition: { topPx: number; todayIndex: number } | null;
  timedEvents: Appointment[];
  visibleHourRange: { startHour: number; endHour: number };
}) => {
  const scrolledWeekRef = useRef<string | null>(null);
  const nowPositionRef = useRef(nowPosition);
  nowPositionRef.current = nowPosition;
  const timedEventsRef = useRef(timedEvents);
  timedEventsRef.current = timedEvents;
  const visibleHourRangeRef = useRef(visibleHourRange);
  visibleHourRangeRef.current = visibleHourRange;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !!draggedAppointmentId || !days.length || skipAutoScroll) return;
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
  }, [weekStartKey, draggedAppointmentId, skipAutoScroll, days, height, scrollRef]);
};

/** Shaded overlays for the parts of one day-hour cell outside available hours. */
const UnavailableHourOverlays = ({
  segments,
  dayIndex,
  hour,
}: {
  segments: Array<{ startMinute: number; endMinute: number }>;
  dayIndex: number;
  hour: number;
}) => {
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  return (
    <>
      {segments.flatMap((seg) => {
        if (!(seg.endMinute > hourStart && seg.startMinute < hourEnd)) return [];
        const clampedStart = Math.max(seg.startMinute, hourStart);
        const clampedEnd = Math.min(seg.endMinute, hourEnd);
        const topPct = ((clampedStart - hourStart) / 60) * 100;
        const heightPct = ((clampedEnd - clampedStart) / 60) * 100;
        return [
          <div
            key={`unavail-${dayIndex}-${hour}-${seg.startMinute}`}
            className="pointer-events-none absolute left-0 right-0 z-1"
            style={{
              top: `${topPct}%`,
              height: `${heightPct}%`,
              backgroundColor: 'var(--color-calendar-dim-overlay)',
              transition: 'opacity 0.25s ease',
            }}
          />,
        ];
      })}
    </>
  );
};

/**
 * Day-of-week header strip. Per the week-grid frame: a --screen-2 band closed by a
 * --hairline rule, each day a centred stack of an all-caps 9.5px/700/0.08em label
 * over a 14px/700 date, hairline-separated. Today swaps the label to --nav-active
 * and drops the date into a 24px --blue disc, over a --nav-active-bg cell.
 * Week navigation lives in the header toolbar's date-nav pill, not here.
 */
const WeekDayHeaderRow = ({
  days,
  now,
  dayColumnsStyle,
}: {
  days: Date[];
  now: Date;
  dayColumnsStyle: React.CSSProperties;
}) => (
  <div
    className="yc-week-grid__shell yc-week-grid__track border-b"
    style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--screen-2)' }}
  >
    <div className="sticky left-0 z-40" style={{ backgroundColor: 'var(--screen-2)' }} />
    <div className="grid" style={dayColumnsStyle}>
      {days.map((day) => {
        const weekday = formatDateInPreferredTimeZone(day, {
          weekday: 'short',
        });
        const dateNumber = day.getDate();
        const isToday = isOnPreferredTimeZoneCalendarDay(now, day);
        return (
          <div
            key={day.toISOString()}
            className="flex flex-col items-center gap-px border-l px-1 py-2"
            style={{
              borderColor: 'var(--hairline)',
              backgroundColor: isToday ? 'var(--nav-active-bg)' : undefined,
            }}
          >
            <div
              className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
              style={{ color: isToday ? 'var(--nav-active)' : 'var(--ink-faint)' }}
            >
              {weekday}
            </div>
            {isToday ? (
              <div
                className="flex size-6 items-center justify-center rounded-full text-[13px] font-bold text-white"
                style={{ backgroundColor: 'var(--blue)' }}
              >
                {dateNumber}
              </div>
            ) : (
              <div className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                {dateNumber}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

/**
 * The pinned all-day strip above the hour grid — only rendered when some day has
 * one. Matches the frame's all-week band: an --inset tray, a 10px/700/0.08em
 * all-caps --ink-faint label, and status-tinted 11px/600 rounded-full chips.
 */
const AllDayBand = ({
  days,
  allDayByDay,
  dayColumnsStyle,
  handleViewAppointment,
}: {
  days: Date[];
  allDayByDay: Appointment[][];
  dayColumnsStyle: React.CSSProperties;
  handleViewAppointment: (appointment: Appointment) => void;
}) => (
  <div className="border-b" style={{ borderColor: 'var(--hairline)' }}>
    <div
      className="yc-week-grid__shell yc-week-grid__track py-2"
      style={{ backgroundColor: 'var(--inset)' }}
    >
      <div
        className="sticky left-0 z-40 flex items-start pr-2 pl-2 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ backgroundColor: 'var(--inset)', color: 'var(--ink-faint)' }}
      >
        All-day
      </div>
      <div className="grid yc-week-grid__track" style={dayColumnsStyle}>
        {days.map((day, idx) => {
          const dayAllEvents = allDayByDay[idx];
          return (
            <div key={day.toISOString()} className="flex flex-col gap-1 px-1">
              {dayAllEvents.map((ev) => (
                <button
                  key={`${(ev.companion ?? ev.patient).name}-${ev.startTime.toISOString()}`}
                  type="button"
                  onClick={() => handleViewAppointment(ev)}
                  aria-label={getAllDayAppointmentAriaLabel(ev)}
                  className="w-full rounded-full! px-[10px] py-[5px] text-[11px] font-semibold font-satoshi text-left truncate"
                  style={{
                    ...({
                      ...getStatusStyle(ev.status),
                      padding: undefined,
                    } as React.CSSProperties),
                  }}
                >
                  <div className="truncate">
                    {formatCompanionNameWithOwnerLastName(
                      (ev.companion ?? ev.patient).name,
                      (ev.companion ?? ev.patient).parent
                    )}{' '}
                    • {ev.concern || ''}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const NowIndicatorOverlay = ({
  days,
  dayColumnsStyle,
  nowPosition,
  nowTimeLabel,
}: {
  days: Date[];
  dayColumnsStyle: React.CSSProperties;
  nowPosition: { topPx: number; todayIndex: number };
  nowTimeLabel: string | null;
}) => (
  <div className="pointer-events-none absolute inset-0" style={{ top: 0 }}>
    <div className="yc-week-grid__shell yc-week-grid__track h-full">
      <div />
      <div className="grid yc-week-grid__track" style={dayColumnsStyle}>
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
                  <div
                    className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold whitespace-nowrap"
                    style={{ color: 'var(--blue-text)' }}
                  >
                    {nowTimeLabel}
                  </div>
                )}
                <div
                  className="absolute -left-1.25 size-[7px] rounded-full -translate-y-1/2"
                  style={{ backgroundColor: 'var(--blue)' }}
                />
                <div
                  className="translate-y-[-50%]"
                  style={{
                    borderTopWidth: '2px',
                    borderTopStyle: 'solid',
                    borderTopColor: 'var(--blue)',
                    opacity: 0.75,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

type WeekCalendarProps = {
  events: Appointment[];
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: any;
  handleDetailAppointment?: any;
  handleOpenWorkspace?: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: any;
  handleChangeRoomAppointment?: any;
  handleAcceptAppointment?: (appt: Appointment) => void;
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
  handleOpenWorkspace,
  weekStart,
  // setWeekStart / setCurrentDate stay on the props contract but are no longer read
  // here: week navigation moved to the header toolbar's date-nav pill, which owns
  // both setters. The grid itself only reads weekStart.
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
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
  const dayColumnsStyle = useMemo(() => getWeekDayColumnsStyle(days.length), [days.length]);

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

  const todayColumnIndex = useMemo(
    () => days.findIndex((day) => isOnPreferredTimeZoneCalendarDay(now, day)),
    [days, now]
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

  useWeekAutoScroll({
    scrollRef,
    weekStartKey: weekStart.toISOString(),
    draggedAppointmentId,
    skipAutoScroll,
    days,
    height,
    nowPosition,
    timedEvents,
    visibleHourRange,
  });

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
    <div className="yc-week-grid h-full flex flex-col" data-zoom-mode={zoomMode}>
      <section
        className="w-full flex-1 overflow-x-auto relative rounded-2xl scrollbar-x-float"
        data-calendar-scroll="true"
        aria-label={weekTimelineLabel}
        onWheel={onWheelHorizontal}
      >
        <div className="yc-week-grid__track h-full flex flex-col">
          <div className="z-30 bg-neutral-0 shrink-0">
            <WeekDayHeaderRow days={days} now={now} dayColumnsStyle={dayColumnsStyle} />

            {hasAnyAllDay && (
              <AllDayBand
                days={days}
                allDayByDay={allDayByDay}
                dayColumnsStyle={dayColumnsStyle}
                handleViewAppointment={handleViewAppointment}
              />
            )}
          </div>

          <div
            ref={scrollRef}
            className="yc-week-grid__track flex-1 min-h-0"
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
                <div key={hour} className="yc-week-grid__shell yc-week-grid__track">
                  <CalendarHourLabel
                    hour={hour}
                    height={height}
                    slotOffsetMinutes={slotOffsetMinutes}
                    showSlotTimeLabels={showSlotTimeLabels}
                    pinFirstHour
                    firstHour={visibleHours[0]}
                    className="yc-week-grid__hour-label sticky left-0 z-20 bg-neutral-0"
                  />
                  <div className="grid yc-week-grid__track" style={dayColumnsStyle}>
                    {days.map((day, dayIndex) => {
                      const slotEvents =
                        timedEventsByDayHour.get(`${day.toISOString()}-${hour}`) ?? [];
                      // Today's column carries a soft wash for the whole height of
                      // the grid, matching the tinted day column in the frame. It is
                      // keyed off the day itself, not the now-line, so the tint holds
                      // when the current time falls outside the visible hour range.
                      const isTodayColumn = dayIndex === todayColumnIndex;
                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className="relative"
                          style={{
                            height: `${height}px`,
                            backgroundColor: isTodayColumn ? 'var(--surface-soft)' : undefined,
                          }}
                        >
                          <UnavailableHourOverlays
                            segments={unavailableByDay[dayIndex]}
                            dayIndex={dayIndex}
                            hour={hour}
                          />
                          <Slot
                            slotEvents={slotEvents}
                            height={height}
                            zoomMode={zoomMode}
                            dayIndex={dayIndex}
                            handleViewAppointment={handleViewAppointment}
                            handleDetailAppointment={handleDetailAppointment}
                            handleOpenWorkspace={handleOpenWorkspace}
                            handleRescheduleAppointment={handleRescheduleAppointment}
                            handleChangeRoomAppointment={handleChangeRoomAppointment}
                            handleAcceptAppointment={handleAcceptAppointment}
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
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />

              {nowPosition && (
                <NowIndicatorOverlay
                  days={days}
                  dayColumnsStyle={dayColumnsStyle}
                  nowPosition={nowPosition}
                  nowTimeLabel={nowTimeLabel}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeekCalendar;
