'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { IoChevronBackOutline, IoChevronForwardOutline, IoWarning } from 'react-icons/io5';
import type { Appointment } from '@yosemite-crew/types';

import {
  buildPhoneWeekOverview,
  SEGMENT_COLORS,
  type PhoneWeekDayMeta,
  type PhoneWeekDayRow,
} from './phoneWeekLoad';

import './PhoneWeekOverview.css';
import { toDateKey } from '@/app/features/appointments/components/Calendar/responsive/phoneWeekLoad';

export type PhoneCalendarView = 'day' | 'week' | 'month';

const VIEW_OPTIONS: { value: PhoneCalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const LEGEND_ITEMS = [
  { label: 'Done', color: SEGMENT_COLORS.completed },
  { label: 'In progress', color: SEGMENT_COLORS.inProgress },
  { label: 'Upcoming', color: SEGMENT_COLORS.upcoming },
  { label: 'Free', color: null },
];

export type PhoneWeekOverviewProps = {
  /** First day of the displayed week (Monday). */
  weekStart: Date;
  /** Appointments to lay out; days outside the week are ignored. */
  appointments: Appointment[];
  /** Day currently highlighted, if any. */
  selectedDate?: Date | null;
  /** Per-day context (closed, notes, vets off, capacity) keyed by "YYYY-MM-DD". */
  dayMeta?: Record<string, PhoneWeekDayMeta>;
  /** Booking capacity for days without their own — scales every load bar. */
  defaultCapacity?: number;
  /** Which segment of the Day | Week | Month control reads as active. */
  view?: PhoneCalendarView;
  onViewChange?: (view: PhoneCalendarView) => void;
  onSelectDay?: (date: Date) => void;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
};

type DayRowProps = {
  day: PhoneWeekDayRow;
  isSelected: boolean;
  onSelectDay?: (date: Date) => void;
};

const LoadBar = ({ day }: { day: PhoneWeekDayRow }) => (
  <span className="yc-pwo-bar" data-testid={`load-bar-${day.dateKey}`}>
    {day.segments.map((segment) => (
      <span
        key={segment.kind}
        data-testid={`load-segment-${day.dateKey}-${segment.kind}`}
        style={{ width: `${segment.widthPercent}%`, background: segment.color }}
      />
    ))}
  </span>
);

const DayRow = ({ day, isSelected, onSelectDay }: DayRowProps) => {
  const className = clsx('yc-pwo-row', `yc-pwo-row--${day.tone}`, {
    'yc-pwo-row--selected': isSelected,
  });

  const dateBlock = (
    <span className="yc-pwo-date">
      <span className="yc-pwo-weekday">{day.weekdayLabel}</span>
      <span className="yc-pwo-dayofmonth">{day.dayOfMonthLabel}</span>
    </span>
  );

  // A closed day has nothing to open, so it is a plain row rather than a button.
  if (!day.showLoadBar) {
    return (
      <li>
        <div className={className}>
          {dateBlock}
          <span className="yc-pwo-closed-text">{day.summary}</span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        className={className}
        aria-current={isSelected ? 'date' : undefined}
        onClick={() => onSelectDay?.(day.date)}
      >
        {dateBlock}
        <span className="yc-pwo-load">
          <LoadBar day={day} />
          <span className="yc-pwo-summary">
            {day.summary}
            {day.flag ? (
              <span className="yc-pwo-flag">
                <IoWarning aria-hidden size={8} />
                {day.flag}
              </span>
            ) : null}
          </span>
        </span>
        <IoChevronForwardOutline className="yc-pwo-chevron" aria-hidden />
      </button>
    </li>
  );
};

/**
 * The week, rendered for a phone: seven rows, each carrying its day's load as a
 * summary line and a proportional bar. Fully prop-driven — the caller owns the
 * data and every navigation decision.
 */
const PhoneWeekOverview = ({
  weekStart,
  appointments,
  selectedDate = null,
  dayMeta,
  defaultCapacity,
  view = 'week',
  onViewChange,
  onSelectDay,
  onPreviousWeek,
  onNextWeek,
}: PhoneWeekOverviewProps) => {
  const overview = useMemo(
    () => buildPhoneWeekOverview({ weekStart, appointments, dayMeta, defaultCapacity }),
    [weekStart, appointments, dayMeta, defaultCapacity]
  );

  // Each day row is keyed by its preferred-time-zone day (buildPhoneWeekOverview matches
  // appointments the same way), so the selection must be keyed in that zone too. Using the
  // device-local day here highlighted the wrong row when the preferred zone crossed a local
  // midnight relative to the selected instant.
  // The same key function the ROWS use. Deriving this in the preferred timezone
  // while rows were keyed device-locally produced two different keys for one day
  // on a device ahead of that zone, so the highlight moved or vanished.
  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

  return (
    <section className="yc-pwo" aria-label={`${overview.weekLabel}, ${overview.rangeLabel}`}>
      <div className="yc-pwo-weeknav">
        <span className="yc-pwo-weeknav-pill">
          <button
            type="button"
            className="yc-pwo-weeknav-btn"
            aria-label="Previous week"
            disabled={!onPreviousWeek}
            onClick={onPreviousWeek}
          >
            <IoChevronBackOutline aria-hidden size={12} />
          </button>
          <span className="yc-pwo-weeknav-label">{overview.rangeLabel}</span>
          <button
            type="button"
            className="yc-pwo-weeknav-btn"
            aria-label="Next week"
            disabled={!onNextWeek}
            onClick={onNextWeek}
          >
            <IoChevronForwardOutline aria-hidden size={12} />
          </button>
        </span>
      </div>

      <div className="yc-pwo-head">
        <div className="yc-pwo-head-titles">
          <h2 className="yc-pwo-title">{overview.weekLabel}</h2>
          <span className="yc-pwo-subtitle">{overview.summaryLabel}</span>
        </div>
        <div className="yc-pwo-views" role="radiogroup" aria-label="Calendar view">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              className="yc-pwo-view"
              aria-checked={view === option.value}
              onClick={() => onViewChange?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="yc-pwo-days">
        {overview.days.map((day) => (
          <DayRow
            key={day.dateKey}
            day={day}
            isSelected={day.dateKey === selectedKey}
            onSelectDay={onSelectDay}
          />
        ))}
      </ul>

      <div className="yc-pwo-legend">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="yc-pwo-legend-item">
            <span
              className={clsx('yc-pwo-legend-swatch', {
                'yc-pwo-legend-swatch--free': !item.color,
              })}
              style={item.color ? { background: item.color } : undefined}
            />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
};

export default PhoneWeekOverview;
