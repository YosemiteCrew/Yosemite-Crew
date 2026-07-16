import type { Appointment } from '@yosemite-crew/types';

/**
 * Phone day rail layout — the "folding" maths.
 *
 * A phone cannot show a real time grid, so the day is folded into one
 * proportional rail: hours that contain work keep their full proportional
 * height, and runs of consecutive empty hours collapse to a single small band.
 * Everything is expressed as a percentage of the rail height so the component
 * only has to position absolutely-placed boxes.
 */

export const MINUTES_PER_HOUR = 60;

/** Weight of one unfolded (busy) hour. */
export const HOUR_UNITS = 1;

/** Weight of a folded run of empty hours, regardless of how long the run is. */
export const DEFAULT_FOLD_UNITS = 0.55;

/** An empty run must be at least this many whole hours before it folds. */
export const DEFAULT_MIN_FOLD_HOURS = 2;

export type DayRailWindow = {
  /** Whole hour the rail starts at (0-23). */
  startHour: number;
  /** Whole hour the rail ends at (1-24), exclusive of nothing — it is the last label. */
  endHour: number;
};

/** Clinic day the design draws: 08:00 through 16:00. */
export const DEFAULT_DAY_RAIL_WINDOW: DayRailWindow = { startHour: 8, endHour: 16 };

export type DayRailSegmentKind = 'hour' | 'folded';

export type DayRailSegment = {
  kind: DayRailSegmentKind;
  /** Minutes from midnight. */
  startMinutes: number;
  endMinutes: number;
  units: number;
  topPct: number;
  heightPct: number;
};

export type DayRailFold = {
  key: string;
  startMinutes: number;
  endMinutes: number;
  topPct: number;
  heightPct: number;
  /** e.g. "12:00 to 14:00" */
  rangeLabel: string;
};

export type DayRailLabel = {
  key: string;
  minutes: number;
  /** e.g. "08:00" */
  label: string;
  topPct: number;
  /** Whether a gridline is drawn at this boundary. */
  hasLine: boolean;
};

export type DayRailBlock = {
  key: string;
  appointment: Appointment;
  startMinutes: number;
  endMinutes: number;
  topPct: number;
  heightPct: number;
  /** Column index when appointments overlap (0-based). */
  laneIndex: number;
  /** Total columns in this block's overlap cluster. */
  laneCount: number;
  /** e.g. "08:30–09:30" */
  timeLabel: string;
};

export type DayRailLayout = {
  dayWindow: DayRailWindow;
  segments: DayRailSegment[];
  labels: DayRailLabel[];
  folds: DayRailFold[];
  blocks: DayRailBlock[];
  /** Sum of every segment's units. 0 when the window is invalid. */
  totalUnits: number;
};

export type BuildDayRailLayoutOptions = {
  appointments: readonly Appointment[];
  dayWindow: DayRailWindow;
  /** Weight of a folded run. Defaults to {@link DEFAULT_FOLD_UNITS}. */
  foldUnits?: number;
  /** Minimum consecutive empty hours before folding. Defaults to {@link DEFAULT_MIN_FOLD_HOURS}. */
  minFoldHours?: number;
};

const EMPTY_LAYOUT_WINDOW: DayRailWindow = { startHour: 0, endHour: 0 };

const round = (value: number): number => Math.round(value * 1000) / 1000;

