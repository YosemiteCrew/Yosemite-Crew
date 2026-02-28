import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  EVENT_HORIZONTAL_GAP_PX,
  EVENT_VERTICAL_GAP_PX,
  getFirstRelevantTimedEventStart,
  getNowTopPxForWindow,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
  minutesSinceStartOfDay,
  nextDay,
  scrollContainerToTarget,
  getTotalWindowHeightPx,
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
import { allowReschedule } from '@/app/lib/appointments';
import {
  IoEyeOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
} from 'react-icons/io5';
import { MdOutlineAutorenew } from 'react-icons/md';
import { useCalendarNavigation, getDateDisplay } from '@/app/hooks/useCalendarNavigation';
import { createPortal } from 'react-dom';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

type DayCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: (appointment: Appointment) => void;
  handleChangeStatusAppointment?: (appointment: Appointment) => void;
  canEditAppointments: boolean;
  draggedAppointmentId?: string | null;
  draggedAppointmentLabel?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onAppointmentDropAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  onDragHoverTarget?: (date: Date, targetLeadId?: string) => void;
  getDropAvailabilityIntervals?: (
    date: Date,
    targetLeadId?: string
  ) => Array<{ startMinute: number; endMinute: number }>;
  draggedAppointmentDurationMinutes?: number;
};

