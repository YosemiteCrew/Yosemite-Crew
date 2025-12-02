import { AppointmentsProps } from "@/app/types/appointments";
import { LaidOutEvent } from "@/app/types/calendar";

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const getMonthYear = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export const getDayWithDate = (date: Date) => {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

  const dayNumber = date.toLocaleDateString("en-US", { day: "2-digit" }); // "03"

  return `${weekday} ${dayNumber}`;
};

export const DAY_START_MINUTES = 0;
export const DAY_END_MINUTES = 24 * 60;

export const MINUTES_PER_STEP = 5;
export const PIXELS_PER_STEP = 25;
export const EVENT_VERTICAL_GAP_PX = 2;
export const EVENT_HORIZONTAL_GAP_PX = 2;

export const TOTAL_DAY_HEIGHT_PX =
  ((DAY_END_MINUTES - DAY_START_MINUTES) / MINUTES_PER_STEP) * PIXELS_PER_STEP;

export function minutesSinceStartOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function snapToStep(mins: number, step = MINUTES_PER_STEP) {
  return Math.round(mins / step) * step;
}

export function computeVerticalPositionPx(event: AppointmentsProps) {
  let start = minutesSinceStartOfDay(event.start);
  let end = minutesSinceStartOfDay(event.end);
  start = snapToStep(start);
  end = snapToStep(end);
  const startSteps = start / MINUTES_PER_STEP;
  const durationSteps = (end - start) / MINUTES_PER_STEP;
  const topPx = startSteps * PIXELS_PER_STEP;
  const heightPx = durationSteps * PIXELS_PER_STEP;
  return { topPx, heightPx };
}

export function layoutDayEvents(events: AppointmentsProps[]): LaidOutEvent[] {
  if (events.length === 0) return [];
  // Sort events by start time (sweep line from top to bottom)
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  type TmpEvent = LaidOutEvent & { clusterId: number };
  const result: TmpEvent[] = [];
  let active: TmpEvent[] = [];
  let clusterId = 0;
  for (const ev of sorted) {
    const { topPx, heightPx } = computeVerticalPositionPx(ev);
    // 1) Remove finished events from "active"
    active = active.filter((a) => a.end > ev.start);
    // 2) If no events are active, we start a new overlapping cluster
    if (active.length === 0) {
      clusterId++;
    }
    // 3) Find the first free column index among active events
    const usedCols = new Set(active.map((a) => a.columnIndex));
    let colIndex = 0;
    while (usedCols.has(colIndex)) {
      colIndex++;
    }
    // 4) Create a temporary event with a cluster and columnIndex
    const tmp: TmpEvent = {
      ...ev,
      topPx,
      heightPx,
      columnIndex: colIndex,
      columnsCount: 1, // temporary, we fill it after knowing cluster width
      clusterId,
    };
    // 5) Add it to active and to result
    active.push(tmp);
    result.push(tmp);
  }
  // 6) For each cluster, compute how many columns it needs
  const clusterMax: Record<number, number> = {};
  for (const ev of result) {
    clusterMax[ev.clusterId] = Math.max(
      clusterMax[ev.clusterId] ?? 0,
      ev.columnIndex
    );
  }
  // 7) Set columnsCount = maxColumnIndex + 1, return LaidOutEvent[]
  return result.map<LaidOutEvent>((ev) => ({
    ...ev,
    columnsCount: (clusterMax[ev.clusterId] ?? ev.columnIndex) + 1,
  }));
}

export function getNowTopPxForDay(day: Date): number | null {
  const now = new Date();
  const isSameDay =
    now.getFullYear() === day.getFullYear() &&
    now.getMonth() === day.getMonth() &&
    now.getDate() === day.getDate();
  if (!isSameDay) return null;
  const mins = minutesSinceStartOfDay(now);
  if (mins < DAY_START_MINUTES || mins > DAY_END_MINUTES) return null;
  const stepsFromStart = (mins - DAY_START_MINUTES) / MINUTES_PER_STEP;
  return stepsFromStart * PIXELS_PER_STEP;
}
