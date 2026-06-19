import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  EVENT_HORIZONTAL_GAP_PX,
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
import { getStatusStyle } from '@/app/config/statusConfig';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import Next from '@/app/ui/primitives/Icons/Next';
import Back from '@/app/ui/primitives/Icons/Back';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { useCalendarNavigation, getDateDisplay } from '@/app/hooks/useCalendarNavigation';
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
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import { useNotify } from '@/app/hooks/useNotify';

type DayCalendarProps = {
  events: Appointment[];
  date: Date;
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  handleDetailAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeRoomAppointment?: (appointment: Appointment) => void;
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

const getCompanionDisplayName = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(
    (appointment.companion ?? appointment.patient).name,
    (appointment.companion ?? appointment.patient).parent
  );

const getAllDayAppointmentAriaLabel = (appointment: Appointment) => {
  const concernSuffix = appointment.concern ? `. ${appointment.concern}` : '';
  return `All-day appointment for ${getCompanionDisplayName(appointment)}${concernSuffix}`;
};

const MARKER_CLICK_DELAY_MS = 180;

const getEventKey = (event: Appointment, index: number, source: 'all-day' | 'timed') =>
  `${source}-${(event.companion ?? event.patient).name}-${event.startTime.toISOString()}-${index}`;

const setCustomDragGhost = (
  event: React.DragEvent<HTMLButtonElement>,
  appointment: Appointment
) => {
  const ghost = document.createElement('img');
  ghost.src = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(appointment.companion ?? appointment.patient),
    (appointment.companion ?? appointment.patient).species.toLowerCase() as ImageType
  );
  ghost.width = 24;
  ghost.height = 24;
  ghost.style.position = 'fixed';
  ghost.style.top = '-9999px';
  ghost.style.left = '-9999px';
  ghost.style.width = '24px';
  ghost.style.height = '24px';
  ghost.style.borderRadius = '999px';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 12, 12);
  globalThis.setTimeout(() => {
    ghost.remove();
  }, 0);
};

const shouldIgnoreTimelineCreate = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const closest = target.closest('button, a, input, textarea, select');
  return !!closest && !('timelineCreate' in (closest as HTMLElement).dataset);
};

const getTimelineGrid = (el: HTMLElement): HTMLDivElement | null =>
  el.querySelector<HTMLDivElement>('[data-timeline-grid]');

type ContextMenuState = {
  appointment: Appointment;
  x: number;
  y: number;
};

const swallowNextClick = () => {
  const handleClickCapture = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if ('stopImmediatePropagation' in event) {
      event.stopImmediatePropagation();
    }
    globalThis.removeEventListener('click', handleClickCapture, true);
  };
  globalThis.addEventListener('click', handleClickCapture, true);
};

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

