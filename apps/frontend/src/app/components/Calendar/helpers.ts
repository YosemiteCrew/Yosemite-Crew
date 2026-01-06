import { LaidOutEvent } from "@/app/types/calendar";
import { Task } from "@/app/types/task";
import { Team } from "@/app/types/team";
import { Appointment } from "@yosemite-crew/types";

export function isSameDay(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const isSameMonth = (a?: Date | null, b?: Date | null) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth();

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
export function snapDown(mins: number, step = MINUTES_PER_STEP) {
  return Math.floor(mins / step) * step;
}
export function snapUp(mins: number, step = MINUTES_PER_STEP) {
  return Math.ceil(mins / step) * step;
}

export function getDayWindow(events: Appointment[]) {
  const DAY_END = 24 * 60;
  if (!events.length) {
    return { windowStart: 0, windowEnd: DAY_END };
  }
  let minStart = DAY_END;
  let maxEnd = 0;
  for (const ev of events) {
    const s = minutesSinceStartOfDay(ev.startTime);
    const eRaw = minutesSinceStartOfDay(ev.endTime);
    // clamp “midnight end” to 24:00 instead of 0
    const e = eRaw === 0 ? DAY_END : eRaw;
    minStart = Math.min(minStart, s);
    maxEnd = Math.max(maxEnd, e);
  }
  // optional padding so it doesn't feel tight
  const PAD = 30; // minutes
  const windowStart = Math.max(0, minStart - PAD);
  const windowEnd = Math.min(DAY_END, maxEnd + PAD);
  // ensure non-zero window
  if (windowEnd <= windowStart) {
    return {
      windowStart: Math.max(0, windowStart - 60),
      windowEnd: Math.min(DAY_END, windowStart + 120),
    };
  }
  return { windowStart, windowEnd };
}

export function computeVerticalPositionPx(
  event: Appointment,
  windowStart: number,
  windowEnd: number
) {
  const DAY_END = 24 * 60;
  let start = minutesSinceStartOfDay(event.startTime);
  let end = minutesSinceStartOfDay(event.endTime);
  // treat 12:00 AM as 24:00 for same-day clamping
  if (end === 0) end = DAY_END;
  // clamp event to the window
  start = Math.max(windowStart, Math.min(start, windowEnd));
  end = Math.max(windowStart, Math.min(end, windowEnd));
  // if it would collapse, pin to at least one step
  if (end <= start) end = Math.min(windowEnd, start + MINUTES_PER_STEP);
  start = snapDown(start);
  end = snapUp(end);
  if (end <= start) end = Math.min(windowEnd, start + MINUTES_PER_STEP);
  const startSteps = (start - windowStart) / MINUTES_PER_STEP;
  const durationSteps = (end - start) / MINUTES_PER_STEP;
  return {
    topPx: startSteps * PIXELS_PER_STEP,
    heightPx: durationSteps * PIXELS_PER_STEP,
  };
}

export function layoutDayEvents(
  events: Appointment[],
  windowStart: number,
  windowEnd: number
): LaidOutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  type TmpEvent = LaidOutEvent & { clusterId: number };
  const result: TmpEvent[] = [];
  let active: TmpEvent[] = [];
  let clusterId = 0;

  for (const ev of sorted) {
    const { topPx, heightPx } = computeVerticalPositionPx(
      ev,
      windowStart,
      windowEnd
    );

    active = active.filter((a) => a.endTime > ev.startTime);
    if (active.length === 0) clusterId++;

    const usedCols = new Set(active.map((a) => a.columnIndex));
    let colIndex = 0;
    while (usedCols.has(colIndex)) colIndex++;

    const tmp: TmpEvent = {
      ...ev,
      topPx,
      heightPx,
      columnIndex: colIndex,
      columnsCount: 1,
      clusterId,
    };

    active.push(tmp);
    result.push(tmp);
  }

  const clusterMax: Record<number, number> = {};
  for (const ev of result) {
    clusterMax[ev.clusterId] = Math.max(
      clusterMax[ev.clusterId] ?? 0,
      ev.columnIndex
    );
  }

  return result.map((ev) => ({
    ...ev,
    columnsCount: (clusterMax[ev.clusterId] ?? ev.columnIndex) + 1,
  }));
}

export function getTotalWindowHeightPx(windowStart: number, windowEnd: number) {
  return ((windowEnd - windowStart) / MINUTES_PER_STEP) * PIXELS_PER_STEP;
}

export function getNowTopPxForWindow(
  date: Date,
  windowStart: number,
  windowEnd: number
) {
  const now = new Date();

  // Only show the red line on the same day
  if (!isSameDay(now, date)) return null;

  const mins = minutesSinceStartOfDay(now);

  // Your rule: if now is outside the window, clamp to END
  const clamped = mins >= windowStart && mins <= windowEnd ? mins : windowEnd;

  const snapped = snapDown(clamped);
  const steps = (snapped - windowStart) / MINUTES_PER_STEP;

  return steps * PIXELS_PER_STEP;
}

export function isAllDayForDate(ev: Appointment, day: Date): boolean {
  const startOfDay = new Date(day);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(day);
  endOfDay.setHours(23, 59, 59, 999);
  return ev.startTime <= startOfDay && ev.endTime >= endOfDay;
}

export function eventsForDay(events: Task[], day: Date): Task[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();

  return events.filter((event) => {
    const s = event.dueAt;
    const t = new Date(s);
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
  });
}

export function eventsForUser(events: Task[], user: Team): Task[] {
  const id = user._id;
  return events.filter((event) => {
    const assignedTo = event.assignedTo?.toLowerCase() || "";
    return assignedTo === id;
  });
}

export function appointentsForUser(
  events: Appointment[],
  user: Team
): Appointment[] {
  const name = user.name?.toLowerCase() || "";
  return events.filter((event) => {
    const assignedTo = event.lead?.name?.toLowerCase() || "";
    return assignedTo === name;
  });
}
