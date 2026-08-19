'use client';

import React, { useMemo } from 'react';
import type { Appointment } from '@yosemite-crew/types';
import type { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import clsx from 'clsx';
import {
  IoArrowForward,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoWarning,
} from 'react-icons/io5';
import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import {
  buildPhoneMonthModel,
  shiftMonthAnchor,
  type PhoneMonthCell,
  type PhoneMonthPeekItem,
} from './phoneMonthModel';

export type PhoneCalendarView = 'day' | 'week' | 'month';

const VIEW_OPTIONS: ReadonlyArray<SegmentedPillOption<PhoneCalendarView>> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const STATUS_BADGE_CLASSES: Record<AppointmentStatus, string> = {
  REQUESTED:
    'bg-[var(--status-requested-bg)] text-[var(--status-requested-text)] border-[var(--status-requested-border)]',
  UPCOMING:
    'bg-[var(--status-upcoming-bg)] text-[var(--status-upcoming-text)] border-[var(--status-upcoming-border)]',
  CHECKED_IN:
    'bg-[var(--status-checked-in-bg)] text-[var(--status-checked-in-text)] border-[var(--status-checked-in-border)]',
  IN_PROGRESS:
    'bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress-text)] border-[var(--status-in-progress-border)]',
  COMPLETED:
    'bg-[var(--status-completed-bg)] text-[var(--status-completed-text)] border-[var(--status-completed-border)]',
  CANCELLED:
    'bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border-[var(--status-cancelled-border)]',
  NO_SHOW:
    'bg-[var(--status-no-show-bg)] text-[var(--status-no-show-text)] border-[var(--status-no-show-border)]',
};

const EMERGENCY_BADGE_CLASSES =
  'bg-[var(--danger-bg)] text-[var(--danger-text)] border-[var(--danger-border)]';

export type PhoneMonthOverviewProps = {
  /** Any instant inside the month to render. */
  monthDate: Date;
  appointments: readonly Appointment[];
  /** Injectable for deterministic rendering/tests. Defaults to now. */
  today?: Date;
  selectedDate?: Date | null;
  view?: PhoneCalendarView;
  onViewChange?: (view: PhoneCalendarView) => void;
  /** Fires with a mid-month anchor for the previous/next month. */
  onMonthChange?: (monthDate: Date) => void;
  onSelectDay?: (cell: PhoneMonthCell) => void;
  onOpenDay?: (dateKey: string) => void;
  className?: string;
};

const dayNumberColourClass = (cell: PhoneMonthCell): string => {
  // Three distinct steps, all of which clear AA. These used to be separated by
  // cell opacity (0.35 for padding, 0.45 for quiet), which is what made the
  // padding days unreadable; collapsing both onto --ink-faint then made an
  // adjacent-month day look like an ordinary quiet one. --ink-faint is the
  // faintest passing ink and reads as furthest away, --ink-muted a step nearer.
  if (cell.isOutsideMonth) return 'text-[var(--ink-faint)]';
  if (cell.appointmentCount === 0) return 'text-[var(--ink-muted)]';
  if (cell.isToday) return 'text-[var(--nav-active)]';
  if (cell.isPast) return 'text-[var(--ink-muted)]';
  return 'text-[var(--ink)]';
};

/** Past load reads green (done), live load reads blue; emergencies bleed red. */
const dotColourVar = (cell: PhoneMonthCell, isLastDot: boolean): string => {
  if (cell.hasEmergency && isLastDot) return 'var(--danger)';
  if (cell.isPast) return 'var(--status-completed-border)';
  return 'var(--blue)';
};

const LoadDots = ({ cell }: Readonly<{ cell: PhoneMonthCell }>) => (
  <span className="flex h-1 gap-[2px]" data-testid={`dots-${cell.dateKey}`}>
    {Array.from({ length: cell.dotCount }, (_, index) => (
      <span
        key={`${cell.dateKey}-dot-${index}`}
        className="size-1 rounded-full"
        style={{ background: dotColourVar(cell, index === cell.dotCount - 1) }}
      />
    ))}
  </span>
);

const DayCell = ({
  cell,
  onSelectDay,
}: Readonly<{ cell: PhoneMonthCell; onSelectDay?: (cell: PhoneMonthCell) => void }>) => (
  <button
    type="button"
    aria-pressed={cell.isSelected}
    aria-current={cell.isToday ? 'date' : undefined}
    aria-label={`${cell.dateKey} · ${cell.appointmentCount} appointments`}
    onClick={() => onSelectDay?.(cell)}
    className="flex cursor-pointer flex-col items-center gap-[2px] rounded-xl py-1.5"
  >
    {cell.isSelected ? (
      <span className="flex size-[26px] items-center justify-center rounded-full bg-[var(--blue-strong)] text-[12.5px] font-bold text-white shadow-[0_4px_12px_var(--glow-b26)]">
        {cell.dayOfMonth}
      </span>
    ) : (
      <span className={clsx('text-[12.5px] font-semibold', dayNumberColourClass(cell))}>
        {cell.dayOfMonth}
      </span>
    )}
    <LoadDots cell={cell} />
  </button>
);

const PeekRow = ({ item }: Readonly<{ item: PhoneMonthPeekItem }>) => (
  <div
    className={clsx(
      'flex items-center gap-2.5 rounded-[13px] bg-[var(--screen)] px-3 py-[9px]',
      item.isEmergency
        ? 'border border-[var(--danger-border)] border-l-[3px] border-l-[var(--danger)]'
        : 'border border-[var(--hairline)] shadow-[0_1px_2px_var(--sh03)]'
    )}
  >
    <span
      className={clsx(
        'w-[34px] flex-none text-[10.5px] font-bold tabular-nums',
        item.isEmergency ? 'text-[var(--danger-text)]' : 'text-[var(--ink-faint)]'
      )}
    >
      {item.time}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-bold text-[var(--ink)]">{item.title}</span>
      <span className="block truncate text-[10px] text-[var(--ink-faint)]">{item.subtitle}</span>
    </span>
    <span
      className={clsx(
        'inline-flex flex-none items-center gap-[3px] rounded-full border px-2 py-[2.5px] text-[8.5px] font-bold',
        item.isEmergency ? EMERGENCY_BADGE_CLASSES : STATUS_BADGE_CLASSES[item.status]
      )}
    >
      {item.isEmergency ? <IoWarning size={8} /> : null}
      {item.isEmergency ? 'EMERGENCY' : item.statusLabel}
    </span>
  </div>
);

/**
 * Phone month overview — the month as a dot map plus a day peek.
 *
 * A month grid cannot shrink to a phone and stay a time grid, so each day cell
 * drops its event chips and carries only load dots; the selected day expands
 * underneath into a short peek list. Fully prop-driven: no store reads.
 */
const PhoneMonthOverview = ({
  monthDate,
  appointments,
  today,
  selectedDate,
  view = 'month',
  onViewChange,
  onMonthChange,
  onSelectDay,
  onOpenDay,
  className,
}: Readonly<PhoneMonthOverviewProps>) => {
  const model = useMemo(
    () =>
      buildPhoneMonthModel({
        monthDate,
        appointments,
        today: today ?? new Date(),
        selectedDate,
      }),
    [monthDate, appointments, today, selectedDate]
  );

  const peek = model.peek;
  const navButtonClass =
    'flex size-[26px] cursor-pointer items-center justify-center rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)]';

  return (
    <section
      aria-label="Month overview"
      className={clsx('flex flex-col gap-3 bg-[var(--screen)]', className)}
    >
      <div className="flex justify-end">
        <span className="flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--field-bg)] p-[3px]">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange?.(shiftMonthAnchor(monthDate, -1))}
            className={navButtonClass}
          >
            <IoChevronBackOutline size={12} />
          </button>
          <span className="px-[3px] text-xs font-bold text-[var(--ink)]">{model.monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange?.(shiftMonthAnchor(monthDate, 1))}
            className={navButtonClass}
          >
            <IoChevronForwardOutline size={12} />
          </button>
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-px">
          <h2 className="m-0 font-newsreader text-2xl font-normal tracking-[-0.015em] text-[var(--ink)]">
            {model.monthTitle}
          </h2>
          <span className="text-xs text-[var(--ink-muted)]">{model.summaryLabel}</span>
        </div>
        <SegmentedPill
          options={VIEW_OPTIONS}
          value={view}
          onChange={(next) => onViewChange?.(next)}
          ariaLabel="Calendar view"
        />
      </div>

      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-2.5 pb-2.5 pt-3 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
        <div className="mb-1.5 grid grid-cols-7">
          {WEEKDAY_LABELS.map((label) => (
            <span
              key={label}
              className="text-center text-[9px] font-bold tracking-[0.08em] text-[var(--ink-faint)]"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-[3px]">
          {model.weeks.flatMap((week) =>
            week.cells.map((cell) => (
              <DayCell key={cell.dateKey} cell={cell} onSelectDay={onSelectDay} />
            ))
          )}
        </div>
      </div>

      {peek ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-[var(--ink)]">{peek.label}</span>
            <button
              type="button"
              onClick={() => onOpenDay?.(peek.dateKey)}
              className="flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-[var(--blue-text)]"
            >
              Open day
              <IoArrowForward size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-[7px] overflow-hidden">
            {peek.items.map((item) => (
              <PeekRow key={item.id} item={item} />
            ))}
            {peek.hiddenCount > 0 ? (
              <span className="text-center text-[11px] font-semibold text-[var(--ink-faint)]">
                {`+${peek.hiddenCount} more · swipe up`}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default PhoneMonthOverview;