export const formatRailTime = (minutesFromMidnight: number): string => {
  const total = Math.round(minutesFromMidnight);
  const hour = Math.floor(total / MINUTES_PER_HOUR);
  const minute = total % MINUTES_PER_HOUR;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const toMinutesFromMidnight = (value: Date): number =>
  value.getHours() * MINUTES_PER_HOUR + value.getMinutes();

/**
 * Minutes from midnight for an appointment, allowing an end time that rolls
 * past midnight (or an end before the start) to read as "end of day".
 */
const appointmentRange = (appointment: Appointment): { start: number; end: number } => {
  const start = toMinutesFromMidnight(appointment.startTime);
  const rawEnd = toMinutesFromMidnight(appointment.endTime);
  const end = rawEnd > start ? rawEnd : 24 * MINUTES_PER_HOUR;
  return { start, end };
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd;

type EmptyRun = { startHour: number; endHour: number };

const collectEmptyRuns = (busyByHour: readonly boolean[], startHour: number): EmptyRun[] => {
  const runs: EmptyRun[] = [];
  let runStart: number | null = null;

  busyByHour.forEach((busy, index) => {
    if (!busy && runStart === null) {
      runStart = index;
    }
    if (busy && runStart !== null) {
      runs.push({ startHour: startHour + runStart, endHour: startHour + index });
      runStart = null;
    }
  });

  if (runStart !== null) {
    runs.push({ startHour: startHour + runStart, endHour: startHour + busyByHour.length });
  }

  return runs;
};

const buildSegments = (
  bounds: DayRailWindow,
  foldedRuns: readonly EmptyRun[]
): Omit<DayRailSegment, 'topPct' | 'heightPct'>[] => {
  const segments: Omit<DayRailSegment, 'topPct' | 'heightPct'>[] = [];
  let hour = bounds.startHour;

  while (hour < bounds.endHour) {
    const fold = foldedRuns.find((run) => run.startHour === hour);
    if (fold) {
      segments.push({
        kind: 'folded',
        startMinutes: fold.startHour * MINUTES_PER_HOUR,
        endMinutes: fold.endHour * MINUTES_PER_HOUR,
        units: 0,
      });
      hour = fold.endHour;
    } else {
      segments.push({
        kind: 'hour',
        startMinutes: hour * MINUTES_PER_HOUR,
        endMinutes: (hour + 1) * MINUTES_PER_HOUR,
        units: HOUR_UNITS,
      });
      hour += 1;
    }
  }

  return segments;
};

/**
 * Position (as a % of rail height) of a point in time on a laid-out rail.
 * Times outside the window clamp to 0 / 100.
 */
export const minutesToPct = (layout: DayRailLayout, minutesFromMidnight: number): number => {
  const { segments } = layout;
  if (segments.length === 0) return 0;

  const first = segments[0];
  // Non-null: the empty case returned above, so `.at(-1)` cannot miss. A runtime
  // guard here would be an unreachable branch.
  const last = segments.at(-1)!;
  if (minutesFromMidnight <= first.startMinutes) return 0;
  if (minutesFromMidnight >= last.endMinutes) return 100;

  const segment = segments.find(
    (candidate) =>
      minutesFromMidnight >= candidate.startMinutes && minutesFromMidnight < candidate.endMinutes
  );
  /* v8 ignore next 1 -- unreachable: the clamps above guarantee a hit */
  if (!segment) return 100;

  const span = segment.endMinutes - segment.startMinutes;
  const progress = (minutesFromMidnight - segment.startMinutes) / span;
  return round(segment.topPct + segment.heightPct * progress);
};

type LaneCluster = { indexes: number[]; laneEnds: number[] };

const assignLanes = (
  ranges: readonly { start: number; end: number }[]
): { laneIndex: number; laneCount: number }[] => {
  const result: { laneIndex: number; laneCount: number }[] = ranges.map(() => ({
    laneIndex: 0,
    laneCount: 1,
  }));

  let cluster: LaneCluster = { indexes: [], laneEnds: [] };
  let clusterEnd = -1;

  const closeCluster = () => {
    cluster.indexes.forEach((index) => {
      result[index].laneCount = cluster.laneEnds.length;
    });
  };

  ranges.forEach((range, index) => {
    if (cluster.indexes.length > 0 && range.start >= clusterEnd) {
      closeCluster();
      cluster = { indexes: [], laneEnds: [] };
      clusterEnd = -1;
    }

    let lane = cluster.laneEnds.findIndex((end) => end <= range.start);
    if (lane === -1) {
      cluster.laneEnds.push(range.end);
      lane = cluster.laneEnds.length - 1;
    } else {
      cluster.laneEnds[lane] = range.end;
    }

    cluster.indexes.push(index);
    result[index].laneIndex = lane;
    clusterEnd = Math.max(clusterEnd, range.end);
  });

  closeCluster();
  return result;
};

const emptyLayout = (dayWindow: DayRailWindow): DayRailLayout => ({
  dayWindow,
  segments: [],
  labels: [],
  folds: [],
  blocks: [],
  totalUnits: 0,
});

export const buildDayRailLayout = (options: BuildDayRailLayoutOptions): DayRailLayout => {
  const { appointments, dayWindow } = options;
  const foldUnits = options.foldUnits ?? DEFAULT_FOLD_UNITS;
  const minFoldHours = options.minFoldHours ?? DEFAULT_MIN_FOLD_HOURS;

  const startHour = Math.floor(dayWindow.startHour);
  const endHour = Math.ceil(dayWindow.endHour);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
    return emptyLayout(EMPTY_LAYOUT_WINDOW);
  }

  const normalizedWindow: DayRailWindow = { startHour, endHour };
  const windowStart = startHour * MINUTES_PER_HOUR;
  const windowEnd = endHour * MINUTES_PER_HOUR;

  const visible = appointments
    .map((appointment) => ({ appointment, ...appointmentRange(appointment) }))
    .filter((entry) => overlaps(entry.start, entry.end, windowStart, windowEnd))
    .map((entry) => ({
      appointment: entry.appointment,
      start: Math.max(entry.start, windowStart),
      end: Math.min(entry.end, windowEnd),
      rawStart: entry.start,
      rawEnd: entry.end,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // An hour is "busy" when any appointment overlaps it — this is what forces an
  // otherwise-empty stretch to stay unfolded.
  const busyByHour = Array.from({ length: endHour - startHour }, (_, index) => {
    const slotStart = (startHour + index) * MINUTES_PER_HOUR;
    const slotEnd = slotStart + MINUTES_PER_HOUR;
    return visible.some((entry) => overlaps(entry.start, entry.end, slotStart, slotEnd));
  });

  const foldedRuns = collectEmptyRuns(busyByHour, startHour).filter(
    (run) => run.endHour - run.startHour >= minFoldHours
  );

  const rawSegments = buildSegments(normalizedWindow, foldedRuns).map((segment) => ({
    ...segment,
    units: segment.kind === 'folded' ? foldUnits : HOUR_UNITS,
  }));

  const totalUnits = rawSegments.reduce((sum, segment) => sum + segment.units, 0);
  // A fully folded day with foldUnits === 0 would divide by zero.
  if (totalUnits <= 0) return emptyLayout(normalizedWindow);

  let cursor = 0;
  const segments: DayRailSegment[] = rawSegments.map((segment) => {
    const topPct = round((cursor / totalUnits) * 100);
    cursor += segment.units;
    const heightPct = round((segment.units / totalUnits) * 100);
    return { ...segment, topPct, heightPct };
  });

  const layout: DayRailLayout = {
    dayWindow: normalizedWindow,
    segments,
    labels: [],
    folds: [],
    blocks: [],
    totalUnits: round(totalUnits),
  };

  layout.folds = segments
    .filter((segment) => segment.kind === 'folded')
    .map((segment) => ({
      key: `fold-${segment.startMinutes}`,
      startMinutes: segment.startMinutes,
      endMinutes: segment.endMinutes,
      topPct: segment.topPct,
      heightPct: segment.heightPct,
      rangeLabel: `${formatRailTime(segment.startMinutes)} to ${formatRailTime(segment.endMinutes)}`,
    }));

  const foldStarts = new Set(layout.folds.map((fold) => fold.startMinutes));
  const foldEnds = new Set(layout.folds.map((fold) => fold.endMinutes));

  const boundaries: number[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    boundaries.push(hour * MINUTES_PER_HOUR);
  }

  layout.labels = boundaries
    // Hours swallowed by a fold get no label — only the fold's own edges show.
    .filter(
      (minutes) =>
        !layout.folds.some((fold) => minutes > fold.startMinutes && minutes < fold.endMinutes)
    )
    .map((minutes) => ({
      key: `label-${minutes}`,
      minutes,
      label: formatRailTime(minutes),
      topPct: minutesToPct(layout, minutes),
      // No line at the top of the rail, and none at a fold edge — the fold band
      // draws its own dashed rules there.
      hasLine: minutes > windowStart && !foldStarts.has(minutes) && !foldEnds.has(minutes),
    }));

  const lanes = assignLanes(visible.map((entry) => ({ start: entry.start, end: entry.end })));

  layout.blocks = visible.map((entry, index) => {
    const topPct = minutesToPct(layout, entry.start);
    const bottomPct = minutesToPct(layout, entry.end);
    return {
      key: entry.appointment.id ?? `appointment-${index}`,
      appointment: entry.appointment,
      startMinutes: entry.start,
      endMinutes: entry.end,
      topPct,
      heightPct: round(Math.max(bottomPct - topPct, 0)),
      laneIndex: lanes[index].laneIndex,
      laneCount: lanes[index].laneCount,
      timeLabel: `${formatRailTime(entry.rawStart)}–${formatRailTime(entry.rawEnd)}`,
    };
  });

  return layout;
};
