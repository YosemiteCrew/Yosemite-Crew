import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import ZoomOutMarker from '@/app/features/appointments/components/Calendar/common/ZoomOutMarker';

const getSlotEventKey = (event: Appointment): string =>
  [
    event.id,
    (event.companion ?? event.patient).name,
    event.startTime.toISOString(),
    event.endTime.toISOString(),
  ].join('-');

type ZoomOutEventListProps = {
  sortedSlotEvents: Appointment[];
  height: number;
  activePopoverKey: string | null;
  appointmentPopoverId: string;
  draggedAppointmentId?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onMarkerClick: React.ComponentProps<typeof ZoomOutMarker>['onMarkerClick'];
  onMarkerDoubleClick: React.ComponentProps<typeof ZoomOutMarker>['onMarkerDoubleClick'];
  onMarkerContextMenu: React.ComponentProps<typeof ZoomOutMarker>['onMarkerContextMenu'];
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onDropPreviewClear: () => void;
};

/** Stack events top-to-bottom, spacing each by its gap from the running cursor. */
const layoutZoomOutEvents = (
  sortedSlotEvents: Appointment[],
  height: number
): Array<{ ev: Appointment; itemKey: string; marginTopPx: number; blockHeightPx: number }> => {
  const laidOut: Array<{
    ev: Appointment;
    itemKey: string;
    marginTopPx: number;
    blockHeightPx: number;
  }> = [];
  let cursorMinute = 0;
  for (const ev of sortedSlotEvents) {
    const itemKey = getSlotEventKey(ev);
    const startMinute = getDatePartsInPreferredTimeZone(ev.startTime).minute;
    const rawDurationMinutes = Math.max(
      5,
      Math.round((ev.endTime.getTime() - ev.startTime.getTime()) / 60000)
    );
    const visibleDurationMinutes = Math.max(10, Math.min(rawDurationMinutes, 60 - startMinute));
    const gapMinutes = Math.max(0, startMinute - cursorMinute);
    const marginTopPx = (gapMinutes / 60) * height;
    const blockHeightPx = Math.max((visibleDurationMinutes / 60) * height, 3);
    cursorMinute = Math.max(cursorMinute, startMinute + visibleDurationMinutes);
    laidOut.push({ ev, itemKey, marginTopPx, blockHeightPx });
  }
  return laidOut;
};

const ZoomOutEventList = ({
  sortedSlotEvents,
  height,
  activePopoverKey,
  appointmentPopoverId,
  draggedAppointmentId,
  canDragAppointment,
  onMarkerClick,
  onMarkerDoubleClick,
  onMarkerContextMenu,
  onAppointmentDragStart,
  onAppointmentDragEnd,
  onDropPreviewClear,
}: ZoomOutEventListProps) => {
  return (
    <div className="flex flex-col px-1 py-0 h-full bg-transparent overflow-visible">
      {layoutZoomOutEvents(sortedSlotEvents, height).map(
        ({ ev, itemKey, marginTopPx, blockHeightPx }) => (
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
            onMarkerClick={onMarkerClick}
            onMarkerDoubleClick={onMarkerDoubleClick}
            onMarkerContextMenu={onMarkerContextMenu}
            onAppointmentDragStart={onAppointmentDragStart}
            onAppointmentDragEnd={onAppointmentDragEnd}
            onDropPreviewClear={onDropPreviewClear}
          />
        )
      )}
    </div>
  );
};

export default ZoomOutEventList;
