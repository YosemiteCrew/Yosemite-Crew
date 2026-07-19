'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import type { Appointment } from '@yosemite-crew/types';

import { getDateKeyInPreferredTimeZone } from '@/app/lib/timezone';
import { getLoadDotCount } from './phoneMonthModel';
import './PhoneDayStrip.css';

const DAYS_IN_WEEK = 7;

/** Frame labels: three-letter, uppercase, Monday first. */
const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export type PhoneDayStripCell = {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  weekdayLabel: string;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  appointmentCount: number;
  dotCount: number;
};

export type PhoneDayStripInput = {
  weekStart: Date;
  appointments: readonly Appointment[];
  selectedDate: Date;
  today: Date;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Seven cells from `weekStart`, each carrying its own load. Appointments are
 * bucketed by their calendar-day key in the preferred timezone (the only correct
 * instant -> day conversion), so a late-evening appointment cannot land on the
 * neighbouring cell when the browser sits in a different zone.
 */
export const buildPhoneDayStrip = ({
  weekStart,
  appointments,
  selectedDate,
  today,
}: PhoneDayStripInput): PhoneDayStripCell[] => {
  const counts = new Map<string, number>();
  appointments.forEach((appointment) => {
    const key = getDateKeyInPreferredTimeZone(appointment.startTime);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const todayKey = getDateKeyInPreferredTimeZone(today);
  const selectedKey = getDateKeyInPreferredTimeZone(selectedDate);

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = getDateKeyInPreferredTimeZone(date);
    const appointmentCount = counts.get(dateKey) ?? 0;

    return {
      date,
      dateKey,
      dayOfMonth: date.getDate(),
      weekdayLabel: WEEKDAY_LABELS[index],
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      isSelected: dateKey === selectedKey,
      appointmentCount,
      dotCount: getLoadDotCount(appointmentCount),
    };
  });
};

/** Past load reads as done (green); anything from today onwards reads live (blue). */
const dotColour = (cell: PhoneDayStripCell): string =>
  cell.isPast ? 'var(--status-completed-border)' : 'var(--blue)';

export type PhoneDayStripProps = {
  weekStart: Date;
  appointments: readonly Appointment[];
  selectedDate: Date;
  /** Injectable for deterministic rendering/tests. Defaults to now. */
  today?: Date;
  onSelectDay?: (date: Date) => void;
  className?: string;
};

/**
 * Phone day selector — the week as seven tappable load cells.
 *
 * The frame gives the phone day view its own date strip rather than a shrunken
 * week header: each cell stacks the weekday over the date over up to three load
 * dots, and the selected day fills with `--blue` and lifts on a blue glow. Empty
 * days recede to 45% so the busy end of the week reads at a glance.
 */
const PhoneDayStrip = ({
  weekStart,
  appointments,
  selectedDate,
  today,
  onSelectDay,
  className,
}: Readonly<PhoneDayStripProps>) => {
  const cells = useMemo(
    () => buildPhoneDayStrip({ weekStart, appointments, selectedDate, today: today ?? new Date() }),
    [weekStart, appointments, selectedDate, today]
  );

  return (
    <div className={clsx('yc-day-strip', className)} role="group" aria-label="Select a day">
      {cells.map((cell) => (
        <button
          key={cell.dateKey}
          type="button"
          aria-pressed={cell.isSelected}
          aria-current={cell.isToday ? 'date' : undefined}
          aria-label={`${cell.weekdayLabel} ${cell.dayOfMonth} · ${cell.appointmentCount} appointments`}
          onClick={() => onSelectDay?.(cell.date)}
          className={clsx(
            'yc-day-strip__cell',
            cell.isSelected && 'yc-day-strip__cell--selected',
            !cell.isSelected && cell.appointmentCount === 0 && 'yc-day-strip__cell--quiet'
          )}
        >
          <span className="yc-day-strip__weekday">{cell.weekdayLabel}</span>
          <span
            className={clsx(
              'yc-day-strip__date',
              !cell.isSelected && cell.isPast && 'yc-day-strip__date--past'
            )}
          >
            {cell.dayOfMonth}
          </span>
          <span className="yc-day-strip__dots" data-testid={`day-strip-dots-${cell.dateKey}`}>
            {Array.from({ length: cell.dotCount }, (_, index) => (
              <span
                key={`${cell.dateKey}-dot-${index}`}
                className="yc-day-strip__dot"
                style={cell.isSelected ? undefined : { background: dotColour(cell) }}
              />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
};

export default PhoneDayStrip;
