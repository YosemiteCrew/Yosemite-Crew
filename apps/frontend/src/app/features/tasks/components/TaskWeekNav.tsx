'use client';
import React, { useCallback, useMemo } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import {
  getStartOfWeek,
  getWeekDays,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

/**
 * Week-range navigator for the tasks planner. The design puts this control in
 * the page title row next to the view toggle, so it lives outside the agenda
 * board and is threaded in through TitleCalendar's `actionBeforeAdd` slot.
 */
type TaskWeekNavProps = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
};

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const buildWeekRangeLabel = (days: Date[]): string => {
  const first = days[0];
  const last = days.at(-1);
  /* v8 ignore next 2 -- getWeekDays always returns 7 days; defensive only. */
  if (!first || !last) return '';
  const firstDay = formatDateInPreferredTimeZone(first, { day: 'numeric' });
  const lastDay = formatDateInPreferredTimeZone(last, { day: 'numeric' });
  const firstMonth = formatDateInPreferredTimeZone(first, { month: 'short' });
  const lastMonth = formatDateInPreferredTimeZone(last, { month: 'short' });
  if (firstMonth === lastMonth) {
    return `${firstDay} – ${lastDay} ${lastMonth}`;
  }
  return `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth}`;
};

const TaskWeekNav = ({ currentDate, setCurrentDate, setWeekStart }: TaskWeekNavProps) => {
  // Monday-aligned, matching the agenda board the label describes.
  const days = useMemo(() => getWeekDays(getStartOfWeek(currentDate, 1)), [currentDate]);
  const weekRangeLabel = useMemo(() => buildWeekRangeLabel(days), [days]);

  const goToPrevWeek = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, -7));
    setWeekStart((prev) => addDays(prev, -7));
  }, [setCurrentDate, setWeekStart]);

  const goToNextWeek = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, 7));
    setWeekStart((prev) => addDays(prev, 7));
  }, [setCurrentDate, setWeekStart]);

  return (
    <span className="flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--field-bg)] p-1">
      <button
        type="button"
        aria-label="Previous week"
        onClick={goToPrevWeek}
        className="flex size-[30px] items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-card-hover hover:text-text-primary"
      >
        <IoChevronBack size={14} aria-hidden="true" />
      </button>
      <span className="px-1.5 text-[13px] font-bold tabular-nums text-text-primary">
        {weekRangeLabel}
      </span>
      <button
        type="button"
        aria-label="Next week"
        onClick={goToNextWeek}
        className="flex size-[30px] items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-card-hover hover:text-text-primary"
      >
        <IoChevronForward size={14} aria-hidden="true" />
      </button>
    </span>
  );
};

export default TaskWeekNav;
