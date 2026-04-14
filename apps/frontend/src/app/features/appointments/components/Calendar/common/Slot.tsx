import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { getStatusStyle } from '@/app/config/statusConfig';
import Image from 'next/image';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import {
  autoScrollCalendarHorizontally,
  autoScrollCalendarVertically,
} from '@/app/features/appointments/components/Calendar/helpers';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import { createPortal } from 'react-dom';
import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import { getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

type SlotProps = {
  slotEvents: Appointment[];
  height: number;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeStatusAppointment?: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
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
  draggedAppointmentDurationMinutes?: number;
  dropDate?: Date;
  dropHour?: number;
  dropPractitionerId?: string;
  zoomMode?: CalendarZoomMode;
  invoicesByAppointmentId?: Record<string, Invoice>;
};

const MARKER_CLICK_DELAY_MS = 180;

type ContextMenuState = {
  appointment: Appointment;
  x: number;
  y: number;
};

const Slot: React.FC<SlotProps> = ({
  slotEvents,
  height,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeStatusAppointment,
  handleChangeRoomAppointment,
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
  dropAvailabilityIntervals = [],
  draggedAppointmentDurationMinutes,
  dropDate,
  dropHour = 0,
  dropPractitionerId,
  zoomMode = 'in',
  invoicesByAppointmentId = {},
}) => {
  const isZoomOutMode = zoomMode === 'out';
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
  } = usePopoverManager();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
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
  const getCompanionDisplayName = (appointment: Appointment) =>
    formatCompanionNameWithOwnerLastName(
      appointment.companion?.name,
      appointment.companion?.parent
    );

  const handleOpenPopover = (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ): void => openPopover(key, target, draggedAppointmentId, clientX, clientY);

  const popoverStyle = getPopoverStyle(360, 340);
  const contextMenuStyle = useMemo(() => {
    if (!contextMenu) return null;
    const width = 280;
    const height = 420;
    const margin = 12;
    const left = Math.max(margin, Math.min(contextMenu.x, globalThis.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(contextMenu.y, globalThis.innerHeight - height - margin));
    return { left, top, width };
  }, [contextMenu]);

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
        let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMinute);
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

  const handleMarkerClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    appointment: Appointment,
    key: string
  ) => {
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
    handleViewAppointment(appointment);
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

  return (
    <>
      <div
        role="application"
        tabIndex={-1}
        className={`relative overflow-auto scrollbar-hidden border-l border-grey-light ${dayIndex === length && 'border-r'}`}
        style={{ height: `${height}px` }}
        onDragOver={(event) => {
          if (!draggedAppointmentId) return;
          event.preventDefault();
          autoScrollCalendarHorizontally(event.clientX, event.currentTarget as HTMLDivElement);
          autoScrollCalendarVertically(event.clientY, event.currentTarget as HTMLDivElement);
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
            aria-label="Create appointment in this calendar slot"
            className="absolute inset-0 z-[1] rounded-none!"
            onClick={(event) => {
              const parent = event.currentTarget.parentElement as HTMLDivElement;
              const minute = getMinuteFromSlotPointer(event.clientY, parent);
              onCreateAppointmentAt(dropDate, Math.round(minute / 5) * 5, dropPractitionerId);
            }}
            onDoubleClick={(event) => {
              const parent = event.currentTarget.parentElement as HTMLDivElement;
              const minute = getMinuteFromSlotPointer(event.clientY, parent);
              onCreateAppointmentAt(dropDate, Math.round(minute / 5) * 5, dropPractitionerId);
            }}
          />
        ) : null}
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
        {isZoomOutMode ? (
          <div className="flex flex-col px-1 py-0 h-full bg-transparent overflow-visible">
            {(() => {
              let cursorMinute = 0;
              return sortedSlotEvents.map((ev, i) => {
                const itemKey = `${ev.companion.name}-${ev.startTime.toISOString()}-${i}`;
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
                const statusStyle = getStatusStyle(ev.status);
                const blockHeightPx = Math.max((visibleDurationMinutes / 60) * height, 3);
                const serviceName = ev.appointmentType?.name?.trim() ?? '';
                const concern = ev.concern?.trim() ?? '';
                const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
                const companionDisplayName = getCompanionDisplayName(ev);
                const markerTitle = subtitle
                  ? `${companionDisplayName} • ${subtitle}`
                  : companionDisplayName;
                const draggable = !!canDragAppointment?.(ev);
                cursorMinute = Math.max(cursorMinute, startMinute + visibleDurationMinutes);
                return (
                  <div
                    key={itemKey}
                    className="relative z-20 rounded-md px-0 py-0 border-0 bg-transparent"
                    style={{
                      marginTop: marginTopPx,
                      minHeight: blockHeightPx,
                      height: blockHeightPx,
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0.5 right-0.5 rounded-sm z-30"
                      style={{
                        backgroundColor: statusStyle.backgroundColor,
                      }}
                    />
                    <button
                      type="button"
                      className={`min-w-0 absolute inset-x-0 -inset-y-2 z-20 ${
                        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                      onClick={(event) => handleMarkerClick(event, ev, itemKey)}
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
                      <span className="sr-only">{markerTitle}</span>
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="relative h-full rounded-2xl bg-white overflow-hidden px-1">
            {laidOutZoomInEvents.map(
              ({
                ev,
                originalIndex,
                startMinute,
                visibleDurationMinutes,
                laneIndex,
                laneCount,
              }) => {
                const itemKey = `${ev.companion.name}-${ev.startTime.toISOString()}-${originalIndex}`;
                const statusStyle = getStatusStyle(ev.status);
                const serviceName = ev.appointmentType?.name?.trim() ?? '';
                const concern = ev.concern?.trim() ?? '';
                const subtitle = [serviceName, concern].filter(Boolean).join(' • ');
                const companionDisplayName = getCompanionDisplayName(ev);
                const markerTitle = subtitle
                  ? `${companionDisplayName} • ${subtitle}`
                  : companionDisplayName;
                const draggable = !!canDragAppointment?.(ev);
                const laneGapPx = 3;
                const widthPercent = 100 / laneCount;
                const leftPercent = widthPercent * laneIndex;
                const topPx = (startMinute / 60) * height;
                const blockHeightPx = Math.max((visibleDurationMinutes / 60) * height, 40);
                const compact = laneCount > 1;
                const visibleSubtitle = compact ? serviceName : subtitle;

                return (
                  <div
                    key={itemKey}
                    className="absolute z-20 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.35)]"
                    style={{
                      ...statusStyle,
                      top: topPx,
                      left: `calc(${leftPercent}% + ${laneGapPx}px)`,
                      width: `calc(${widthPercent}% - ${laneGapPx * 2}px)`,
                      minHeight: blockHeightPx,
                      height: blockHeightPx,
                    }}
                  >
                    <button
                      type="button"
                      className={`h-full w-full px-1.5 ${
                        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${compact ? 'py-1 flex flex-col justify-center text-center' : 'py-1.5 flex items-center gap-2'}`}
                      onClick={(event) => handleMarkerClick(event, ev, itemKey)}
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
                      <div className="min-w-0 flex-1 self-center overflow-hidden">
                        <div className="w-full flex flex-col items-center justify-center text-center gap-0.5">
                          <div className="truncate w-full text-caption-1 font-semibold">
                            {companionDisplayName}
                          </div>
                          {visibleSubtitle && (
                            <div className="w-full truncate text-[10px] opacity-95">
                              {visibleSubtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      {!compact && (
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
                      )}
                    </button>
                  </div>
                );
              }
            )}
          </div>
        )}
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
    </>
  );
};

export default Slot;
