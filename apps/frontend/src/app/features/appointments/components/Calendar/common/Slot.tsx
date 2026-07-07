import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import {
  autoScrollCalendarHorizontally,
  autoScrollCalendarVertically,
} from '@/app/features/appointments/components/Calendar/helpers';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import { createPortal } from 'react-dom';
import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useNotify } from '@/app/hooks/useNotify';
import { canEnterAppointmentWorkspace } from '@/app/lib/appointmentWorkspace';
import ZoomOutMarker from '@/app/features/appointments/components/Calendar/common/ZoomOutMarker';
import ZoomInMarker from '@/app/features/appointments/components/Calendar/common/ZoomInMarker';

type SlotProps = {
  slotEvents: Appointment[];
  height: number;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleDetailAppointment?: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleOpenWorkspace?: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  handleAcceptAppointment?: (appt: Appointment) => void;
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
  onCreateAppointmentAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  dropAvailabilityIntervals?: Array<{ startMinute: number; endMinute: number }>;
  unavailableSegments?: Array<{ startMinute: number; endMinute: number }>;
  draggedAppointmentDurationMinutes?: number;
  dropDate?: Date;
  dropHour?: number;
  dropPractitionerId?: string;
  zoomMode?: CalendarZoomMode;
  invoicesByAppointmentId?: Record<string, Invoice>;
};

const MARKER_CLICK_DELAY_MS = 180;

const DEFAULT_DROP_AVAILABILITY_INTERVALS: Array<{ startMinute: number; endMinute: number }> = [];
const DEFAULT_UNAVAILABLE_SEGMENTS: Array<{ startMinute: number; endMinute: number }> = [];
const DEFAULT_INVOICES_BY_APPOINTMENT_ID: Record<string, Invoice> = {};

type ContextMenuState = {
  appointment: Appointment;
  x: number;
  y: number;
};

