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

type BaseSlotEvent = Omit<LaidOutSlotEvent, 'laneIndex' | 'laneCount'>;

const toBaseSlotEvents = (sortedSlotEvents: Appointment[]): BaseSlotEvent[] =>
  sortedSlotEvents
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

// A cluster is a maximal run of transitively-overlapping events; it ends at the
// first event that starts after everything seen so far has ended.
const collectCluster = (
  base: BaseSlotEvent[],
  cursor: number
): { cluster: BaseSlotEvent[]; next: number } => {
  const cluster: BaseSlotEvent[] = [base[cursor]];
  let clusterEnd = base[cursor].endMinute;
  let next = cursor + 1;
  while (next < base.length && base[next].startMinute < clusterEnd) {
    cluster.push(base[next]);
    clusterEnd = Math.max(clusterEnd, base[next].endMinute);
    next += 1;
  }
  return { cluster, next };
};

// Greedy interval partitioning: reuse the first lane that is free by the item's
// start, else open a new lane. Every event in the cluster shares the final lane
// count so widths divide evenly.
const packClusterIntoLanes = (cluster: BaseSlotEvent[]): LaidOutSlotEvent[] => {
  const laneEnds: number[] = [];
  const laidOut = cluster.map((item) => {
    let laneIndex = laneEnds.findIndex((end) => end <= item.startMinute);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(item.endMinute);
    } else {
      laneEnds[laneIndex] = item.endMinute;
    }
    return { ...item, laneIndex, laneCount: 1 };
  });
  const laneCount = Math.max(1, laneEnds.length);
  return laidOut.map((item) => ({ ...item, laneCount }));
};

/**
 * Lay overlapping events of one hour slot out into side-by-side lanes: events are
 * clustered by overlap, each cluster packed greedily into the fewest lanes, and
 * every event in a cluster shares the cluster's lane count for width division.
 */
const layoutZoomInEvents = (sortedSlotEvents: Appointment[]): LaidOutSlotEvent[] => {
  const base = toBaseSlotEvents(sortedSlotEvents);
  const output: LaidOutSlotEvent[] = [];
  let cursor = 0;
  while (cursor < base.length) {
    const { cluster, next } = collectCluster(base, cursor);
    output.push(...packClusterIntoLanes(cluster));
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
