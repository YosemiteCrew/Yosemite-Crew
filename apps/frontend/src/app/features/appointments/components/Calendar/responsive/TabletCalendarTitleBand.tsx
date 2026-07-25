'use client';

import React from 'react';

import { buildTabletToolbarTitle } from './tabletToolbarModel';
import './TabletCalendar.css';

/** Frame legend: four 7px swatches, in this order, at 10.5px `--ink-faint`. */
const LEGEND_ITEMS: ReadonlyArray<{ label: string; colour: string }> = [
  { label: 'Upcoming', colour: 'var(--status-upcoming-border)' },
  { label: 'In progress', colour: 'var(--status-in-progress-border)' },
  { label: 'Done', colour: 'var(--status-completed-border)' },
  { label: 'Emergency', colour: 'var(--danger)' },
];

export type TabletCalendarTitleBandProps = {
  /** The shared page-level view key: `day` | `week` | `team`. */
  activeCalendar: string;
  currentDate: Date;
  weekStart: Date;
  /** Appointments already scoped to the visible period by the caller. */
  appointmentCount: number;
};

/**
 * The tablet frame's period line: a serif title naming the visible period, its
 * appointment count, and the status legend.
 *
 * This band exists only between 768 and 1023px. The controls above it (pager,
 * Today, view switch, filters, New, zoom) all live in the shared calendar
 * `Header`, which is owned by the desktop pass — this component deliberately
 * adds no control of its own so the two layers cannot fight over the same
 * handler. Below 768px `PhoneCalendar` renders its own title instead.
 */
const TabletCalendarTitleBand = ({
  activeCalendar,
  currentDate,
  weekStart,
  appointmentCount,
}: Readonly<TabletCalendarTitleBandProps>) => {
  const { title, countLabel } = buildTabletToolbarTitle({
    activeCalendar,
    currentDate,
    weekStart,
    appointmentCount,
  });

  return (
    <div className="yc-tablet-toolbar__body">
      <div className="yc-tablet-toolbar__title-row">
        <h2 className="yc-tablet-toolbar__title">
          {title}
          {countLabel ? (
            <span className="yc-tablet-toolbar__title-count">{` ${countLabel}`}</span>
          ) : null}
        </h2>
        <span className="yc-tablet-toolbar__legend">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.label} className="yc-tablet-toolbar__legend-item">
              <span
                aria-hidden
                className="yc-tablet-toolbar__legend-swatch"
                style={{ background: item.colour }}
              />
              {item.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

export default TabletCalendarTitleBand;