const SlotComponent: React.FC<SlotProps> = ({
  slotEvents,
  height,
  handleViewAppointment,
  handleDetailAppointment,
  handleOpenWorkspace,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
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
  onCreateAppointmentAt,
  dropAvailabilityIntervals = DEFAULT_DROP_AVAILABILITY_INTERVALS,
  unavailableSegments = DEFAULT_UNAVAILABLE_SEGMENTS,
  draggedAppointmentDurationMinutes,
  dropDate,
  dropHour = 0,
  dropPractitionerId,
  zoomMode = 'in',
  invoicesByAppointmentId = DEFAULT_INVOICES_BY_APPOINTMENT_ID,
}) => {
  const isZoomOutMode = zoomMode === 'out';
  const { notify } = useNotify();
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
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
    const swallowDismissClick = () => {
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
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current?.contains(target)) return;
      if ((target as Element | null)?.closest('[data-context-menu]')) return;
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        event.stopImmediatePropagation();
      }
      swallowDismissClick();
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

  const sortedSlotEvents = useMemo(
    () => slotEvents.toSorted((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [slotEvents]
  );

  const activeEvent = useMemo(
    () =>
      sortedSlotEvents.find(
        (ev, i) =>
          `${(ev.companion ?? ev.patient).name}-${ev.startTime.toISOString()}-${i}` ===
          activePopoverKey
      ) ?? null,
    [sortedSlotEvents, activePopoverKey]
  );
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

  const getMinuteFromSlotPointer = (clientY: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const minuteWithinHour = Math.max(
      0,
      Math.min(59, Math.round((y / Math.max(1, rect.height)) * 60))
    );
    return dropHour * 60 + minuteWithinHour;
  };

  const getNearestAvailableMinute = (minute: number) =>
    calcNearestAvailableMinute(minute, dropAvailabilityIntervals);

  const hourStart = dropHour * 60;
  const hourEnd = hourStart + 60;
  const availabilitySegments = useMemo(() => {
    const effectiveDuration = Math.max(5, draggedAppointmentDurationMinutes ?? 5);
    return dropAvailabilityIntervals.flatMap((interval) => {
      const segmentStart = Math.max(hourStart, interval.startMinute);
      const segmentEnd = Math.min(hourEnd, interval.endMinute + effectiveDuration);
      if (segmentEnd <= segmentStart) return [];
      return [
        {
          top: ((segmentStart - hourStart) / 60) * height,
          segmentHeight: Math.max(4, ((segmentEnd - segmentStart) / 60) * height),
        },
      ];
    });
  }, [draggedAppointmentDurationMinutes, dropAvailabilityIntervals, height, hourEnd, hourStart]);

  const laidOutZoomInEvents = useMemo(() => {
    const base = sortedSlotEvents
      .map((ev, index) => {
        const startMinute = getDatePartsInPreferredTimeZone(ev.startTime).minute;
        const rawDurationMinutes = Math.max(
          5,
          Math.round((ev.endTime.getTime() - ev.startTime.getTime()) / 60000)
        );
        const visibleDurationMinutes = Math.max(10, Math.min(rawDurationMinutes, 60 - startMinute));
        return {
          ev,
          originalIndex: index,
          startMinute,
          endMinute: startMinute + visibleDurationMinutes,
          visibleDurationMinutes,
        };
      })
      .sort((a, b) => {
        if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
        return a.endMinute - b.endMinute;
      });

    const output: Array<
      (typeof base)[number] & {
        laneIndex: number;
        laneCount: number;
      }
    > = [];

    let cursor = 0;
    while (cursor < base.length) {
      const cluster: typeof base = [base[cursor]];
      let clusterEnd = base[cursor].endMinute;
      let next = cursor + 1;
      while (next < base.length && base[next].startMinute < clusterEnd) {
        cluster.push(base[next]);
        clusterEnd = Math.max(clusterEnd, base[next].endMinute);
        next += 1;
      }

      const laneEnds: number[] = [];
      const clusterOut: Array<
        (typeof base)[number] & {
          laneIndex: number;
          laneCount: number;
        }
      > = [];
      cluster.forEach((item) => {
        let laneIndex = -1;
        for (let i = 0; i < laneEnds.length; i += 1) {
          if (laneEnds[i] <= item.startMinute) {
            laneIndex = i;
            break;
          }
        }
        if (laneIndex === -1) {
          laneIndex = laneEnds.length;
          laneEnds.push(item.endMinute);
        } else {
          laneEnds[laneIndex] = item.endMinute;
        }
        clusterOut.push({ ...item, laneIndex, laneCount: 1 });
      });

      const laneCount = Math.max(1, laneEnds.length);
      clusterOut.forEach((item) => {
        output.push({ ...item, laneCount });
      });
      cursor = next;
    }

    return output;
  }, [sortedSlotEvents]);

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
    if (handleOpenWorkspace && canEnterAppointmentWorkspace(appointment.status)) {
      handleOpenWorkspace(appointment);
      return;
    }
    (handleDetailAppointment ?? handleViewAppointment)(appointment);
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

  const tryCreateAppointmentAt = (minute: number) => {
    if (!dropDate || !onCreateAppointmentAt) return;
    const snapped = Math.round(minute / 5) * 5;
    const slotTime = new Date(dropDate);
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
    onCreateAppointmentAt(dropDate, snapped, dropPractitionerId);
  };

  const createAppointmentLabel = dropDate
    ? `Create appointment on ${formatDateInPreferredTimeZone(dropDate, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })} at ${formatDateInPreferredTimeZone(
        new Date(dropDate.getTime() + dropHour * 60 * 60 * 1000),
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      )}`
    : 'Create appointment in this calendar slot';
  const slotRegionLabel = dropDate
    ? `Appointments slot for ${formatDateInPreferredTimeZone(dropDate, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })} at ${formatDateInPreferredTimeZone(
        new Date(dropDate.getTime() + dropHour * 60 * 60 * 1000),
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      )}`
    : 'Appointments slot';
  const canPortal = typeof document !== 'undefined';

  return (
    <>
      <section
        aria-label={slotRegionLabel}
        className={`relative overflow-auto scrollbar-hidden border-l border-grey-light ${dayIndex === length && 'border-r'}`}
        style={{ height: `${height}px` }}
        onDragOver={(event) => {
          if (!draggedAppointmentId) return;
          event.preventDefault();
          autoScrollCalendarHorizontally(event.clientX, event.currentTarget);
          autoScrollCalendarVertically(event.clientY, event.currentTarget);
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
        {dropDate && onCreateAppointmentAt && !draggedAppointmentId ? (
          <button
            type="button"
            aria-label={createAppointmentLabel}
            className="absolute inset-0 z-1 rounded-none!"
            onClick={(event) => {
              const parent = event.currentTarget.parentElement as HTMLDivElement;
              tryCreateAppointmentAt(getMinuteFromSlotPointer(event.clientY, parent));
            }}
            onDoubleClick={(event) => {
              const parent = event.currentTarget.parentElement as HTMLDivElement;
              tryCreateAppointmentAt(getMinuteFromSlotPointer(event.clientY, parent));
            }}
          />
        ) : null}
        {draggedAppointmentId &&
          availabilitySegments.map((segment, index) => (
            <div
              key={`drop-availability-${index}-${segment.top}`}
              className="pointer-events-none absolute inset-x-1 z-20 rounded-md border border-grey-light bg-calendar-availability-overlay"
              style={{ top: segment.top, height: segment.segmentHeight }}
            />
          ))}
        {draggedAppointmentId && dropPreviewMinute != null && (
          <div
            className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-grey-light bg-calendar-preview-overlay"
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
            <div className="size-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
              {draggedAppointmentLabel || 'Appointment'}
            </div>
          </div>
        )}
        {isZoomOutMode ? (
          <div className="flex flex-col px-1 py-0 h-full bg-transparent overflow-visible">
            {(() => {
              let cursorMinute = 0;
              return sortedSlotEvents.map((ev, i) => {
                const itemKey = `${(ev.companion ?? ev.patient).name}-${ev.startTime.toISOString()}-${i}`;
                const startMinute = getDatePartsInPreferredTimeZone(ev.startTime).minute;
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
                const blockHeightPx = Math.max((visibleDurationMinutes / 60) * height, 3);
                cursorMinute = Math.max(cursorMinute, startMinute + visibleDurationMinutes);
                return (
                  <ZoomOutMarker
                    key={itemKey}
                    ev={ev}
                    itemKey={itemKey}
                    marginTopPx={marginTopPx}
                    blockHeightPx={blockHeightPx}
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
                );
              });
            })()}
          </div>
        ) : (
          <div className="relative h-full bg-white overflow-visible px-1">
            {laidOutZoomInEvents.map(
              ({
                ev,
                originalIndex,
                startMinute,
                visibleDurationMinutes,
                laneIndex,
                laneCount,
              }) => {
                const itemKey = `${(ev.companion ?? ev.patient).name}-${ev.startTime.toISOString()}-${originalIndex}`;
                const topPx = (startMinute / 60) * height;
                const blockHeightPx = Math.max((visibleDurationMinutes / 60) * height, 40);

                return (
                  <ZoomInMarker
                    key={itemKey}
                    ev={ev}
                    itemKey={itemKey}
                    laneIndex={laneIndex}
                    laneCount={laneCount}
                    topPx={topPx}
                    blockHeightPx={blockHeightPx}
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
                );
              }
            )}
          </div>
        )}
      </section>
      {canPortal &&
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
            handleRescheduleAppointment={handleRescheduleAppointment}
            handleChangeRoomAppointment={handleChangeRoomAppointment}
            handleAcceptAppointment={handleAcceptAppointment}
            onClose={() => setActivePopoverKey(null)}
            registerAnchorEl={registerAnchorEl}
          />,
          document.body
        )}
      {canPortal &&
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
    </>
  );
};

const Slot = React.memo(SlotComponent);
export default Slot;
