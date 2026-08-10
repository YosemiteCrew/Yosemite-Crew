import React, { useId, useMemo, useState } from 'react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import {
  autoScrollCalendarHorizontally,
  autoScrollCalendarVertically,
} from '@/app/features/appointments/components/Calendar/helpers';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useNotify } from '@/app/hooks/useNotify';
import { useSlotMarkerInteractions } from '@/app/features/appointments/components/Calendar/common/useSlotMarkerInteractions';
import ZoomInEventList from '@/app/features/appointments/components/Calendar/common/ZoomInEventList';
import ZoomOutEventList from '@/app/features/appointments/components/Calendar/common/ZoomOutEventList';
import DropPreviewOverlay from '@/app/features/appointments/components/Calendar/common/DropPreviewOverlay';
import SlotCreateButton from '@/app/features/appointments/components/Calendar/common/SlotCreateButton';
import SlotPortals from '@/app/features/appointments/components/Calendar/common/SlotPortals';

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

const DEFAULT_DROP_AVAILABILITY_INTERVALS: Array<{ startMinute: number; endMinute: number }> = [];
const DEFAULT_UNAVAILABLE_SEGMENTS: Array<{ startMinute: number; endMinute: number }> = [];
const DEFAULT_INVOICES_BY_APPOINTMENT_ID: Record<string, Invoice> = {};

const getSlotEventKey = (event: Appointment): string =>
  [
    event.id,
    (event.companion ?? event.patient).name,
    event.startTime.toISOString(),
    event.endTime.toISOString(),
  ].join('-');

/** Availability overlay rectangles for one hour slot while a drag is in flight. */
const computeAvailabilitySegments = (
  dropAvailabilityIntervals: Array<{ startMinute: number; endMinute: number }>,
  hourStart: number,
  hourEnd: number,
  height: number,
  draggedAppointmentDurationMinutes?: number
) => {
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
};

/** Minute-of-day under the pointer within one hour-slot container. */
const minuteFromSlotPointer = (
  clientY: number,
  container: HTMLDivElement,
  dropHour: number
): number => {
  const rect = container.getBoundingClientRect();
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const minuteWithinHour = Math.max(
    0,
    Math.min(59, Math.round((y / Math.max(1, rect.height)) * 60))
  );
  return dropHour * 60 + minuteWithinHour;
};

const buildSlotLabels = (dropDate: Date | undefined, dropHour: number) => {
  if (!dropDate) {
    return {
      createAppointmentLabel: 'Create appointment in this calendar slot',
      slotRegionLabel: 'Appointments slot',
    };
  }
  const dayLabel = formatDateInPreferredTimeZone(dropDate, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = formatDateInPreferredTimeZone(
    new Date(dropDate.getTime() + dropHour * 60 * 60 * 1000),
    { hour: 'numeric', minute: '2-digit' }
  );
  return {
    createAppointmentLabel: `Create appointment on ${dayLabel} at ${timeLabel}`,
    slotRegionLabel: `Appointments slot for ${dayLabel} at ${timeLabel}`,
  };
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

  const sortedSlotEvents = useMemo(
    () => slotEvents.toSorted((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [slotEvents]
  );

  const activeEvent = useMemo(
    () => sortedSlotEvents.find((ev) => getSlotEventKey(ev) === activePopoverKey) ?? null,
    [sortedSlotEvents, activePopoverKey]
  );
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
  } = useSlotMarkerInteractions({
    handleOpenPopover,
    setActivePopoverKey,
    handleOpenWorkspace,
    handleDetailAppointment,
    handleViewAppointment,
  });

  const popoverStyle = getPopoverStyle(440, 490);

  // Dismiss the popover, drop preview, and context menu the moment a drag starts —
  // adjusted during render via a prev-compare rather than an effect.
  const [prevDraggedAppointmentId, setPrevDraggedAppointmentId] = useState(draggedAppointmentId);
  if (draggedAppointmentId !== prevDraggedAppointmentId) {
    setPrevDraggedAppointmentId(draggedAppointmentId);
    if (draggedAppointmentId) {
      setActivePopoverKey(null);
      setDropPreviewMinute(null);
      setContextMenu(null);
    }
  }

  const getMinuteFromSlotPointer = (clientY: number, container: HTMLDivElement) =>
    minuteFromSlotPointer(clientY, container, dropHour);

  const getNearestAvailableMinute = (minute: number) =>
    calcNearestAvailableMinute(minute, dropAvailabilityIntervals);

  const hourStart = dropHour * 60;
  const hourEnd = hourStart + 60;
  const availabilitySegments = useMemo(
    () =>
      computeAvailabilitySegments(
        dropAvailabilityIntervals,
        hourStart,
        hourEnd,
        height,
        draggedAppointmentDurationMinutes
      ),
    [draggedAppointmentDurationMinutes, dropAvailabilityIntervals, height, hourEnd, hourStart]
  );

  const tryCreateAppointmentAt = (minute: number) => {
    /* v8 ignore next -- defensive guard: the create button only mounts when both dropDate and onCreateAppointmentAt are set, so this early return is unreachable from the UI */
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

  const { createAppointmentLabel, slotRegionLabel } = buildSlotLabels(dropDate, dropHour);

  return (
    <>
      <section
        aria-label={slotRegionLabel}
        className={`relative overflow-auto scrollbar-hidden border-l border-card-border ${dayIndex === length && 'border-r'}`}
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
          <SlotCreateButton
            label={createAppointmentLabel}
            onPick={(clientY, container) =>
              tryCreateAppointmentAt(getMinuteFromSlotPointer(clientY, container))
            }
          />
        ) : null}
        {draggedAppointmentId &&
          availabilitySegments.map((segment, index) => (
            <div
              key={`drop-availability-${index}-${segment.top}`}
              className="pointer-events-none absolute inset-x-1 z-20 rounded-md border border-card-border bg-calendar-availability-overlay"
              style={{ top: segment.top, height: segment.segmentHeight }}
            />
          ))}
        {draggedAppointmentId && dropPreviewMinute != null && (
          <DropPreviewOverlay
            dropPreviewMinute={dropPreviewMinute}
            height={height}
            draggedAppointmentDurationMinutes={draggedAppointmentDurationMinutes}
            draggedAppointmentLabel={draggedAppointmentLabel}
          />
        )}
        {isZoomOutMode ? (
          <ZoomOutEventList
            sortedSlotEvents={sortedSlotEvents}
            height={height}
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
        ) : (
          <ZoomInEventList
            sortedSlotEvents={sortedSlotEvents}
            height={height}
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
        )}
      </section>
      <SlotPortals
        activeEvent={activeEvent}
        activeRect={activeRect}
        draggedAppointmentId={draggedAppointmentId}
        invoicesByAppointmentId={invoicesByAppointmentId}
        canEditAppointments={canEditAppointments}
        appointmentPopoverId={appointmentPopoverId}
        popoverDialogRef={popoverDialogRef}
        popoverStyle={popoverStyle}
        registerAnchorEl={registerAnchorEl}
        contextMenu={contextMenu}
        contextMenuRef={contextMenuRef}
        contextMenuStyle={contextMenuStyle}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        handleChangeRoomAppointment={handleChangeRoomAppointment}
        handleAcceptAppointment={handleAcceptAppointment}
        onPopoverClose={() => setActivePopoverKey(null)}
        onContextMenuClose={() => setContextMenu(null)}
      />
    </>
  );
};

const Slot = React.memo(SlotComponent);
export default Slot;
