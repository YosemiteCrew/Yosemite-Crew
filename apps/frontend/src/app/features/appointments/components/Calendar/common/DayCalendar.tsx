import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EVENT_HORIZONTAL_GAP_PX,
  EVENT_VERTICAL_GAP_PX,
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
};

export const DayCalendar: React.FC<DayCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  canEditAppointments,
  setCurrentDate,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
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
    clearCloseTimer();
    setActiveRect(target.getBoundingClientRect());
    setActivePopoverKey(key);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <Back onClick={handlePrevDay} />
        <div className="flex flex-col">
          <div className="text-body-4 text-text-brand">{weekday}</div>
          <div className="text-body-4-emphasis text-white h-12 w-12 flex items-center justify-center rounded-full bg-text-brand">
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
      <div className="overflow-y-auto overflow-x-hidden flex-1 px-2 max-h-[800px]" ref={scrollRef}>
        <div
          className="grid grid-cols-[60px_1fr]"
          style={{
            height: totalHeightPx,
          }}
        >
          <TimeLabels windowStart={windowStart} windowEnd={windowEnd} />
          <div className="relative h-full">
            <HorizontalLines
              date={date}
              scrollRef={scrollRef}
              windowStart={windowStart}
              windowEnd={windowEnd}
            />
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
                    className="flex-1 min-w-0 flex items-center justify-between cursor-pointer"
                    onClick={() => handleViewAppointment(ev)}
                    onMouseEnter={(event) => openPopover(itemKey, event.currentTarget)}
                    onMouseLeave={schedulePopoverClose}
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
        activeEvent &&
        activeRect &&
        createPortal(
          <dialog
            ref={popoverDialogRef}
            open
            className="fixed z-120 rounded-2xl border border-card-border bg-white px-3 pt-2 pb-3"
            style={getPopoverStyle()}
            aria-label="Appointment quick actions"
          >
            <div className="flex items-center justify-end gap-1">
              {canEditAppointments && (
                <button
                  type="button"
                  title="Change status"
                  className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
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
                className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
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
                  className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
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
                className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg"
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
                className="h-8 w-8 rounded-full! flex items-center justify-center text-[#3c4043] hover:bg-[#e3e7ea]"
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
            </div>

            <div className="mt-1 flex items-start gap-3">
              <div
                className="h-3 w-3 rounded-full mt-2 flex-none"
                style={{
                  backgroundColor: getStatusStyle(activeEvent.status).backgroundColor || '#1a73e8',
                }}
              />
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="text-body-3 truncate">{activeEvent.companion.name || '-'}</div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Parent:</span>{' '}
                  {activeEvent.companion.parent?.name || '-'}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Lead:</span> {activeEvent.lead?.name || '-'}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Reason:</span> {activeEvent.concern || '-'}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Service:</span>{' '}
                  {activeEvent.appointmentType?.name || '-'}
                </div>
                <div className="text-caption-1 text-black-text">
                  <span className="font-medium">Time:</span> {formatTimeRange(activeEvent)}
                </div>
              </div>
            </div>
          </dialog>,
          document.body
        )}
    </div>
  );
};

export default DayCalendar;
