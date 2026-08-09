import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  getFirstRelevantTimedEventStart,
  getNowTopPxForWindow,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
  nextDay,
  scrollContainerToTarget,
  isAllDayForDate,
  layoutDayEvents,
  DAY_START_MINUTES,
  DAY_END_MINUTES,
} from '@/app/features/appointments/components/Calendar/helpers';
import { AppointmentViewIntent, LaidOutEvent } from '@/app/features/appointments/types/calendar';
import TimeLabels from '@/app/features/appointments/components/Calendar/common/TimeLabels';
import HorizontalLines from '@/app/features/appointments/components/Calendar/common/HorizontalLines';
import { Appointment } from '@yosemite-crew/types';
import { getDateDisplay } from '@/app/hooks/useCalendarNavigation';
import { createPortal } from 'react-dom';
import {
  CalendarZoomMode,
  getPixelsPerStepForZoom,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  formatDateInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import { useNotify } from '@/app/hooks/useNotify';
import DayCalendarHeader from '@/app/features/appointments/components/Calendar/common/DayCalendarHeader';
import AllDayEventsRow from '@/app/features/appointments/components/Calendar/common/AllDayEventsRow';
import TimedEventMarker from '@/app/features/appointments/components/Calendar/common/TimedEventMarker';
import { getEventKey } from '@/app/features/appointments/components/Calendar/common/dayCalendarHelpers';
import { useDayCalendarMarkerInteractions } from '@/app/features/appointments/components/Calendar/common/useDayCalendarMarkerInteractions';
import { useHasMounted } from '@/app/hooks/useHasMounted';

type DayCalendarProps = {
  events: Appointment[];
  date: Date;
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  handleDetailAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  handleOpenWorkspace?: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeRoomAppointment?: (appointment: Appointment) => void;
  handleAcceptAppointment?: (appointment: Appointment) => void;
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

const shouldIgnoreTimelineCreate = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const closest = target.closest('button, a, input, textarea, select');
  return !!closest && !('timelineCreate' in (closest as HTMLElement).dataset);
};

const getTimelineGrid = (el: HTMLElement): HTMLDivElement | null =>
  el.querySelector<HTMLDivElement>('[data-timeline-grid]');

const computeUnavailableSegments = (
  visible: Array<{ startMinute: number; endMinute: number }>,
  availabilityLoaded: boolean,
  windowStart: number,
  windowEnd: number
): Array<{ startMinute: number; endMinute: number }> => {
  if (!visible.length) {
    return availabilityLoaded ? [{ startMinute: windowStart, endMinute: windowEnd }] : [];
  }
  const segments: { startMinute: number; endMinute: number }[] = [];
  const sorted = visible.toSorted((a, b) => a.startMinute - b.startMinute);
  if (sorted[0].startMinute > windowStart) {
    segments.push({ startMinute: windowStart, endMinute: sorted[0].startMinute });
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endMinute < sorted[i + 1].startMinute) {
      segments.push({ startMinute: sorted[i].endMinute, endMinute: sorted[i + 1].startMinute });
    }
  }
  const last = sorted.at(-1)!;
  if (last.endMinute < windowEnd) {
    segments.push({ startMinute: last.endMinute, endMinute: windowEnd });
  }
  return segments;
};

/**
 * Visible minute window for the day timeline: zoomed out shows the whole day;
 * zoomed in tightens around availability and events (padded, hour-snapped, and
 * widened to at least two hours).
 */
const computeDayWindow = (
  zoomMode: CalendarZoomMode,
  availability: Array<{ startMinute: number; endMinute: number }>,
  timedEvents: Appointment[]
): { windowStart: number; windowEnd: number } => {
  if (zoomMode === 'out') {
    return { windowStart: DAY_START_MINUTES, windowEnd: DAY_END_MINUTES };
  }
  const mins: number[] = [];
  availability.forEach((interval) => {
    mins.push(interval.startMinute, interval.endMinute);
  });
  timedEvents.forEach((event) => {
    mins.push(
      getMinutesSinceStartOfDayInPreferredTimeZone(event.startTime),
      getMinutesSinceStartOfDayInPreferredTimeZone(event.endTime)
    );
  });
  if (!mins.length) {
    return { windowStart: DAY_START_MINUTES, windowEnd: DAY_END_MINUTES };
  }
  const minMinute = Math.max(DAY_START_MINUTES, Math.min(...mins) - 30);
  const maxMinute = Math.min(DAY_END_MINUTES, Math.max(...mins) + 30);
  const snappedStart = Math.max(DAY_START_MINUTES, Math.floor(minMinute / 60) * 60);
  const snappedEnd = Math.min(DAY_END_MINUTES, Math.ceil(maxMinute / 60) * 60);
  if (snappedEnd - snappedStart < 120) {
    return {
      windowStart: Math.max(DAY_START_MINUTES, snappedStart - 60),
      windowEnd: Math.min(DAY_END_MINUTES, snappedEnd + 60),
    };
  }
  return { windowStart: snappedStart, windowEnd: snappedEnd };
};

