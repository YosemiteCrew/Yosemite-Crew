'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { IoAdd, IoSwapVerticalOutline } from 'react-icons/io5';
import type { Appointment } from '@yosemite-crew/types';

import {
  DEFAULT_DAY_RAIL_WINDOW,
  buildDayRailLayout,
  formatRailTime,
  minutesToPct,
  type DayRailBlock,
  type DayRailFold,
  type DayRailWindow,
} from './dayRailLayout';

import './PhoneDayRail.css';

const STATUS_LABELS: Record<Appointment['status'], string> = {
  REQUESTED: 'Requested',
  UPCOMING: 'Upcoming',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

/** `CHECKED_IN` -> `checked-in`, matching the `--status-*` token names. */
const statusToken = (status: Appointment['status']): string =>
  status.toLowerCase().replaceAll('_', '-');

const blockTitle = (appointment: Appointment): string => {
  const detail = appointment.concern ?? appointment.appointmentType?.name;
  return detail ? `${appointment.patient.name} · ${detail}` : appointment.patient.name;
};

const blockMeta = (block: DayRailBlock): string =>
  [block.timeLabel, block.appointment.room?.name, block.appointment.patient.parent.name]
    .filter(Boolean)
    .join(' · ');

const blockGeometry = (block: DayRailBlock): React.CSSProperties => {
  const laneWidth = 100 / block.laneCount;
  return {
    top: `${block.topPct}%`,
    height: `${block.heightPct}%`,
    left: `calc(56px + (100% - 66px) * ${(block.laneIndex * laneWidth) / 100})`,
    width: `calc((100% - 66px) * ${laneWidth / 100} - ${block.laneIndex > 0 ? 4 : 0}px)`,
    ['--block-bg' as string]: `var(--status-${statusToken(block.appointment.status)}-bg)`,
    ['--block-border' as string]: `var(--status-${statusToken(block.appointment.status)}-border)`,
    ['--block-text' as string]: `var(--status-${statusToken(block.appointment.status)}-text)`,
  };
};

export type PhoneDayRailProps = {
  /** Appointments for the day. Anything outside `dayWindow` is dropped. */
  appointments: readonly Appointment[];
  /** Whole-hour day window. Defaults to 08:00–16:00. */
  dayWindow?: DayRailWindow;
  /** Minutes from midnight for the "now" marker. Omit to hide it. */
  nowMinutes?: number | null;
  /** Height weight of a folded run relative to one hour (1). */
  foldUnits?: number;
  /** Consecutive empty hours needed before a run folds. */
  minFoldHours?: number;
  /** Accessible name for the rail region. */
  ariaLabel?: string;
  /** Copy shown when the window contains no appointments at all. */
  emptyLabel?: string;
  onSelectAppointment?: (appointment: Appointment) => void;
  /** Renders the "Start visit" pill on checked-in appointments when provided. */
  onStartVisit?: (appointment: Appointment) => void;
  /** Renders the "Book" chip inside a folded band when provided. */
  onBookFold?: (fold: DayRailFold) => void;
  /** Makes the folded band's label tappable when provided. */
  onExpandFold?: (fold: DayRailFold) => void;
  className?: string;
};

const PhoneDayRail = ({
  appointments,
  dayWindow = DEFAULT_DAY_RAIL_WINDOW,
  nowMinutes = null,
  foldUnits,
  minFoldHours,
  ariaLabel = 'Day schedule',
  emptyLabel = 'Nothing booked today.',
  onSelectAppointment,
  onStartVisit,
  onBookFold,
  onExpandFold,
  className,
}: PhoneDayRailProps) => {
  const layout = useMemo(
    () => buildDayRailLayout({ appointments, dayWindow, foldUnits, minFoldHours }),
    [appointments, dayWindow, foldUnits, minFoldHours]
  );

  const showNow =
    typeof nowMinutes === 'number' &&
    layout.segments.length > 0 &&
    nowMinutes >= dayWindow.startHour * 60 &&
    nowMinutes <= dayWindow.endHour * 60;
  const nowPct = showNow ? minutesToPct(layout, nowMinutes) : 0;

  return (
    <section className={clsx('yc-day-rail', className)} aria-label={ariaLabel}>
      {layout.labels.map((label, index) => (
        <span
          key={label.key}
          className={clsx(
            'yc-day-rail__label',
            index === 0 && 'yc-day-rail__label--first',
            index === layout.labels.length - 1 && 'yc-day-rail__label--last'
          )}
          style={{ top: `${label.topPct}%` }}
        >
          {label.label}
        </span>
      ))}

      {layout.labels.reduce<React.ReactElement[]>((lines, label) => {
        if (label.hasLine) {
          lines.push(
            <span
              key={`line-${label.key}`}
              className="yc-day-rail__line"
              style={{ top: `${label.topPct}%` }}
            />
          );
        }
        return lines;
      }, [])}

      {layout.folds.map((fold) => (
        <div
          key={fold.key}
          className="yc-day-rail__fold"
          data-testid="day-rail-fold"
          style={{ top: `${fold.topPct}%`, height: `${fold.heightPct}%` }}
        >
          {/* A fold only ever collapses empty hours, so expanding it reveals blank
              space - Book is the action that matters on a free band. Without a
              handler this stays a static label rather than a dead button. */}
          {onExpandFold ? (
            <button
              type="button"
              className="yc-day-rail__fold-expand"
              onClick={() => onExpandFold(fold)}
            >
              <IoSwapVerticalOutline className="yc-day-rail__fold-icon" aria-hidden />
              {`${fold.rangeLabel} free · folded`}
            </button>
          ) : (
            <span className="yc-day-rail__fold-expand">
              <IoSwapVerticalOutline className="yc-day-rail__fold-icon" aria-hidden />
              {`${fold.rangeLabel} free · folded`}
            </span>
          )}
          {onBookFold ? (
            <button
              type="button"
              className="yc-day-rail__fold-book"
              onClick={() => onBookFold(fold)}
            >
              <IoAdd aria-hidden />
              Book
            </button>
          ) : null}
        </div>
      ))}

      {layout.blocks.map((block) => {
        const canStart = Boolean(onStartVisit) && block.appointment.status === 'CHECKED_IN';
        return (
          <div
            key={block.key}
            className="yc-day-rail__block"
            data-testid="day-rail-block"
            style={blockGeometry(block)}
          >
            <span className="yc-day-rail__block-head">
              <button
                type="button"
                className={clsx(
                  'yc-day-rail__block-title',
                  onSelectAppointment && 'yc-day-rail__block-title--interactive'
                )}
                disabled={!onSelectAppointment}
                onClick={() => onSelectAppointment?.(block.appointment)}
              >
                {blockTitle(block.appointment)}
              </button>
              {block.appointment.status === 'UPCOMING' ? null : (
                <span className="yc-day-rail__block-status">
                  {STATUS_LABELS[block.appointment.status]}
                </span>
              )}
            </span>
            <span className="yc-day-rail__block-meta">{blockMeta(block)}</span>
            {canStart ? (
              <button
                type="button"
                className="yc-day-rail__block-action"
                onClick={() => onStartVisit?.(block.appointment)}
              >
                Start visit
              </button>
            ) : null}
          </div>
        );
      })}

      {showNow ? (
        <React.Fragment>
          <span
            className="yc-day-rail__now-line"
            style={{ top: `${nowPct}%` }}
            data-testid="day-rail-now-line"
          />
          <span className="yc-day-rail__now-pill" style={{ top: `${nowPct}%` }}>
            {formatRailTime(nowMinutes)}
          </span>
        </React.Fragment>
      ) : null}

      {layout.blocks.length === 0 && layout.segments.length > 0 ? (
        <span className="yc-day-rail__empty">{emptyLabel}</span>
      ) : null}
    </section>
  );
};

export default PhoneDayRail;
