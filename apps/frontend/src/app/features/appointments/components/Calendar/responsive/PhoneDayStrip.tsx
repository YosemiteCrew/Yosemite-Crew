'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import type { Appointment } from '@yosemite-crew/types';

import { buildPhoneDayStrip, type PhoneDayStripCell } from './phoneDayStripModel';
import './PhoneDayStrip.css';

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
    <div /* NOSONAR: styled horizontal day strip; native <fieldset> defaults (block layout, border, required legend) break the strip design */
      className={clsx('yc-day-strip', className)}
      role="group"
      aria-label="Select a day"
    >
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
