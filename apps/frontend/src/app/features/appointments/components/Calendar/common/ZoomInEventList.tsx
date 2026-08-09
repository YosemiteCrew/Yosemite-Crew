import React, { useMemo } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import ZoomInMarker from '@/app/features/appointments/components/Calendar/common/ZoomInMarker';

const getSlotEventKey = (event: Appointment): string =>
  [
    event.id,
    (event.companion ?? event.patient).name,
    event.startTime.toISOString(),
    event.endTime.toISOString(),
  ].join('-');

type ZoomInEventListProps = {
  sortedSlotEvents: Appointment[];
  height: number;
  activePopoverKey: string | null;
  appointmentPopoverId: string;
  draggedAppointmentId?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onMarkerClick: React.ComponentProps<typeof ZoomInMarker>['onMarkerClick'];
  onMarkerDoubleClick: React.ComponentProps<typeof ZoomInMarker>['onMarkerDoubleClick'];
  onMarkerContextMenu: React.ComponentProps<typeof ZoomInMarker>['onMarkerContextMenu'];
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onDropPreviewClear: () => void;
};

type LaidOutSlotEvent = {
  ev: Appointment;
  startMinute: number;
  endMinute: number;
  visibleDurationMinutes: number;
  laneIndex: number;
  laneCount: number;
};

/**
 * Lay overlapping events of one hour slot out into side-by-side lanes: events are
 * clustered by overlap, each cluster packed greedily into the fewest lanes, and
 * every event in a cluster shares the cluster's lane count for width division.
 */
const layoutZoomInEvents = (sortedSlotEvents: Appointment[]): LaidOutSlotEvent[] => {
  const base = sortedSlotEvents
    .map((ev) => {
      const startMinute = getDatePartsInPreferredTimeZone(ev.startTime).minute;
      const rawDurationMinutes = Math.max(
        5,
        Math.round((ev.endTime.getTime() - ev.startTime.getTime()) / 60000)
      );
      const visibleDurationMinutes = Math.max(10, Math.min(rawDurationMinutes, 60 - startMinute));
      return {
        ev,
        startMinute,
        endMinute: startMinute + visibleDurationMinutes,
        visibleDurationMinutes,
      };
    })
    .sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return a.endMinute - b.endMinute;
    });

  const output: LaidOutSlotEvent[] = [];

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
    const clusterOut: LaidOutSlotEvent[] = [];
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
};

const ZoomInEventList = ({
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
}: ZoomInEventListProps) => {
  const laidOutZoomInEvents = useMemo(
    () => layoutZoomInEvents(sortedSlotEvents),
    [sortedSlotEvents]
  );

  return (
    // Transparent so the week grid's today-column tint reads through; the
    // calendar container already supplies the --screen surface underneath.
    <div className="relative h-full overflow-visible px-1">
      {laidOutZoomInEvents.map(
        ({ ev, startMinute, visibleDurationMinutes, laneIndex, laneCount }) => {
          const itemKey = getSlotEventKey(ev);
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
              onMarkerClick={onMarkerClick}
              onMarkerDoubleClick={onMarkerDoubleClick}
              onMarkerContextMenu={onMarkerContextMenu}
              onAppointmentDragStart={onAppointmentDragStart}
              onAppointmentDragEnd={onAppointmentDragEnd}
              onDropPreviewClear={onDropPreviewClear}
            />
          );
        }
      )}
    </div>
  );
};

export default ZoomInEventList;
