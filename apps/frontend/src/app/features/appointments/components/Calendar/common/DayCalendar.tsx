import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getMinutesSinceStartOfDayInPreferredTimeZone } from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';

type DayCalendarProps = {
  events: Appointment[];
  date: Date;
  zoomMode?: CalendarZoomMode;
  handleViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeStatusAppointment?: (appointment: Appointment) => void;
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
};

const getCompanionDisplayName = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(appointment.companion?.name, appointment.companion?.parent);

export const DayCalendar: React.FC<DayCalendarProps> = ({
  events,
  date,
  zoomMode = 'in',
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
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
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const {
    activePopoverKey,
    setActivePopoverKey,
    activeRect,
    popoverDialogRef,
    schedulePopoverClose,
    openPopover,
    getPopoverStyle,
  } = usePopoverManager();
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const { weekday, dateNumber } = getDateDisplay(date);
  const now = useCalendarNow();
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);

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

  const totalHeightPx = useMemo(
    () => ((windowEnd - windowStart) / MINUTES_PER_STEP) * pixelsPerStep,
    [pixelsPerStep, windowEnd, windowStart]
  );

  const laidOut: LaidOutEvent[] = useMemo(
    () => layoutDayEvents(timedEvents, windowStart, windowEnd),
    [timedEvents, windowStart, windowEnd]
  );

  const focusTopPx = useMemo(() => {
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

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollContainerToTarget(scrollRef.current, focusTopPx);
  }, [focusTopPx]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!draggedAppointmentId) return;
    setActivePopoverKey(null);
    setDropPreviewMinute(null);
  }, [draggedAppointmentId, setActivePopoverKey]);

  const getEventKey = (event: Appointment, index: number, source: 'all-day' | 'timed') =>
    `${source}-${event.companion.name}-${event.startTime.toISOString()}-${index}`;

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

  const popoverStyle = getPopoverStyle(360, 340);

  const setCustomDragGhost = (
    event: React.DragEvent<HTMLButtonElement>,
    appointment: Appointment
  ) => {
    const ghost = document.createElement('img');
    ghost.src = getSafeImageUrl(
      getAppointmentCompanionPhotoUrl(appointment.companion),
      appointment.companion.species.toLowerCase() as ImageType
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
    if (!visible.length) {
      if (!availabilityLoaded) return [];
      return [{ startMinute: windowStart, endMinute: windowEnd }];
    }
    const segments: { startMinute: number; endMinute: number }[] = [];
    const sorted = [...visible].sort((a, b) => a.startMinute - b.startMinute);
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
  }, [availabilityLoaded, date, getVisibleAvailabilityIntervals, windowStart, windowEnd]);

  const getNearestAvailableMinute = (minute: number) =>
    calcNearestAvailableMinute(minute, availabilityIntervals);

  const createAppointmentAtMinute = (clientY: number, container: HTMLDivElement) => {
    if (!onCreateAppointmentAt || draggedAppointmentId) return;
    const minute = getMinuteFromTimelinePointer(clientY, container);
    onCreateAppointmentAt(date, Math.round(minute / 5) * 5);
  };

  const createAppointmentAtOffset = (offsetY: number, container: HTMLDivElement) => {
    if (!onCreateAppointmentAt || draggedAppointmentId) return;
    const rect = container.getBoundingClientRect();
    createAppointmentAtMinute(rect.top + offsetY, container);
  };

  const shouldIgnoreTimelineCreate = (target: EventTarget | null) =>
    target instanceof HTMLElement && !!target.closest('button, a, input, textarea, select');

  const handleTimelineCreate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreTimelineCreate(event.target)) return;
    createAppointmentAtMinute(event.clientY, event.currentTarget);
  };

  const handleTimelineKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    createAppointmentAtOffset(event.currentTarget.clientHeight / 2, event.currentTarget);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <Back onClick={handlePrevDay} />
        <div className="flex items-center gap-2 text-center">
          <div className="text-body-4 text-text-brand">{weekday}</div>
          <div className="text-body-4-emphasis text-white h-10 w-10 flex items-center justify-center rounded-full bg-text-brand">
            {dateNumber}
          </div>
        </div>
        <Next onClick={handleNextDay} />
      </div>
      {allDayEvents.length > 0 && (
        <div className="px-2 py-2 border-b border-grey-light bg-slate-50">
          <div className="text-xs font-satoshi text-[#747473] mb-1">All-day</div>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((ev, idx) => {
              const itemKey = getEventKey(ev, idx, 'all-day');
              return (
                <button
                  key={itemKey}
                  type="button"
                  onClick={() => handleViewAppointment(ev)}
                  onMouseEnter={(event) =>
                    handleOpenPopover(itemKey, event.currentTarget, event.clientX, event.clientY)
                  }
                  onMouseLeave={schedulePopoverClose}
                  className="flex items-center gap-2 rounded-full! px-3 py-1 text-xs font-satoshi"
                  style={getStatusStyle(ev.status)}
                >
                  <Image
                    src={getSafeImageUrl(
                      getAppointmentCompanionPhotoUrl(ev.companion),
                      ev.companion.species.toLowerCase() as ImageType
                    )}
                    height={20}
                    width={20}
                    className="h-5 w-5 rounded-full object-cover"
                    alt={''}
                  />
                  <span className="font-medium truncate max-w-40">
                    {getCompanionDisplayName(ev)}
                  </span>
                  <span className="opacity-70 truncate max-w-[120px]">{ev.concern || ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div
        className="overflow-x-hidden flex-1 px-2 pt-2"
        style={{
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
          overflowY: 'auto',
          paddingBottom: zoomMode === 'out' ? 30 : 40,
          paddingTop: 12,
        }}
        ref={scrollRef}
        data-calendar-scroll="true"
      >
        <div
          role="application"
          tabIndex={onCreateAppointmentAt && !draggedAppointmentId ? 0 : -1}
          aria-label={
            onCreateAppointmentAt && !draggedAppointmentId
              ? 'Create appointment in this calendar day'
              : undefined
          }
          className="grid grid-cols-[52px_1fr]"
          style={{
            height: totalHeightPx,
          }}
          onClick={
            onCreateAppointmentAt && !draggedAppointmentId ? handleTimelineCreate : undefined
          }
          onDoubleClick={
            onCreateAppointmentAt && !draggedAppointmentId ? handleTimelineCreate : undefined
          }
          onKeyDown={
            onCreateAppointmentAt && !draggedAppointmentId ? handleTimelineKeyDown : undefined
          }
          onDragOver={(event) => {
            if (!draggedAppointmentId) return;
            event.preventDefault();
            onDragHoverTarget?.(date);
            const minute = getMinuteFromTimelinePointer(
              event.clientY,
              event.currentTarget as HTMLDivElement
            );
            setDropPreviewMinute(getNearestAvailableMinute(minute));
          }}
          onDragLeave={(event) => {
            if (!draggedAppointmentId) return;
            const nextTarget = event.relatedTarget as Node | null;
            if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
              setDropPreviewMinute(null);
            }
          }}
          onDrop={(event) => {
            if (!draggedAppointmentId || !onAppointmentDropAt) return;
            event.preventDefault();
            const minute = getMinuteFromTimelinePointer(
              event.clientY,
              event.currentTarget as HTMLDivElement
            );
            const nearest = getNearestAvailableMinute(minute);
            setDropPreviewMinute(null);
            if (nearest == null) return;
            onAppointmentDropAt(date, nearest);
          }}
        >
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
                  className="pointer-events-none absolute left-0 right-0 z-[1]"
                  style={{ top, height: segHeight, backgroundColor: 'rgba(0,0,0,0.045)' }}
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
                    className="pointer-events-none absolute left-1 right-1 z-20 rounded-xl border border-grey-light bg-[rgba(42,168,121,0.12)]"
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
                  className="rounded-xl border-2 border-dashed border-grey-light bg-[rgba(36,122,237,0.18)]"
                  style={{
                    height: Math.max(
                      12,
                      (Math.max(5, draggedAppointmentDurationMinutes ?? 30) / MINUTES_PER_STEP) *
                        pixelsPerStep
                    ),
                  }}
                >
                  <div className="h-full w-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
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
                  key={ev.companion.name + i}
                  className={`absolute scrollbar-hidden ${isZoomOut ? 'rounded-md! px-0 py-0 border-0 bg-transparent' : 'rounded-xl! px-2 py-1.5 overflow-hidden'}`}
                  style={{
                    top: ev.topPx * yScale,
                    height: Math.max(
                      ev.heightPx * yScale - (isZoomOut ? 0 : verticalGapPx),
                      isZoomOut ? 3 : 40
                    ),
                    left: `calc(${leftPercent}% + ${horizontalGapPx}px)`,
                    width: `calc(${widthPercent}% - ${horizontalGapPx * 2}px)`,
                    ...(isZoomOut ? {} : statusStyle),
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
                    } ${isZoomOut ? 'absolute inset-x-0 -inset-y-2 z-20' : 'h-full w-full flex items-center gap-2'}`}
                    onClick={() => handleViewAppointment(ev)}
                    onMouseEnter={(event) =>
                      handleOpenPopover(itemKey, event.currentTarget, event.clientX, event.clientY)
                    }
                    onMouseLeave={schedulePopoverClose}
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
                            <div className="truncate w-full text-caption-1 font-semibold">
                              {companionDisplayName}
                            </div>
                            {subtitle && (
                              <div className="text-[10px] w-full truncate opacity-95">
                                {subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-none self-center">
                          <Image
                            src={getSafeImageUrl(
                              getAppointmentCompanionPhotoUrl(ev.companion),
                              ev.companion.species.toLowerCase() as ImageType
                            )}
                            height={26}
                            width={26}
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
      </div>
      {isMounted &&
        !draggedAppointmentId &&
        activeEvent &&
        activeRect &&
        createPortal(
          <AppointmentPopover
            appointment={activeEvent}
            invoicesByAppointmentId={invoicesByAppointmentId}
            canEditAppointments={canEditAppointments}
            popoverDialogRef={popoverDialogRef}
            popoverStyle={popoverStyle}
            handleViewAppointment={handleViewAppointment}
            handleRescheduleAppointment={handleRescheduleAppointment}
            handleChangeStatusAppointment={handleChangeStatusAppointment}
            handleChangeRoomAppointment={handleChangeRoomAppointment}
            onClose={() => setActivePopoverKey(null)}
          />,
          document.body
        )}
    </div>
  );
};

export default DayCalendar;
