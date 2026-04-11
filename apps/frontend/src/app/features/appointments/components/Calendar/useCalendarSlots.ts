import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import {
  formatDateInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
} from '@/app/lib/timezone';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  getFirstRelevantTimedEventStart,
  getNowTopPxForHourRange,
  getTopPxForMinutes,
  nextDay,
  scrollContainerToTarget,
  startOfDayDate,
} from '@/app/features/appointments/components/Calendar/helpers';
import { getHourRowHeightPx } from '@/app/features/appointments/components/Calendar/calendarLayout';
import type { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  getNextWeek,
  getPrevWeek,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';

type CalendarHourRange = {
  startHour: number;
  endHour: number;
};

type MinuteInterval = {
  startMinute: number;
  endMinute: number;
};

type TimedEventLike = {
  startTime: Date;
  endTime: Date;
};

type AutoScrollOptions = {
  date: Date;
  events: TimedEventLike[];
  height: number;
  nowPosition: { topPx: number } | null;
  scrollContainer: HTMLDivElement | null;
  skip?: boolean;
  rangeStart?: Date;
  rangeEnd?: Date;
  focusStartHour?: number;
  hourRowGapPx?: number;
  hourRowTopOffsetPx?: number;
};

/**
 * Computes the minute offsets within each hour for the given step size,
 * plus whether slot-time labels should be shown at the current zoom level.
 */
export function useSlotOffsetMinutes(
  slotStepMinutes: number,
  zoomMode: CalendarZoomMode
): { slotOffsetMinutes: number[]; showSlotTimeLabels: boolean } {
  const height = getHourRowHeightPx(zoomMode);

  const slotOffsetMinutes = useMemo(() => {
    const step = Math.max(5, Math.round(slotStepMinutes || 15));
    if (step >= 60) return [];
    const offsets: number[] = [];
    for (let minute = step; minute < 60; minute += step) {
      offsets.push(minute);
    }
    return offsets;
  }, [slotStepMinutes]);

  const showSlotTimeLabels = useMemo(() => {
    if (!slotOffsetMinutes.length) return false;
    const firstStep = slotOffsetMinutes[0];
    const pixelsPerSlot = (firstStep / 60) * height;
    return pixelsPerSlot >= 14;
  }, [height, slotOffsetMinutes]);

  return { slotOffsetMinutes, showSlotTimeLabels };
}

export function getVisibleHourRange(
  zoomMode: CalendarZoomMode,
  minuteValues: number[],
  options?: {
    forceFullDay?: boolean;
    startHour?: number;
    endHour?: number;
    paddingMinutes?: number;
    minVisibleHours?: number;
  }
): CalendarHourRange {
  const {
    forceFullDay = false,
    startHour = 0,
    endHour = HOURS_IN_DAY - 1,
    paddingMinutes = 30,
    minVisibleHours = 2,
  } = options ?? {};

  if (zoomMode === 'out' || forceFullDay) return { startHour, endHour };
  if (!minuteValues.length) return { startHour, endHour };

  const minMinute = Math.max(startHour * 60, Math.min(...minuteValues) - paddingMinutes);
  const maxMinute = Math.min((endHour + 1) * 60 - 1, Math.max(...minuteValues) + paddingMinutes);
  const nextStartHour = Math.max(startHour, Math.floor(minMinute / 60));
  const nextEndHour = Math.min(endHour, Math.ceil(maxMinute / 60));

  return {
    startHour: nextStartHour,
    endHour: Math.min(endHour, Math.max(nextStartHour + minVisibleHours, nextEndHour)),
  };
}

export function getVisibleHours(range: CalendarHourRange): number[] {
  return Array.from(
    { length: Math.max(1, range.endHour - range.startHour + 1) },
    (_, index) => range.startHour + index
  );
}

export function getUnavailableSegmentsForHourRange(
  availabilityLoaded: boolean,
  visibleIntervals: MinuteInterval[],
  range: CalendarHourRange
): MinuteInterval[] {
  if (!visibleIntervals.length) {
    return availabilityLoaded
      ? [{ startMinute: range.startHour * 60, endMinute: (range.endHour + 1) * 60 }]
      : [];
  }

  const segments: MinuteInterval[] = [];
  const sorted = [...visibleIntervals].sort((a, b) => a.startMinute - b.startMinute);
  const rangeStartMinute = range.startHour * 60;
  const rangeEndMinute = (range.endHour + 1) * 60;

  if (sorted[0].startMinute > rangeStartMinute) {
    segments.push({ startMinute: rangeStartMinute, endMinute: sorted[0].startMinute });
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (sorted[index].endMinute < sorted[index + 1].startMinute) {
      segments.push({
        startMinute: sorted[index].endMinute,
        endMinute: sorted[index + 1].startMinute,
      });
    }
  }

  const last = sorted.at(-1);
  if (last && last.endMinute < rangeEndMinute) {
    segments.push({ startMinute: last.endMinute, endMinute: rangeEndMinute });
  }

  return segments;
}

export function getTimedTaskProxyEvents(
  tasks: Array<{ dueAt: Date | string }>,
  durationMinutes = 30
): TimedEventLike[] {
  return tasks.map((task) => {
    const startTime = new Date(task.dueAt);
    return {
      startTime,
      endTime: new Date(startTime.getTime() + durationMinutes * 60 * 1000),
    };
  });
}

export function useCalendarWeekNavigation(
  setWeekStart: Dispatch<SetStateAction<Date>>,
  setCurrentDate: Dispatch<SetStateAction<Date>>
): { handlePrevWeek: () => void; handleNextWeek: () => void } {
  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const nextWeekStart = getPrevWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  }, [setCurrentDate, setWeekStart]);

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const nextWeekStart = getNextWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  }, [setCurrentDate, setWeekStart]);

  return { handlePrevWeek, handleNextWeek };
}

