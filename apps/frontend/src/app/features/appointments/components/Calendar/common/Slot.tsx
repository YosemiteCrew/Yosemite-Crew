import React, { useEffect, useMemo, useState } from 'react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { getStatusStyle } from '@/app/config/statusConfig';
import Image from 'next/image';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import {
  allowReschedule,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getAppointmentCompanionPhotoUrl,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import {
  autoScrollCalendarHorizontally,
  autoScrollCalendarVertically,
} from '@/app/features/appointments/components/Calendar/helpers';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import {
  IoEyeOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
} from 'react-icons/io5';
import { MdMeetingRoom, MdOutlineAutorenew } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';
import { createPortal } from 'react-dom';
import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import {
  acceptAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';
import { useOrgStore } from '@/app/stores/orgStore';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';

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
  const orgsById = useOrgStore((s) => s.orgsById);
  const isZoomOutMode = zoomMode === 'out';
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!draggedAppointmentId) return;
    setActivePopoverKey(null);
    setDropPreviewMinute(null);
  }, [draggedAppointmentId, setActivePopoverKey]);

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
  const activeEventPayment = useMemo(
    () => (activeEvent ? getAppointmentPaymentDisplay(activeEvent, invoicesByAppointmentId) : null),
    [activeEvent, invoicesByAppointmentId]
  );

  const formatTimeRange = (event: Appointment) => {
    const start = formatDateInPreferredTimeZone(event.startTime, {
      hour: 'numeric',
      minute: '2-digit',
    });
    const end = formatDateInPreferredTimeZone(event.endTime, {
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

  const getCompanionDisplayName = (appointment: Appointment) =>
    formatCompanionNameWithOwnerLastName(
      appointment.companion?.name,
      appointment.companion?.parent
    );

  const openAppointmentHistory = (appointment: Appointment) => {
    handleViewAppointment(appointment, { label: 'info', subLabel: 'history' });
  };

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
                      onClick={() => handleViewAppointment(ev)}
                      onMouseEnter={(event) =>
                        handleOpenPopover(
                          itemKey,
                          event.currentTarget,
                          event.clientX,
                          event.clientY
                        )
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

                return (
                  <div
                    key={itemKey}
                    className="absolute z-20 rounded-lg border border-[rgba(255,255,255,0.35)]"
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
                      onClick={() => handleViewAppointment(ev)}
                      onMouseEnter={(event) =>
                        handleOpenPopover(
                          itemKey,
                          event.currentTarget,
                          event.clientX,
                          event.clientY
                        )
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
                      <div className="min-w-0 flex-1 self-center">
                        <div className="w-full flex flex-col items-center justify-center text-center gap-0.5">
                          <div className="truncate w-full text-caption-1 font-semibold">
                            {companionDisplayName}
                          </div>
                          {subtitle && (
                            <div className="text-[10px] w-full truncate opacity-95">{subtitle}</div>
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
          <dialog
            ref={popoverDialogRef}
            open
            className="fixed z-[1000] w-[380px] rounded-2xl border border-card-border bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
            style={popoverStyle}
            aria-label="Appointment quick actions"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <Image
                  src={getSafeImageUrl(
                    getAppointmentCompanionPhotoUrl(activeEvent.companion),
                    activeEvent.companion.species.toLowerCase() as ImageType
                  )}
                  height={34}
                  width={34}
                  className="rounded-full border border-card-border bg-white object-cover"
                  style={{ width: 34, height: 34 }}
                  alt=""
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-body-3-emphasis text-text-primary truncate cursor-pointer hover:underline underline-offset-2 text-left"
                    onClick={() => {
                      openAppointmentHistory(activeEvent);
                      setActivePopoverKey(null);
                    }}
                    title="Open appointment overview"
                  >
                    {getCompanionDisplayName(activeEvent)}
                  </button>
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
                {getOwnerFirstName(activeEvent.companion.parent) || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Lead</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.lead?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Speciality</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.appointmentType?.speciality?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Service</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.appointmentType?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Room</div>
              <div className="text-caption-1 text-text-primary text-right truncate">
                {activeEvent.room?.name || '-'}
              </div>
              <div className="text-caption-1 text-text-secondary">Payment</div>
              <div
                className="text-caption-1 text-right truncate font-medium"
                style={{ color: activeEventPayment?.textColor || '#302F2E' }}
              >
                {activeEventPayment?.label || '-'}
              </div>
            </div>

            <div className="mt-2 text-caption-1 text-text-secondary">Reason</div>
            <div className="text-caption-1 text-text-primary min-h-6 line-clamp-2">
              {activeEvent.concern || '-'}
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-card-border pt-2 flex-wrap">
              {canEditAppointments && isRequestedLikeStatus(activeEvent.status) && (
                <>
                  <GlassTooltip content="Accept request" side="top">
                    <button
                      type="button"
                      title="Accept request"
                      className="h-9 w-9 rounded-full! flex items-center justify-center hover:bg-[#E6F4EF] border border-card-border"
                      onClick={async () => {
                        await acceptAppointment(activeEvent);
                        setActivePopoverKey(null);
                      }}
                    >
                      <FaCheckCircle size={18} color="#54B492" />
                    </button>
                  </GlassTooltip>
                  <GlassTooltip content="Decline request" side="top">
                    <button
                      type="button"
                      title="Decline request"
                      className="h-9 w-9 rounded-full! flex items-center justify-center hover:bg-[#FDEBEA] border border-card-border"
                      onClick={async () => {
                        await rejectAppointment(activeEvent);
                        setActivePopoverKey(null);
                      }}
                    >
                      <IoIosCloseCircle size={20} color="#EA3729" />
                    </button>
                  </GlassTooltip>
                </>
              )}
              {!isRequestedLikeStatus(activeEvent.status) && (
                <>
                  <GlassTooltip content="View appointment" side="top">
                    <button
                      type="button"
                      title="View appointment"
                      className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                      onClick={() => {
                        handleViewAppointment(activeEvent);
                        setActivePopoverKey(null);
                      }}
                    >
                      <IoEyeOutline size={18} />
                    </button>
                  </GlassTooltip>
                  <GlassTooltip content="Overview" side="top">
                    <button
                      type="button"
                      title="Appointment overview"
                      className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                      onClick={() => {
                        openAppointmentHistory(activeEvent);
                        setActivePopoverKey(null);
                      }}
                    >
                      <RiHistoryLine size={17} />
                    </button>
                  </GlassTooltip>
                  {canEditAppointments && canShowStatusChangeAction(activeEvent.status) && (
                    <GlassTooltip content="Change status" side="top">
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
                    </GlassTooltip>
                  )}
                  {canEditAppointments && allowReschedule(activeEvent.status) && (
                    <GlassTooltip content="Reschedule" side="top">
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
                    </GlassTooltip>
                  )}
                  {canEditAppointments && canAssignAppointmentRoom(activeEvent.status) && (
                    <GlassTooltip content="Assign room" side="top">
                      <button
                        type="button"
                        title="Assign room"
                        className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                        onClick={() => {
                          handleChangeRoomAppointment?.(activeEvent);
                          setActivePopoverKey(null);
                        }}
                      >
                        <MdMeetingRoom size={18} />
                      </button>
                    </GlassTooltip>
                  )}
                  {(() => {
                    const orgType =
                      (activeEvent.organisationId && orgsById[activeEvent.organisationId]?.type) ||
                      'HOSPITAL';
                    const clinicalNotesLabel = getClinicalNotesLabel(orgType);
                    const clinicalNotesIntent = getClinicalNotesIntent(orgType);
                    return (
                      <GlassTooltip content={clinicalNotesLabel} side="top">
                        <button
                          type="button"
                          title={clinicalNotesLabel}
                          className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                          onClick={() => {
                            handleViewAppointment(activeEvent, clinicalNotesIntent);
                            setActivePopoverKey(null);
                          }}
                        >
                          <IoDocumentTextOutline size={18} />
                        </button>
                      </GlassTooltip>
                    );
                  })()}
                  <GlassTooltip content="Finance summary" side="top">
                    <button
                      type="button"
                      title="Finance summary"
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
                  </GlassTooltip>
                  <GlassTooltip content="Lab tests" side="top">
                    <button
                      type="button"
                      title="Lab tests"
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
                  </GlassTooltip>
                </>
              )}
            </div>
          </dialog>,
          document.body
        )}
    </>
  );
};

export default Slot;