/**
 * Pointer interactions on the day timeline: click/keyboard slot creation with
 * past-time and unavailable-slot guards, plus drag-over preview and drop
 * placement snapped to the nearest available minute.
 */
const useTimelineInteractions = ({
  date,
  windowStart,
  windowEnd,
  draggedAppointmentId,
  availabilityIntervals,
  unavailableSegments,
  onCreateAppointmentAt,
  onDragHoverTarget,
  onAppointmentDropAt,
  setDropPreviewMinute,
  notify,
}: {
  date: Date;
  windowStart: number;
  windowEnd: number;
  draggedAppointmentId?: string | null;
  availabilityIntervals: Array<{ startMinute: number; endMinute: number }>;
  unavailableSegments: Array<{ startMinute: number; endMinute: number }>;
  onCreateAppointmentAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  onDragHoverTarget?: (date: Date, targetLeadId?: string) => void;
  onAppointmentDropAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  setDropPreviewMinute: React.Dispatch<React.SetStateAction<number | null>>;
  notify: ReturnType<typeof useNotify>['notify'];
}) => {
  const getMinuteFromTimelinePointer = (clientY: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height > 0 ? y / rect.height : 0;
    const rawMinute = windowStart + ratio * (windowEnd - windowStart);
    return Math.max(windowStart, Math.min(windowEnd, Math.round(rawMinute / 5) * 5));
  };

  const getNearestAvailableMinute = (minute: number) =>
    calcNearestAvailableMinute(minute, availabilityIntervals);

  const createAppointmentAtMinute = (clientY: number, container: HTMLDivElement) => {
    if (!onCreateAppointmentAt || draggedAppointmentId) return;
    const minute = getMinuteFromTimelinePointer(clientY, container);
    const snapped = Math.round(minute / 5) * 5;
    const slotTime = new Date(date);
    slotTime.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
    if (slotTime < new Date()) {
      notify('warning', {
        title: 'Past time slot',
        text: "You can't book appointments in the past. Please select a future time.",
      });
      return;
    }
    const isUnavailable = unavailableSegments.some(
      (seg) => snapped >= seg.startMinute && snapped < seg.endMinute
    );
    if (isUnavailable) {
      notify('warning', {
        title: 'Slot unavailable',
        text: 'This time is outside available hours. Please select a different slot.',
      });
      return;
    }
    onCreateAppointmentAt(date, snapped);
  };

  const createAppointmentAtOffset = (offsetY: number, container: HTMLDivElement) => {
    if (!onCreateAppointmentAt || draggedAppointmentId) return;
    const rect = container.getBoundingClientRect();
    createAppointmentAtMinute(rect.top + offsetY, container);
  };

  const handleTimelineDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedAppointmentId) return;
    event.preventDefault();
    onDragHoverTarget?.(date);
    const grid = getTimelineGrid(event.currentTarget);
    if (!grid) return;
    const minute = getMinuteFromTimelinePointer(event.clientY, grid);
    setDropPreviewMinute(getNearestAvailableMinute(minute));
  };

  const handleTimelineDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedAppointmentId) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setDropPreviewMinute(null);
    }
  };

  const handleTimelineDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedAppointmentId || !onAppointmentDropAt) return;
    event.preventDefault();
    const grid = getTimelineGrid(event.currentTarget);
    if (!grid) return;
    const minute = getMinuteFromTimelinePointer(event.clientY, grid);
    const nearest = getNearestAvailableMinute(minute);
    setDropPreviewMinute(null);
    if (nearest == null) return;
    onAppointmentDropAt(date, nearest);
  };

  const handleTimelineCreate = (event: React.MouseEvent<HTMLElement>) => {
    if (shouldIgnoreTimelineCreate(event.target)) return;
    const container = event.currentTarget.closest<HTMLElement>('[data-timeline-grid]');
    if (container) createAppointmentAtMinute(event.clientY, container as HTMLDivElement);
  };

  const handleTimelineKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const container = event.currentTarget.closest<HTMLElement>('[data-timeline-grid]');
    if (container)
      createAppointmentAtOffset(container.clientHeight / 2, container as HTMLDivElement);
  };

  return {
    handleTimelineDragOver,
    handleTimelineDragLeave,
    handleTimelineDrop,
    handleTimelineCreate,
    handleTimelineKeyDown,
  };
};