export function useCalendarAutoScroll({
  date,
  events,
  height,
  nowPosition,
  scrollContainer,
  skip = false,
  rangeStart,
  rangeEnd,
  focusStartHour = 0,
  hourRowGapPx = 0,
  hourRowTopOffsetPx = 0,
}: AutoScrollOptions): void {
  useEffect(() => {
    if (!scrollContainer || skip) return;

    const effectiveRangeStart = rangeStart ?? startOfDayDate(date);
    const effectiveRangeEnd = rangeEnd ?? nextDay(date);
    const focusStart = getFirstRelevantTimedEventStart(
      events as never,
      effectiveRangeStart,
      effectiveRangeEnd
    );
    const focusMinutes = focusStart
      ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    let topPx: number;
    if (nowPosition) {
      topPx = Math.max(0, nowPosition.topPx);
    } else if (focusStartHour > 0) {
      topPx = ((focusMinutes - focusStartHour * 60) / 60) * height + hourRowTopOffsetPx;
    } else {
      topPx = getTopPxForMinutes(focusMinutes, height, hourRowGapPx, hourRowTopOffsetPx);
    }

    scrollContainerToTarget(scrollContainer, topPx);
  }, [
    date,
    events,
    focusStartHour,
    height,
    hourRowGapPx,
    hourRowTopOffsetPx,
    nowPosition,
    rangeEnd,
    rangeStart,
    scrollContainer,
    skip,
  ]);
}

/**
 * Computes now-indicator position and label for a full-day hour-range calendar.
 */
export function useNowIndicator(
  date: Date,
  startHour: number,
  endHour: number,
  zoomMode: CalendarZoomMode,
  now: Date,
  hourRowTopOffsetPx: number
): { nowPosition: { topPx: number } | null; nowTimeLabel: string | null } {
  const height = getHourRowHeightPx(zoomMode);

  const nowPosition = useMemo(() => {
    const topPx = getNowTopPxForHourRange(
      date,
      startHour,
      endHour,
      height,
      now,
      hourRowTopOffsetPx
    );
    if (topPx == null) return null;
    return { topPx };
  }, [date, endHour, height, hourRowTopOffsetPx, now, startHour]);

  const nowTimeLabel = useMemo(() => {
    if (!nowPosition) return null;
    return formatDateInPreferredTimeZone(now, { hour: 'numeric', minute: '2-digit' });
  }, [now, nowPosition]);

  return { nowPosition, nowTimeLabel };
}