export const DayCalendar: React.FC<DayCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  canEditAppointments,
  setCurrentDate,
  draggedAppointmentId,
  draggedAppointmentLabel,
  canDragAppointment,
  onAppointmentDragStart,
  onAppointmentDragEnd,
  onAppointmentDropAt,
  onDragHoverTarget,
  getDropAvailabilityIntervals,
  draggedAppointmentDurationMinutes,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const { weekday, dateNumber } = getDateDisplay(date);

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

  const windowStart = DAY_START_MINUTES;
  const windowEnd = DAY_END_MINUTES;

  const totalHeightPx = useMemo(
    () => getTotalWindowHeightPx(windowStart, windowEnd),
    [windowStart, windowEnd]
  );

  const laidOut: LaidOutEvent[] = useMemo(
    () => layoutDayEvents(timedEvents, windowStart, windowEnd),
    [timedEvents, windowStart, windowEnd]
  );

  const focusTopPx = useMemo(() => {
    const nowTopPx = getNowTopPxForWindow(date, windowStart, windowEnd);
    if (nowTopPx != null) return nowTopPx;

    const rangeStart = new Date(date);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = nextDay(rangeStart);
    const focusStart = getFirstRelevantTimedEventStart(
      timedEvents,
      rangeStart,
      rangeEnd
    );

    const focusMinutes = focusStart
      ? minutesSinceStartOfDay(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    const clampedMinutes = Math.max(windowStart, Math.min(focusMinutes, windowEnd));
    return ((clampedMinutes - windowStart) / MINUTES_PER_STEP) * PIXELS_PER_STEP;
  }, [date, timedEvents, windowStart, windowEnd]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollContainerToTarget(scrollRef.current, focusTopPx);
  }, [focusTopPx]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!activePopoverKey) return;
    const closePopover = () => setActivePopoverKey(null);
    window.addEventListener('scroll', closePopover, true);
    window.addEventListener('resize', closePopover);
    return () => {
      window.removeEventListener('scroll', closePopover, true);
      window.removeEventListener('resize', closePopover);
    };
  }, [activePopoverKey]);

  useEffect(() => {
    if (!draggedAppointmentId) return;
    setActivePopoverKey(null);
    setDropPreviewMinute(null);
  }, [draggedAppointmentId]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const schedulePopoverClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActivePopoverKey(null);
    }, 120);
  }, [clearCloseTimer]);

  useEffect(() => {
    const dialogEl = popoverDialogRef.current;
    if (!dialogEl || !activePopoverKey) return;

    const onMouseEnter = () => clearCloseTimer();
    const onMouseLeave = () => schedulePopoverClose();
    const onFocusIn = () => clearCloseTimer();
    const onFocusOut = (event: FocusEvent) => {
      const nextFocused = event.relatedTarget as Node | null;
      if (!nextFocused || !dialogEl.contains(nextFocused)) {
        schedulePopoverClose();
      }
    };
    const onTouchStart = () => clearCloseTimer();
    const onTouchEnd = () => schedulePopoverClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePopoverKey(null);
      }
    };

    dialogEl.addEventListener('mouseenter', onMouseEnter);
    dialogEl.addEventListener('mouseleave', onMouseLeave);
    dialogEl.addEventListener('focusin', onFocusIn);
    dialogEl.addEventListener('focusout', onFocusOut);
    dialogEl.addEventListener('touchstart', onTouchStart, { passive: true });
    dialogEl.addEventListener('touchend', onTouchEnd, { passive: true });
    dialogEl.addEventListener('keydown', onKeyDown);

    return () => {
      dialogEl.removeEventListener('mouseenter', onMouseEnter);
      dialogEl.removeEventListener('mouseleave', onMouseLeave);
      dialogEl.removeEventListener('focusin', onFocusIn);
      dialogEl.removeEventListener('focusout', onFocusOut);
      dialogEl.removeEventListener('touchstart', onTouchStart);
      dialogEl.removeEventListener('touchend', onTouchEnd);
      dialogEl.removeEventListener('keydown', onKeyDown);
    };
  }, [activePopoverKey, clearCloseTimer, schedulePopoverClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearCloseTimer();
      }
    };
  }, [clearCloseTimer]);

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

  const formatTimeRange = (event: Appointment) => {
    const start = event.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const end = event.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${start} - ${end}`;
  };

  const formatStatusLabel = (status?: string) => {
    if (!status) return 'Unknown';
    return status
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getPopoverStyle = () => {
    if (!activeRect) return { top: 0, left: 0 };
    const popoverWidth = 360;
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const preferredLeft = activeRect.right + margin;
    const maxLeft = viewportWidth - popoverWidth - margin;
    const left = Math.max(margin, Math.min(preferredLeft, maxLeft));
    return {
      top: Math.max(margin, activeRect.top),
      left,
      width: popoverWidth,
    };
  };

  const openPopover = (key: string, target: HTMLButtonElement) => {
    if (draggedAppointmentId) return;
    clearCloseTimer();
    setActiveRect(target.getBoundingClientRect());
    setActivePopoverKey(key);
  };

  const setCustomDragGhost = (
    event: React.DragEvent<HTMLButtonElement>,
    appointment: Appointment,
  ) => {
    const ghost = document.createElement('img');
    ghost.src = getSafeImageUrl(
      '',
      appointment.companion.species.toLowerCase() as ImageType,
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
    window.setTimeout(() => {
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

  const getNearestAvailableMinute = (minute: number) => {
    const DROP_TOLERANCE_MINUTES = 12;
    const snapped = Math.round(minute / 5) * 5;
    let bestMatch: { minute: number; distance: number } | null = null;
    for (const interval of availabilityIntervals) {
      const candidateMinute = Math.max(
        interval.startMinute,
        Math.min(interval.endMinute, snapped)
      );
      const distance = Math.abs(minute - candidateMinute);
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { minute: candidateMinute, distance };
      }
    }
    if (!bestMatch || bestMatch.distance > DROP_TOLERANCE_MINUTES) return null;
    return bestMatch.minute;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <Back onClick={handlePrevDay} />
        <div className="flex flex-col">
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
                  onMouseEnter={(event) => openPopover(itemKey, event.currentTarget)}
                  onMouseLeave={schedulePopoverClose}
                  className="flex items-center gap-2 rounded-full! px-3 py-1 text-xs font-satoshi"
                  style={getStatusStyle(ev.status)}
                >
                  <Image
                    src={MEDIA_SOURCES.appointments.companionAvatar}
                    height={20}
                    width={20}
                    className="rounded-full"
                    alt={''}
                  />
                  <span className="font-medium truncate max-w-40">{ev.companion.name}</span>
                  <span className="opacity-70 truncate max-w-[120px]">{ev.concern || ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div
        className="overflow-y-auto overflow-x-hidden flex-1 px-2 max-h-[680px]"
        ref={scrollRef}
        data-calendar-scroll="true"
      >
        <div
          className="grid grid-cols-[52px_1fr]"
          style={{
            height: totalHeightPx,
          }}
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
          <TimeLabels windowStart={windowStart} windowEnd={windowEnd} />
          <div className="relative h-full">
            <HorizontalLines
              date={date}
              windowStart={windowStart}
              windowEnd={windowEnd}
            />
            {draggedAppointmentId &&
              availabilityIntervals.map((interval, index) => {
                const effectiveDuration = Math.max(
                  5,
                  draggedAppointmentDurationMinutes ?? 5
                );
                const top =
                  ((interval.startMinute - windowStart) / MINUTES_PER_STEP) * PIXELS_PER_STEP;
                const bottomMinute = Math.min(
                  windowEnd,
                  interval.endMinute + effectiveDuration
                );
                const height = Math.max(
                  6,
                  ((bottomMinute - interval.startMinute) / MINUTES_PER_STEP) * PIXELS_PER_STEP
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
                  top: ((dropPreviewMinute - windowStart) / MINUTES_PER_STEP) * PIXELS_PER_STEP,
                }}
              >
                <div
                  className="rounded-xl border-2 border-dashed border-grey-light bg-[rgba(36,122,237,0.18)]"
                  style={{
                    height: Math.max(
                      12,
                      ((Math.max(5, draggedAppointmentDurationMinutes ?? 30)) /
                        MINUTES_PER_STEP) *
                        PIXELS_PER_STEP
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
              const verticalGapPx = EVENT_VERTICAL_GAP_PX;
              return (
                <div
                  key={ev.companion.name + i}
                  className="absolute rounded-2xl! px-3 py-1 overflow-hidden scrollbar-hidden whitespace-nowrap text-ellipsis flex items-center justify-between"
                  style={{
                    top: ev.topPx,
                    height: Math.max(ev.heightPx - verticalGapPx, 12),
                    left: `calc(${leftPercent}% + ${horizontalGapPx}px)`,
                    width: `calc(${widthPercent}% - ${horizontalGapPx * 2}px)`,
                    ...getStatusStyle(ev.status),
                  }}
                >
                  <button
                    type="button"
                    className="h-full w-full flex-1 min-w-0 flex items-center justify-between cursor-pointer"
                    onClick={() => handleViewAppointment(ev)}
                    onMouseEnter={(event) => openPopover(itemKey, event.currentTarget)}
                    onMouseLeave={schedulePopoverClose}
                    draggable={!!canDragAppointment?.(ev)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', ev.id ?? itemKey);
                      setCustomDragGhost(event, ev);
                      onAppointmentDragStart?.(ev);
                    }}
                    onDragEnd={() => {
                      setDropPreviewMinute(null);
                      onAppointmentDragEnd?.();
                    }}
                    style={{
                      opacity: draggedAppointmentId === ev.id ? 0.55 : 1,
                    }}
                  >
                    <div className="text-body-4 truncate">{ev.companion.name}</div>
                    <div className="flex items-center gap-1">
                      <Image
                        src={getSafeImageUrl('', ev.companion.species.toLowerCase() as ImageType)}
                        height={30}
                        width={30}
                        className="rounded-full flex-none"
                        alt={''}
                      />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {isMounted &&
        !draggedAppointmentId &&
        activeEvent &&
        activeRect &&
        createPortal(
          <dialog
            ref={popoverDialogRef}
            open
            className="fixed z-120 w-[380px] rounded-2xl border border-card-border bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
            style={getPopoverStyle()}
            aria-label="Appointment quick actions"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <Image
                  src={getSafeImageUrl('', activeEvent.companion.species.toLowerCase() as ImageType)}
                  height={34}
                  width={34}
                  className="rounded-full border border-card-border bg-white"
                  alt={''}
                />
                <div className="min-w-0">
                  <div className="text-body-3-emphasis text-text-primary truncate">
                    {activeEvent.companion.name || '-'}
                  </div>
                  <div className="text-caption-1 text-text-secondary truncate">
                    {activeEvent.companion.breed || '-'} / {activeEvent.companion.species || '-'}
                  </div>
                </div>
              </div>
              <span
                className="text-[10px] leading-4 font-medium px-2 py-1 rounded-full text-white whitespace-nowrap"
                style={{
                  backgroundColor: getStatusStyle(activeEvent.status).backgroundColor || '#1a73e8',
                }}
              >
                {formatStatusLabel(activeEvent.status)}
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-card-border bg-card-hover px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="text-caption-1 text-text-secondary">Time</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {formatTimeRange(activeEvent)}
              </div>
              <div className="text-caption-1 text-text-secondary">Parent</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.companion.parent?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Lead</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.lead?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Service</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.appointmentType?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Room</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.room?.name || '-'}
              </div>
            </div>

            <div className="mt-2 text-caption-1 text-text-secondary">Reason</div>
            <div className="text-caption-1 text-text-primary min-h-6 line-clamp-2">
              {activeEvent.concern || '-'}
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-card-border pt-2">
              {canEditAppointments && (
                <button
                  type="button"
                  title="Change status"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    if (handleChangeStatusAppointment) {
                      handleChangeStatusAppointment(activeEvent);
                    } else {
                      handleViewAppointment(activeEvent);
                    }
                    setActivePopoverKey(null);
                  }}
                >
                  <MdOutlineAutorenew size={18} />
                </button>
              )}
              <button
                type="button"
                title="View"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(activeEvent);
                  setActivePopoverKey(null);
                }}
              >
                <IoEyeOutline size={18} />
              </button>
              {canEditAppointments && allowReschedule(activeEvent.status) && (
                <button
                  type="button"
                  title="Reschedule"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleRescheduleAppointment(activeEvent);
                    setActivePopoverKey(null);
                  }}
                >
                  <IoCalendarOutline size={18} />
                </button>
              )}
              <button
                type="button"
                title="SOAP"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(activeEvent, {
                    label: 'prescription',
                    subLabel: 'subjective',
                  });
                  setActivePopoverKey(null);
                }}
              >
                <IoDocumentTextOutline size={18} />
              </button>
              <button
                type="button"
                title="Finance"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(activeEvent, {
                    label: 'finance',
                    subLabel: 'summary',
                  });
                  setActivePopoverKey(null);
                }}
              >
                <IoCardOutline size={18} />
              </button>
              <button
                type="button"
                title="Labs"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(activeEvent, {
                    label: 'labs',
                    subLabel: 'idexx-labs',
                  });
                  setActivePopoverKey(null);
                }}
              >
                <IoFlaskOutline size={18} />
              </button>
            </div>
          </dialog>,
          document.body
        )}
    </div>
  );
};

export default DayCalendar;