const DayCalendarComponent: React.FC<DayCalendarProps> = ({
  events,
  date,
  zoomMode = 'in',
  handleViewAppointment,
  handleDetailAppointment,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  canEditAppointments,
  setCurrentDate,
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
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const { weekday, dateNumber } = getDateDisplay(date);
  const now = useCalendarNow();
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);
  const timelineLabel = `Appointments timeline for ${formatDateInPreferredTimeZone(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })}`;

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

  const { windowStart, windowEnd } = useMemo(() => {
    if (zoomMode === 'out') {
      return { windowStart: DAY_START_MINUTES, windowEnd: DAY_END_MINUTES };
    }
    const availability = getVisibleAvailabilityIntervals?.(date) ?? [];
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
  }, [date, getVisibleAvailabilityIntervals, timedEvents, zoomMode]);
  const pixelsPerStep = getPixelsPerStepForZoom(zoomMode);
  const yScale = pixelsPerStep / PIXELS_PER_STEP;

  const totalHeightPx = ((windowEnd - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;

  const laidOut: LaidOutEvent[] = useMemo(
    () => layoutDayEvents(timedEvents, windowStart, windowEnd),
    [timedEvents, windowStart, windowEnd]
  );

  const getFocusTopPx = useCallback(() => {
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
  }, [date, now, timedEvents, windowStart, windowEnd, pixelsPerStep, yScale]);

  // Keep a ref to the latest focus position so the scroll effect can read it
  // without depending on it — prevents re-scroll on every availability update.
  const getFocusTopPxRef = useRef(getFocusTopPx);
  getFocusTopPxRef.current = getFocusTopPx;

  useEffect(() => {
    if (!scrollRef.current || skipAutoScroll) return;
    scrollContainerToTarget(scrollRef.current, getFocusTopPxRef.current());
    // Only re-scroll when the date changes or skip flag is lifted.
    // Availability changes (windowStart/windowEnd) must NOT trigger another scroll.
  }, [date, skipAutoScroll]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!draggedAppointmentId) return;
    setActivePopoverKey(null);
    setDropPreviewMinute(null);
    setContextMenu(null);
  }, [draggedAppointmentId, setActivePopoverKey]);

  useEffect(
    () => () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => setContextMenu(null);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation();
      }
      swallowNextClick();
      setContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    globalThis.addEventListener('pointerdown', handlePointerDown, true);
    globalThis.addEventListener('scroll', closeContextMenu, true);
    globalThis.addEventListener('resize', closeContextMenu);
    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.removeEventListener('pointerdown', handlePointerDown, true);
      globalThis.removeEventListener('scroll', closeContextMenu, true);
      globalThis.removeEventListener('resize', closeContextMenu);
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

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

  const popoverStyle = getPopoverStyle(440, 490);
  const contextMenuStyle = useMemo(() => {
    if (!contextMenu) return null;
    const width = 280;
    const height = 420;
    const margin = 12;
    const left = Math.max(margin, Math.min(contextMenu.x, globalThis.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(contextMenu.y, globalThis.innerHeight - height - margin));
    return { left, top, width };
  }, [contextMenu]);

  const getMinuteFromTimelinePointer = (clientY: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height > 0 ? y / rect.height : 0;
    const rawMinute = windowStart + ratio * (windowEnd - windowStart);
    return Math.max(windowStart, Math.min(windowEnd, Math.round(rawMinute / 5) * 5));
  };

  const availabilityIntervals = getDropAvailabilityIntervals?.(date) ?? [];

  const unavailableSegments = useMemo(() => {
    const visible = getVisibleAvailabilityIntervals?.(date) ?? [];
    return computeUnavailableSegments(visible, availabilityLoaded, windowStart, windowEnd);
  }, [availabilityLoaded, date, getVisibleAvailabilityIntervals, windowStart, windowEnd]);

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

  const clearPendingMarkerClick = () => {
    if (!clickTimerRef.current) return;
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  };

  const handleMarkerClick = (event: React.MouseEvent<HTMLButtonElement>, key: string) => {
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    clearPendingMarkerClick();
    setContextMenu(null);
    clickTimerRef.current = setTimeout(() => {
      handleOpenPopover(key, target, clientX, clientY);
      clickTimerRef.current = null;
    }, MARKER_CLICK_DELAY_MS);
  };

  const handleMarkerDoubleClick = (appointment: Appointment) => {
    clearPendingMarkerClick();
    setContextMenu(null);
    setActivePopoverKey(null);
    handleDetailAppointment(appointment);
  };

  const handleMarkerContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    appointment: Appointment
  ) => {
    event.preventDefault();
    clearPendingMarkerClick();
    setActivePopoverKey(null);
    setContextMenu({
      appointment,
      x: event.clientX,
      y: event.clientY,
    });
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-grey-light shrink-0">
        <Back onClick={handlePrevDay} />
        <div className="flex items-center gap-2 text-center">
          <div className="text-body-4 text-(--color-primary-700)">{weekday}</div>
          <div className="text-body-4-emphasis text-white size-10 flex items-center justify-center rounded-full bg-text-brand">
            {dateNumber}
          </div>
        </div>
        <Next onClick={handleNextDay} />
      </div>
      {allDayEvents.length > 0 && (
        <div className="p-2 border-b border-grey-light bg-slate-50 shrink-0">
          <div className="text-xs font-satoshi text-grey-text mb-1">All-day</div>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((ev, idx) => {
              const itemKey = getEventKey(ev, idx, 'all-day');
              return (
                <button
                  key={itemKey}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={activePopoverKey === itemKey}
                  aria-controls={appointmentPopoverId}
                  aria-label={getAllDayAppointmentAriaLabel(ev)}
                  onClick={(event) => handleMarkerClick(event, itemKey)}
                  onDoubleClick={() => handleMarkerDoubleClick(ev)}
                  onContextMenu={(event) => handleMarkerContextMenu(event, ev)}
                  className="flex items-center gap-2 rounded-full! px-3 py-1 text-xs font-satoshi"
                  style={getStatusStyle(ev.status)}
                >
                  <Image
                    src={getSafeImageUrl(
                      getAppointmentCompanionPhotoUrl(ev.companion),
                      (ev.companion ?? ev.patient).species.toLowerCase() as ImageType
                    )}
                    height={20}
                    width={20}
                    priority
                    className="size-5 rounded-full object-cover"
                    alt={''}
                  />
                  <span className="font-medium truncate max-w-40">
                    {getCompanionDisplayName(ev)}
                  </span>
                  <span className="opacity-70 truncate max-w-30">{ev.concern || ''}</span>
                </button>
              );
            })}
          </div>
        </div>
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
            <>
              <p id={timelineInstructionsId} className="sr-only">
                Press Enter or Space to create an appointment at the middle of this visible
                timeline, or click a time slot directly.
              </p>
              <button
                type="button"
                data-timeline-create
                aria-label={timelineLabel}
                aria-describedby={timelineInstructionsId}
                className="absolute inset-0 col-span-2 z-0 w-full h-full cursor-default bg-transparent border-0 p-0"
                onClick={handleTimelineCreate}
                onDoubleClick={handleTimelineCreate}
                onKeyDown={handleTimelineKeyDown}
              />
            </>
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
            {unavailableSegments.map((seg) => {
              const top = ((seg.startMinute - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;
              const segHeight =
                ((seg.endMinute - seg.startMinute) / MINUTES_PER_STEP) * pixelsPerStep;
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
                const top =
                  ((interval.startMinute - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;
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
                  <div className="size-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
                    {draggedAppointmentLabel || 'Appointment'}
                  </div>
                </div>
              </div>
            )}
            {laidOut.map((ev, i) => {
              const itemKey = getEventKey(ev, i, 'timed');
              const widthPercent = 100 / ev.columnsCount;
              const leftPercent = widthPercent * ev.columnIndex;
              const horizontalGapPx = EVENT_HORIZONTAL_GAP_PX;
              const verticalGapPx = 0;
              const isZoomOut = zoomMode === 'out';
              const statusStyle = getStatusStyle(ev.status);
              const serviceName = ev.appointmentType?.name?.trim() ?? '';
              const concern = ev.concern?.trim() ?? '';
              const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
              const companionDisplayName = getCompanionDisplayName(ev);
              const markerTitle = subtitle
                ? `${companionDisplayName} • ${subtitle}`
                : companionDisplayName;
              const draggable = !!canDragAppointment?.(ev);
              return (
                <div
                  key={(ev.companion ?? ev.patient).name + i}
                  className={`absolute scrollbar-hidden ${isZoomOut ? 'rounded-md! p-0 bg-transparent' : 'rounded-xl! px-2 py-1.5 overflow-hidden'}`}
                  style={{
                    top: ev.topPx * yScale,
                    height: Math.max(
                      ev.heightPx * yScale - (isZoomOut ? 0 : verticalGapPx),
                      isZoomOut ? 3 : 40
                    ),
                    left: `calc(${leftPercent}% + ${horizontalGapPx}px)`,
                    width: `calc(${widthPercent}% - ${horizontalGapPx * 2}px)`,
                    ...(isZoomOut
                      ? {}
                      : {
                          backgroundColor: statusStyle.backgroundColor,
                          color: statusStyle.color,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: statusStyle.borderColor,
                        }),
                  }}
                >
                  {isZoomOut && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0.5 right-0.5 rounded-sm"
                      style={{
                        backgroundColor: statusStyle.backgroundColor,
                      }}
                    />
                  )}
                  <button
                    type="button"
                    className={`min-w-0 ${
                      draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${isZoomOut ? 'absolute inset-x-0 -inset-y-2 z-20' : 'size-full flex items-center gap-2'}`}
                    aria-haspopup="dialog"
                    aria-expanded={activePopoverKey === itemKey}
                    aria-controls={appointmentPopoverId}
                    onClick={(event) => handleMarkerClick(event, itemKey)}
                    onDoubleClick={() => handleMarkerDoubleClick(ev)}
                    onContextMenu={(event) => handleMarkerContextMenu(event, ev)}
                    draggable={draggable}
                    title={markerTitle}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', ev.id ?? itemKey);
                      setCustomDragGhost(event, ev);
                      document.body.style.cursor = 'grabbing';
                      onAppointmentDragStart?.(ev);
                    }}
                    onDragEnd={() => {
                      setDropPreviewMinute(null);
                      document.body.style.cursor = '';
                      onAppointmentDragEnd?.();
                    }}
                    style={{
                      opacity: draggedAppointmentId === ev.id ? 0.55 : 1,
                    }}
                  >
                    {!isZoomOut && (
                      <>
                        <div className="min-w-0 flex-1 self-center">
                          <div className="w-full flex flex-col items-center justify-center text-center gap-0.5">
                            <div className="truncate w-full text-caption-1 font-bold leading-[1.2]">
                              {companionDisplayName}
                            </div>
                            {subtitle && (
                              <div className="font-satoshi text-[11px] font-normal leading-[1.2] tracking-[-0.22px] w-full truncate">
                                {subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-none self-center">
                          <Image
                            src={getSafeImageUrl(
                              getAppointmentCompanionPhotoUrl(ev.companion),
                              (ev.companion ?? ev.patient).species.toLowerCase() as ImageType
                            )}
                            height={26}
                            width={26}
                            priority
                            className="rounded-full border border-white/60 object-cover"
                            style={{ width: 26, height: 26 }}
                            alt=""
                          />
                        </div>
                      </>
                    )}
                    {isZoomOut && <span className="sr-only">{markerTitle}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: zoomMode === 'out' ? 72 : 12 }} />
      </section>
      {isMounted &&
        !draggedAppointmentId &&
        activeEvent &&
        activeRect &&
        createPortal(
          <AppointmentPopover
            appointment={activeEvent}
            invoicesByAppointmentId={invoicesByAppointmentId}
            canEditAppointments={canEditAppointments}
            popoverId={appointmentPopoverId}
            popoverDialogRef={popoverDialogRef}
            popoverStyle={popoverStyle}
            handleViewAppointment={handleViewAppointment}
            handleDetailAppointment={handleDetailAppointment}
            handleRescheduleAppointment={handleRescheduleAppointment}
            handleChangeRoomAppointment={handleChangeRoomAppointment}
            onClose={() => setActivePopoverKey(null)}
            registerAnchorEl={registerAnchorEl}
          />,
          document.body
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
            handleDetailAppointment={handleDetailAppointment}
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