const buildTimelineLabel = (date: Date): string =>
  `Appointments timeline for ${formatDateInPreferredTimeZone(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })}`;

/** Scroll focus: the current-time line when today, else the first relevant event. */
const computeFocusTopPx = (
  date: Date,
  now: Date,
  timedEvents: Appointment[],
  windowStart: number,
  windowEnd: number,
  pixelsPerStep: number,
  yScale: number
): number => {
  const nowTopPx = getNowTopPxForWindow(date, windowStart, windowEnd, now);
  if (nowTopPx != null) return nowTopPx * yScale;

  const rangeStart = new Date(date);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = nextDay(rangeStart);
  const focusStart = getFirstRelevantTimedEventStart(timedEvents, rangeStart, rangeEnd);

  const focusMinutes = focusStart
    ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
    : DEFAULT_CALENDAR_FOCUS_MINUTES;
  const clampedMinutes = Math.max(windowStart, Math.min(focusMinutes, windowEnd));
  return ((clampedMinutes - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;
};

/** Invisible full-grid button that creates an appointment at the clicked time. */
const TimelineCreateOverlay = ({
  timelineInstructionsId,
  timelineLabel,
  onCreate,
  onKeyDown,
}: {
  timelineInstructionsId: string;
  timelineLabel: string;
  onCreate: (event: React.MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => (
  <>
    <p id={timelineInstructionsId} className="sr-only">
      Press Enter or Space to create an appointment at the middle of this visible timeline, or click
      a time slot directly.
    </p>
    <button
      type="button"
      data-timeline-create
      aria-label={timelineLabel}
      aria-describedby={timelineInstructionsId}
      className="absolute inset-0 col-span-2 z-0 w-full h-full cursor-default bg-transparent border-0 p-0"
      onClick={onCreate}
      onDoubleClick={onCreate}
      onKeyDown={onKeyDown}
    />
  </>
);

/** Body-level portal for the appointment detail popover. */
const DayCalendarPopoverPortal = ({
  activeEvent,
  invoicesByAppointmentId,
  canEditAppointments,
  appointmentPopoverId,
  popoverDialogRef,
  popoverStyle,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
  onClose,
  registerAnchorEl,
}: {
  activeEvent: Appointment;
  invoicesByAppointmentId: React.ComponentProps<
    typeof AppointmentPopover
  >['invoicesByAppointmentId'];
  canEditAppointments: boolean;
  appointmentPopoverId: string;
  popoverDialogRef: React.ComponentProps<typeof AppointmentPopover>['popoverDialogRef'];
  popoverStyle: React.ComponentProps<typeof AppointmentPopover>['popoverStyle'];
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeRoomAppointment?: (appointment: Appointment) => void;
  handleAcceptAppointment?: (appointment: Appointment) => void;
  onClose: () => void;
  registerAnchorEl: React.ComponentProps<typeof AppointmentPopover>['registerAnchorEl'];
}) =>
  createPortal(
    <AppointmentPopover
      appointment={activeEvent}
      invoicesByAppointmentId={invoicesByAppointmentId}
      canEditAppointments={canEditAppointments}
      popoverId={appointmentPopoverId}
      popoverDialogRef={popoverDialogRef}
      popoverStyle={popoverStyle}
      handleRescheduleAppointment={handleRescheduleAppointment}
      handleChangeRoomAppointment={handleChangeRoomAppointment}
      handleAcceptAppointment={handleAcceptAppointment}
      onClose={onClose}
      registerAnchorEl={registerAnchorEl}
    />,
    document.body
  );

/** Dimmed unavailable ranges, drag-availability highlights, and the drop ghost. */
const TimelineOverlays = ({
  unavailableSegments,
  availabilityIntervals,
  draggedAppointmentId,
  draggedAppointmentDurationMinutes,
  draggedAppointmentLabel,
  dropPreviewMinute,
  windowStart,
  windowEnd,
  pixelsPerStep,
}: {
  unavailableSegments: Array<{ startMinute: number; endMinute: number }>;
  availabilityIntervals: Array<{ startMinute: number; endMinute: number }>;
  draggedAppointmentId?: string | null;
  draggedAppointmentDurationMinutes?: number;
  draggedAppointmentLabel?: string | null;
  dropPreviewMinute: number | null;
  windowStart: number;
  windowEnd: number;
  pixelsPerStep: number;
}) => (
  <>
    {unavailableSegments.map((seg) => {
      const top = ((seg.startMinute - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;
      const segHeight = ((seg.endMinute - seg.startMinute) / MINUTES_PER_STEP) * pixelsPerStep;
      return (
        <div
          key={`unavailable-${seg.startMinute}-${seg.endMinute}`}
          className="pointer-events-none absolute left-0 right-0 z-1"
          style={{
            top,
            height: segHeight,
            backgroundColor: 'var(--color-calendar-dim-overlay)',
            transition: 'opacity 0.25s ease',
          }}
        />
      );
    })}
    {draggedAppointmentId &&
      availabilityIntervals.map((interval, index) => {
        const effectiveDuration = Math.max(5, draggedAppointmentDurationMinutes ?? 5);
        const top = ((interval.startMinute - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;
        const bottomMinute = Math.min(windowEnd, interval.endMinute + effectiveDuration);
        const height = Math.max(
          6,
          ((bottomMinute - interval.startMinute) / MINUTES_PER_STEP) * pixelsPerStep
        );
        return (
          <div
            key={`drag-availability-${interval.startMinute}-${interval.endMinute}-${index}`}
            className="pointer-events-none absolute left-1 right-1 z-20 rounded-xl border border-grey-light bg-calendar-availability-overlay"
            style={{ top, height }}
          />
        );
      })}
    {draggedAppointmentId && dropPreviewMinute != null && (
      <div
        className="pointer-events-none absolute left-0 right-0 z-30"
        style={{
          top: ((dropPreviewMinute - windowStart) / MINUTES_PER_STEP) * pixelsPerStep,
        }}
      >
        <div
          className="rounded-xl border-2 border-dashed border-grey-light bg-calendar-preview-overlay"
          style={{
            height: Math.max(
              12,
              (Math.max(5, draggedAppointmentDurationMinutes ?? 30) / MINUTES_PER_STEP) *
                pixelsPerStep
            ),
          }}
        >
          <div className="size-full flex items-center justify-center px-2 text-caption-1 text-blue-text truncate">
            {draggedAppointmentLabel || 'Appointment'}
          </div>
        </div>
      </div>
    )}
  </>
);

const DayCalendarComponent: React.FC<DayCalendarProps> = ({
  events,
  date,
  zoomMode = 'in',
  handleViewAppointment,
  handleDetailAppointment,
  handleOpenWorkspace,
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
  const { notify } = useNotify();
  const onWheelBoundary = useScrollBoundaryWheel();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const {
    activePopoverKey,
    setActivePopoverKey,
    activeRect,
    popoverDialogRef,
    openPopover,
    getPopoverStyle,
    registerAnchorEl,
  } = usePopoverManager({ closeOnHoverLeave: false });
  const appointmentPopoverId = useId();
  const timelineInstructionsId = useId();
  const { weekday, dateNumber } = getDateDisplay(date);
  const now = useCalendarNow();
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);
  const timelineLabel = buildTimelineLabel(date);

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: Appointment[] = [];
    const timed: Appointment[] = [];
    for (const ev of events) {
      if (isAllDayForDate(ev, date)) {
        allDay.push(ev);
      } else {
        timed.push(ev);
      }
    }
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, date]);

  const { windowStart, windowEnd } = useMemo(
    () => computeDayWindow(zoomMode, getVisibleAvailabilityIntervals?.(date) ?? [], timedEvents),
    [date, getVisibleAvailabilityIntervals, timedEvents, zoomMode]
  );
  const pixelsPerStep = getPixelsPerStepForZoom(zoomMode);
  const yScale = pixelsPerStep / PIXELS_PER_STEP;

  const totalHeightPx = ((windowEnd - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;

  const laidOut: LaidOutEvent[] = useMemo(
    () => layoutDayEvents(timedEvents, windowStart, windowEnd),
    [timedEvents, windowStart, windowEnd]
  );

  const getFocusTopPx = useCallback(
    () => computeFocusTopPx(date, now, timedEvents, windowStart, windowEnd, pixelsPerStep, yScale),
    [date, now, timedEvents, windowStart, windowEnd, pixelsPerStep, yScale]
  );

  // Keep a ref to the latest focus position so the scroll effect can read it
  // without depending on it — prevents re-scroll on every availability update.
  const getFocusTopPxRef = useRef(getFocusTopPx);
  useEffect(() => {
    getFocusTopPxRef.current = getFocusTopPx;
  });

  useEffect(() => {
    if (!scrollRef.current || skipAutoScroll) return;
    scrollContainerToTarget(scrollRef.current, getFocusTopPxRef.current());
    // Only re-scroll when the date changes or skip flag is lifted.
    // Availability changes (windowStart/windowEnd) must NOT trigger another scroll.
  }, [date, skipAutoScroll]);

  const isMounted = useHasMounted();

  const activeEvent = useMemo(() => {
    if (!activePopoverKey) return null;
    const allDayMatch = allDayEvents.find(
      (event, idx) => getEventKey(event, idx, 'all-day') === activePopoverKey
    );
    if (allDayMatch) return allDayMatch;
    return (
      laidOut.find((event, idx) => getEventKey(event, idx, 'timed') === activePopoverKey) ?? null
    );
  }, [activePopoverKey, allDayEvents, laidOut]);
  const handleOpenPopover = (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ): void => openPopover(key, target, draggedAppointmentId, clientX, clientY);

  const {
    contextMenuRef,
    contextMenu,
    setContextMenu,
    contextMenuStyle,
    handleMarkerClick,
    handleMarkerDoubleClick,
    handleMarkerContextMenu,
  } = useDayCalendarMarkerInteractions({
    handleOpenPopover,
    setActivePopoverKey,
    handleOpenWorkspace,
    handleDetailAppointment,
  });

  const popoverStyle = getPopoverStyle(440, 490);

  const [prevDraggedAppointmentId, setPrevDraggedAppointmentId] = useState(draggedAppointmentId);
  if (prevDraggedAppointmentId !== draggedAppointmentId) {
    setPrevDraggedAppointmentId(draggedAppointmentId);
    if (draggedAppointmentId) {
      setActivePopoverKey(null);
      setDropPreviewMinute(null);
      setContextMenu(null);
    }
  }

  const availabilityIntervals = getDropAvailabilityIntervals?.(date) ?? [];

  const unavailableSegments = useMemo(() => {
    const visible = getVisibleAvailabilityIntervals?.(date) ?? [];
    return computeUnavailableSegments(visible, availabilityLoaded, windowStart, windowEnd);
  }, [availabilityLoaded, date, getVisibleAvailabilityIntervals, windowStart, windowEnd]);

  const {
    handleTimelineDragOver,
    handleTimelineDragLeave,
    handleTimelineDrop,
    handleTimelineCreate,
    handleTimelineKeyDown,
  } = useTimelineInteractions({
    date,
    windowStart,
    windowEnd,
    draggedAppointmentId,
    availabilityIntervals,
    unavailableSegments,
    onCreateAppointmentAt,
    onDragHoverTarget,
    onAppointmentDropAt,
    setDropPreviewMinute,
    notify,
  });

  return (
    <div className="h-full flex flex-col">
      <DayCalendarHeader weekday={weekday} dateNumber={dateNumber} />
      {allDayEvents.length > 0 && (
        <AllDayEventsRow
          allDayEvents={allDayEvents}
          activePopoverKey={activePopoverKey}
          appointmentPopoverId={appointmentPopoverId}
          onMarkerClick={handleMarkerClick}
          onMarkerDoubleClick={handleMarkerDoubleClick}
          onMarkerContextMenu={handleMarkerContextMenu}
        />
      )}
      <section
        aria-label="Appointment timeline"
        className="overflow-x-hidden flex-1 px-2 pt-2 overflow-y-auto"
        style={{
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
          paddingBottom: zoomMode === 'out' ? 30 : 40,
          paddingTop: 12,
        }}
        ref={scrollRef}
        onWheel={onWheelBoundary}
        onDragOver={handleTimelineDragOver}
        onDragLeave={handleTimelineDragLeave}
        onDrop={handleTimelineDrop}
        data-calendar-scroll="true"
      >
        <div
          data-timeline-grid
          className="relative grid grid-cols-[52px_1fr]"
          style={{
            height: totalHeightPx,
          }}
        >
          {onCreateAppointmentAt && !draggedAppointmentId ? (
            <TimelineCreateOverlay
              timelineInstructionsId={timelineInstructionsId}
              timelineLabel={timelineLabel}
              onCreate={handleTimelineCreate}
              onKeyDown={handleTimelineKeyDown}
            />
          ) : null}
          <TimeLabels
            windowStart={windowStart}
            windowEnd={windowEnd}
            pixelsPerStep={pixelsPerStep}
            slotStepMinutes={slotStepMinutes}
          />
          <div className="relative h-full">
            <HorizontalLines
              date={date}
              now={now}
              windowStart={windowStart}
              windowEnd={windowEnd}
              pixelsPerStep={pixelsPerStep}
              slotStepMinutes={slotStepMinutes}
            />
            <TimelineOverlays
              unavailableSegments={unavailableSegments}
              availabilityIntervals={availabilityIntervals}
              draggedAppointmentId={draggedAppointmentId}
              draggedAppointmentDurationMinutes={draggedAppointmentDurationMinutes}
              draggedAppointmentLabel={draggedAppointmentLabel}
              dropPreviewMinute={dropPreviewMinute}
              windowStart={windowStart}
              windowEnd={windowEnd}
              pixelsPerStep={pixelsPerStep}
            />
            {laidOut.map((ev, i) => (
              <TimedEventMarker
                key={(ev.companion ?? ev.patient).name + i}
                ev={ev}
                itemKey={getEventKey(ev, i, 'timed')}
                yScale={yScale}
                zoomMode={zoomMode}
                activePopoverKey={activePopoverKey}
                appointmentPopoverId={appointmentPopoverId}
                draggedAppointmentId={draggedAppointmentId}
                canDragAppointment={canDragAppointment}
                onMarkerClick={handleMarkerClick}
                onMarkerDoubleClick={handleMarkerDoubleClick}
                onMarkerContextMenu={handleMarkerContextMenu}
                onAppointmentDragStart={onAppointmentDragStart}
                onAppointmentDragEnd={onAppointmentDragEnd}
                onDropPreviewClear={() => setDropPreviewMinute(null)}
              />
            ))}
          </div>
        </div>
        <div style={{ height: zoomMode === 'out' ? 72 : 12 }} />
      </section>
      {isMounted && !draggedAppointmentId && activeEvent && activeRect && (
        <DayCalendarPopoverPortal
          activeEvent={activeEvent}
          invoicesByAppointmentId={invoicesByAppointmentId}
          canEditAppointments={canEditAppointments}
          appointmentPopoverId={appointmentPopoverId}
          popoverDialogRef={popoverDialogRef}
          popoverStyle={popoverStyle}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          handleAcceptAppointment={handleAcceptAppointment}
          onClose={() => setActivePopoverKey(null)}
          registerAnchorEl={registerAnchorEl}
        />
      )}
      {isMounted &&
        contextMenu &&
        contextMenuStyle &&
        createPortal(
          <AppointmentContextMenu
            appointment={contextMenu.appointment}
            canEditAppointments={canEditAppointments}
            menuRef={contextMenuRef}
            menuStyle={contextMenuStyle}
            handleViewAppointment={handleViewAppointment}
            handleRescheduleAppointment={handleRescheduleAppointment}
            onClose={() => setContextMenu(null)}
          />,
          document.body
        )}
    </div>
  );
};

export const DayCalendar = React.memo(DayCalendarComponent);
export default DayCalendar;
