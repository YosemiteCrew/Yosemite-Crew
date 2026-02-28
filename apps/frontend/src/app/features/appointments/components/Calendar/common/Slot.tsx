import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStatusStyle } from '@/app/config/statusConfig';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { allowReschedule } from '@/app/lib/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import {
  IoEyeOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
} from 'react-icons/io5';
import { MdOutlineAutorenew } from 'react-icons/md';
import { createPortal } from 'react-dom';

type SlotProps = {
  slotEvents: Appointment[];
  height: number;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeStatusAppointment?: (appt: Appointment) => void;
  dayIndex: number;
  length: number;
  canEditAppointments: boolean;
  draggedAppointmentId?: string | null;
  draggedAppointmentLabel?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onAppointmentDropAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  onDragHoverTarget?: (date: Date, targetLeadId?: string) => void;
  dropAvailabilityIntervals?: Array<{ startMinute: number; endMinute: number }>;
  draggedAppointmentDurationMinutes?: number;
  dropDate?: Date;
  dropHour?: number;
  dropPractitionerId?: string;
};

const Slot: React.FC<SlotProps> = ({
  slotEvents,
  height,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  dayIndex,
  length,
  canEditAppointments,
  draggedAppointmentId,
  draggedAppointmentLabel,
  canDragAppointment,
  onAppointmentDragStart,
  onAppointmentDragEnd,
  onAppointmentDropAt,
  onDragHoverTarget,
  dropAvailabilityIntervals = [],
  draggedAppointmentDurationMinutes,
  dropDate,
  dropHour = 0,
  dropPractitionerId,
}) => {
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!activePopoverKey) return;
    const closePopover = () => setActivePopoverKey(null);
    globalThis.addEventListener('scroll', closePopover, true);
    globalThis.addEventListener('resize', closePopover);
    return () => {
      globalThis.removeEventListener('scroll', closePopover, true);
      globalThis.removeEventListener('resize', closePopover);
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

  const sortedSlotEvents = useMemo(
    () => [...slotEvents].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [slotEvents]
  );

  const activeEvent = useMemo(
    () =>
      sortedSlotEvents.find(
        (ev, i) => `${ev.companion.name}-${ev.startTime.toISOString()}-${i}` === activePopoverKey
      ) ?? null,
    [sortedSlotEvents, activePopoverKey]
  );

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
    const viewportWidth = globalThis.innerWidth;
    const fitsRight = activeRect.right + margin + popoverWidth <= viewportWidth;
    const left = fitsRight
      ? activeRect.right + margin
      : Math.max(margin, activeRect.left - popoverWidth - margin);
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
    appointment: Appointment
  ) => {
    const ghost = document.createElement('img');
    ghost.src = getSafeImageUrl('', appointment.companion.species.toLowerCase() as ImageType);
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

  const getMinuteFromSlotPointer = (clientY: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const minuteWithinHour = Math.max(
      0,
      Math.min(59, Math.round((y / Math.max(1, rect.height)) * 60))
    );
    return dropHour * 60 + minuteWithinHour;
  };

  const getNearestAvailableMinute = (minute: number) => {
    const DROP_TOLERANCE_MINUTES = 12;
    const snapped = Math.round(minute / 5) * 5;
    let bestMatch: { minute: number; distance: number } | null = null;
    for (const interval of dropAvailabilityIntervals) {
      const candidateMinute = Math.max(interval.startMinute, Math.min(interval.endMinute, snapped));
      const distance = Math.abs(minute - candidateMinute);
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { minute: candidateMinute, distance };
      }
    }
    if (!bestMatch || bestMatch.distance > DROP_TOLERANCE_MINUTES) return null;
    return bestMatch.minute;
  };

  const hourStart = dropHour * 60;
  const hourEnd = hourStart + 60;
  const availabilitySegments = useMemo(() => {
    const effectiveDuration = Math.max(5, draggedAppointmentDurationMinutes ?? 5);
    return dropAvailabilityIntervals
      .map((interval) => {
        const segmentStart = Math.max(hourStart, interval.startMinute);
        const segmentEnd = Math.min(hourEnd, interval.endMinute + effectiveDuration);
        if (segmentEnd <= segmentStart) return null;
        return {
          top: ((segmentStart - hourStart) / 60) * height,
          segmentHeight: Math.max(4, ((segmentEnd - segmentStart) / 60) * height),
        };
      })
      .filter(Boolean) as Array<{ top: number; segmentHeight: number }>;
  }, [draggedAppointmentDurationMinutes, dropAvailabilityIntervals, height, hourEnd, hourStart]);

  return (
    <>
      <div
        className={`relative overflow-auto scrollbar-hidden border-l border-grey-light ${dayIndex === length && 'border-r'}`}
        style={{ height: `${height}px` }}
        onDragOver={(event) => {
          if (!draggedAppointmentId) return;
          event.preventDefault();
          if (dropDate) {
            onDragHoverTarget?.(dropDate, dropPractitionerId);
          }
          const minute = getMinuteFromSlotPointer(
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
          if (!draggedAppointmentId || !onAppointmentDropAt || !dropDate) return;
          event.preventDefault();
          const minute = getMinuteFromSlotPointer(
            event.clientY,
            event.currentTarget as HTMLDivElement
          );
          const nearest = getNearestAvailableMinute(minute);
          setDropPreviewMinute(null);
          if (nearest == null) return;
          onAppointmentDropAt(dropDate, nearest, dropPractitionerId);
        }}
      >
        {draggedAppointmentId &&
          availabilitySegments.map((segment, index) => (
            <div
              key={`drop-availability-${index}-${segment.top}`}
              className="pointer-events-none absolute inset-x-1 z-20 rounded-md border border-grey-light bg-[rgba(42,168,121,0.12)]"
              style={{ top: segment.top, height: segment.segmentHeight }}
            />
          ))}
        {draggedAppointmentId && dropPreviewMinute != null && (
          <div
            className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-grey-light bg-[rgba(36,122,237,0.18)]"
            style={{
              top: `${((dropPreviewMinute % 60) / 60) * height}px`,
              height: `${Math.max(
                14,
                (Math.min(
                  Math.max(5, draggedAppointmentDurationMinutes ?? 30),
                  60 - (dropPreviewMinute % 60)
                ) /
                  60) *
                  height
              )}px`,
            }}
          >
            <div className="h-full w-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
              {draggedAppointmentLabel || 'Appointment'}
            </div>
          </div>
        )}
        <div className="flex flex-col rounded-2xl px-1 py-0 bg-white h-full overflow-hidden">
          {(() => {
            let cursorMinute = 0;
            return sortedSlotEvents.map((ev, i) => {
              const itemKey = `${ev.companion.name}-${ev.startTime.toISOString()}-${i}`;
              const startMinute = ev.startTime.getMinutes();
              const rawDurationMinutes = Math.max(
                5,
                Math.round((ev.endTime.getTime() - ev.startTime.getTime()) / 60000)
              );
              const visibleDurationMinutes = Math.max(
                10,
                Math.min(rawDurationMinutes, 60 - startMinute)
              );
              const gapMinutes = Math.max(0, startMinute - cursorMinute);
              const marginTopPx = (gapMinutes / 60) * height;
              const blockHeightPx = Math.max((visibleDurationMinutes / 60) * height - 2, 18);
              cursorMinute = Math.max(cursorMinute, startMinute + visibleDurationMinutes);
              return (
                <div
                  key={itemKey}
                  className="rounded border border-[rgba(255,255,255,0.35)] px-2.5 py-1.5 flex items-center justify-between"
                  style={{
                    ...getStatusStyle(ev.status),
                    marginTop: marginTopPx,
                    minHeight: blockHeightPx,
                    height: blockHeightPx,
                  }}
                >
                  <button
                    type="button"
                    className="h-full w-full flex-1 min-w-0 px-1 flex items-center justify-between cursor-pointer"
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
            });
          })()}
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
                  src={getSafeImageUrl(
                    '',
                    activeEvent.companion.species.toLowerCase() as ImageType
                  )}
                  height={34}
                  width={34}
                  className="rounded-full border border-card-border bg-white"
                  alt=""
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
    </>
  );
};

export default Slot;
