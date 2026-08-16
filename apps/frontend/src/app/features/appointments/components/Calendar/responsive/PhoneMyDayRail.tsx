'use client';

import React from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { IoBedOutline, IoCheckboxOutline, IoCheckmark } from 'react-icons/io5';
import { getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';
import {
  buildAppointmentSubtitle,
  buildAppointmentTitle,
  buildMyDayRail,
  buildMyDaySummaryChips,
  buildRoundHeading,
  buildTaskSubtitle,
  formatRailTime,
  type MyDayAppointmentEntry,
  type MyDayRailEntry,
  type MyDayRound,
  type MyDayRoundEntry,
  type MyDayTaskEntry,
  type MyDayView,
} from '@/app/features/appointments/components/Calendar/responsive/myDayRail';
import type { Appointment } from '@yosemite-crew/types';
import type { Task } from '@/app/features/tasks/types/task';

export type PhoneMyDayRailProps = {
  /** Reference instant — drives "today", the now marker and overdue detection. */
  now: Date;
  /** e.g. "Tue 7 Jul · Dr. Weber" */
  contextLabel: string;
  userInitials: string;
  view: MyDayView;
  appointments: Appointment[];
  tasks: Task[];
  rounds: MyDayRound[];
  /** Resolves a task's companionId to a display name for the "linked to …" line. */
  companionNameById?: Record<string, string>;
  onViewChange?: (view: MyDayView) => void;
  onOpenWorkspace?: (appointment: Appointment) => void;
  onOpenResult?: (appointment: Appointment) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
  onToggleTask?: (task: Task) => void;
  onOpenRound?: (round: MyDayRound) => void;
  onSignRoundItem?: (round: MyDayRound, itemId: string) => void;
  className?: string;
};

const TIME_COLUMN = 'w-[38px] flex-none pt-[9px] text-[10.5px] tabular-nums';

const RailTime = ({ entry }: { entry: MyDayRailEntry }) => {
  // Tasks are marked by their checkbox glyph rather than repeating the due time,
  // which the task card already carries as a trailing pill.
  if (entry.kind === 'task') {
    return (
      <span className={TIME_COLUMN}>
        <IoCheckboxOutline size={13} className="text-[var(--ink-faint)]" aria-hidden="true" />
      </span>
    );
  }
  if (!entry.at) return <span className={TIME_COLUMN} aria-hidden="true" />;
  const isNext = entry.kind === 'appointment' && entry.isNext;
  return (
    <span
      className={clsx(
        TIME_COLUMN,
        isNext ? 'font-extrabold text-[var(--nav-active)]' : 'font-bold text-[var(--ink-faint)]'
      )}
    >
      {formatRailTime(entry.at)}
    </span>
  );
};

const NowMarker = ({ now }: { now: Date }) => (
  <div className="flex items-center gap-[7px]" data-testid="my-day-now-marker">
    <span className="w-[38px] flex-none pr-0.5 text-right">
      <span className="inline-block rounded-full bg-[var(--blue-strong)] px-1.5 py-0.5 text-[8.5px] font-bold tabular-nums text-white">
        {formatRailTime(now)}
      </span>
    </span>
    <span className="h-0.5 flex-1 rounded-full bg-[var(--blue)] shadow-[0_0_6px_var(--glow-b26)]" />
  </div>
);

const CompletedAppointmentCard = ({
  entry,
  onSelect,
}: {
  entry: MyDayAppointmentEntry;
  onSelect?: (appointment: Appointment) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect?.(entry.appointment)}
    className="flex flex-1 items-center gap-[9px] rounded-xl border border-l-[3px] border-[var(--status-completed-border)] bg-[var(--status-completed-bg)] px-[11px] py-[9px] text-left opacity-85"
  >
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[11.5px] font-bold text-[var(--status-completed-text)]">
        {buildAppointmentTitle(entry.appointment)}
      </span>
      <span className="block truncate text-[9.5px] text-[var(--status-completed-text)]">
        {buildAppointmentSubtitle(entry)}
      </span>
    </span>
    <span className="flex size-[18px] flex-none items-center justify-center rounded-full bg-[var(--success)] text-white">
      <IoCheckmark size={11} aria-hidden="true" />
    </span>
  </button>
);

const UpcomingAppointmentCard = ({
  entry,
  onSelect,
}: {
  entry: MyDayAppointmentEntry;
  onSelect?: (appointment: Appointment) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect?.(entry.appointment)}
    className="flex flex-1 items-center gap-[9px] rounded-xl border border-l-[3px] border-[var(--status-upcoming-border)] bg-[var(--status-upcoming-bg)] px-[11px] py-[9px] text-left"
  >
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[11.5px] font-bold text-[var(--status-upcoming-text)]">
        {buildAppointmentTitle(entry.appointment)}
      </span>
      <span className="block truncate text-[9.5px] text-[var(--status-upcoming-text)]">
        {buildAppointmentSubtitle(entry)}
      </span>
    </span>
  </button>
);

const NextAppointmentCard = ({
  entry,
  onOpenWorkspace,
  onOpenResult,
}: {
  entry: MyDayAppointmentEntry;
  onOpenWorkspace?: (appointment: Appointment) => void;
  onOpenResult?: (appointment: Appointment) => void;
}) => {
  const companion = entry.appointment.companion ?? entry.appointment.patient;
  return (
    <div className="flex flex-1 flex-col gap-[7px] rounded-[13px] border-[1.5px] border-[var(--blue)] bg-[var(--screen)] px-3 py-2.5 shadow-[0_0_0_3px_var(--glow-b10)]">
      <span className="flex items-center gap-2">
        <span className="size-[30px] flex-none overflow-hidden rounded-full bg-[var(--avatar-amber-bg)]">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(entry.appointment.companion),
              companion.species.toLowerCase() as ImageType
            )}
            alt={companion.name}
            width={30}
            height={30}
            className="size-full object-cover"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">
            {buildAppointmentTitle(entry.appointment)}
          </span>
          <span className="block truncate text-[10px] text-[var(--ink-faint)]">
            {buildAppointmentSubtitle(entry)}
          </span>
        </span>
      </span>
      <span className="flex gap-[7px]">
        <button
          type="button"
          onClick={() => onOpenWorkspace?.(entry.appointment)}
          className="flex h-[30px] flex-1 items-center justify-center rounded-full bg-[var(--blue-strong)] text-[10.5px] font-bold text-white"
        >
          Open workspace
        </button>
        {onOpenResult && (
          <button
            type="button"
            onClick={() => onOpenResult(entry.appointment)}
            className="flex h-[30px] items-center justify-center rounded-full border border-[var(--divider)] px-3 text-[10.5px] font-bold text-[var(--ink-body)]"
          >
            Result
          </button>
        )}
      </span>
    </div>
  );
};

const AppointmentRow = ({
  entry,
  onOpenWorkspace,
  onOpenResult,
  onSelectAppointment,
}: {
  entry: MyDayAppointmentEntry;
  onOpenWorkspace?: (appointment: Appointment) => void;
  onOpenResult?: (appointment: Appointment) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
}) => {
  if (entry.isNext) {
    return (
      <NextAppointmentCard
        entry={entry}
        onOpenWorkspace={onOpenWorkspace}
        onOpenResult={onOpenResult}
      />
    );
  }
  if (entry.isDone) {
    return <CompletedAppointmentCard entry={entry} onSelect={onSelectAppointment} />;
  }
  return <UpcomingAppointmentCard entry={entry} onSelect={onSelectAppointment} />;
};

const TaskRow = ({
  entry,
  companionName,
  onToggleTask,
}: {
  entry: MyDayTaskEntry;
  companionName?: string;
  onToggleTask?: (task: Task) => void;
}) => (
  <div className="flex flex-1 items-center gap-[9px] rounded-xl border border-[var(--hairline)] bg-[var(--screen)] px-[11px] py-[9px]">
    <button
      type="button"
      aria-pressed={entry.isDone}
      aria-label={`Complete ${entry.task.name}`}
      onClick={() => onToggleTask?.(entry.task)}
      className={clsx(
        'flex size-5 flex-none items-center justify-center rounded-md border-[1.5px] border-[var(--divider)]',
        entry.isDone && 'border-[var(--success)] bg-[var(--success)] text-white'
      )}
    >
      {entry.isDone && <IoCheckmark size={12} aria-hidden="true" />}
    </button>
    <span className="min-w-0 flex-1">
      <span
        className={clsx(
          'block truncate text-[11.5px] font-bold text-[var(--ink)]',
          entry.isDone && 'line-through opacity-60'
        )}
      >
        {entry.task.name}
      </span>
      <span className="block truncate text-[9.5px] text-[var(--ink-faint)]">
        {buildTaskSubtitle(entry.task, companionName)}
      </span>
    </span>
    {entry.at && (
      <span
        className={clsx(
          'inline-flex flex-none rounded-full border px-[7px] py-0.5 text-[8.5px] font-bold tabular-nums',
          entry.isOverdue
            ? 'border-[var(--status-cancelled-border)] bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)]'
            : 'border-[var(--status-upcoming-border)] bg-[var(--status-upcoming-bg)] text-[var(--status-upcoming-text)]'
        )}
      >
        {formatRailTime(entry.at)}
      </span>
    )}
  </div>
);

const RoundRow = ({
  entry,
  onOpenRound,
  onSignRoundItem,
}: {
  entry: MyDayRoundEntry;
  onOpenRound?: (round: MyDayRound) => void;
  onSignRoundItem?: (round: MyDayRound, itemId: string) => void;
}) => (
  <div className="flex-1 overflow-hidden rounded-[13px] border border-[var(--hairline)] bg-[var(--screen)]">
    <div className="flex items-center justify-between px-3 pb-[7px] pt-[9px]">
      <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink)]">
        <IoBedOutline size={13} className="text-[var(--blue-text)]" aria-hidden="true" />
        {buildRoundHeading(entry.round)}
      </span>
      <button
        type="button"
        onClick={() => onOpenRound?.(entry.round)}
        className="text-[10px] font-semibold text-[var(--blue-text)]"
      >
        Open ward
      </button>
    </div>
    {entry.round.items.map((item) => (
      <div
        key={item.id}
        className="flex items-center gap-2 border-t border-[var(--hairline)] px-3 py-2"
      >
        <span className="flex-1 truncate text-[11px] font-semibold text-[var(--ink-body)]">
          {item.label}
        </span>
        {item.status === 'DUE' ? (
          <button
            type="button"
            onClick={() => onSignRoundItem?.(entry.round, item.id)}
            className="rounded-full bg-[var(--cta)] px-2.5 py-1 text-[9.5px] font-bold text-[var(--cta-text)]"
          >
            Sign
          </button>
        ) : (
          <span className="rounded-full border border-[var(--status-completed-border)] bg-[var(--status-completed-bg)] px-2.5 py-1 text-[9.5px] font-bold text-[var(--status-completed-text)]">
            Signed
          </span>
        )}
      </div>
    ))}
  </div>
);

const RailEntryBody = ({
  entry,
  companionNameById,
  onOpenWorkspace,
  onOpenResult,
  onSelectAppointment,
  onToggleTask,
  onOpenRound,
  onSignRoundItem,
}: {
  entry: MyDayRailEntry;
  companionNameById?: Record<string, string>;
  onOpenWorkspace?: (appointment: Appointment) => void;
  onOpenResult?: (appointment: Appointment) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
  onToggleTask?: (task: Task) => void;
  onOpenRound?: (round: MyDayRound) => void;
  onSignRoundItem?: (round: MyDayRound, itemId: string) => void;
}) => {
  if (entry.kind === 'appointment') {
    return (
      <AppointmentRow
        entry={entry}
        onOpenWorkspace={onOpenWorkspace}
        onOpenResult={onOpenResult}
        onSelectAppointment={onSelectAppointment}
      />
    );
  }
  if (entry.kind === 'task') {
    return (
      <TaskRow
        entry={entry}
        companionName={
          entry.task.companionId ? companionNameById?.[entry.task.companionId] : undefined
        }
        onToggleTask={onToggleTask}
      />
    );
  }
  return <RoundRow entry={entry} onOpenRound={onOpenRound} onSignRoundItem={onSignRoundItem} />;
};

const ANYTIME_PILL =
  'flex flex-none items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--pill-raised)] px-[11px] py-[7px] text-[10.5px] font-semibold text-[var(--ink-body)]';

/** The "Anytime today" group is a pill row, not a card stack. */
const AnytimePill = ({
  entry,
  onToggleTask,
  onOpenRound,
}: {
  entry: MyDayTaskEntry | MyDayRoundEntry;
  onToggleTask?: (task: Task) => void;
  onOpenRound?: (round: MyDayRound) => void;
}) => {
  if (entry.kind === 'task') {
    return (
      <button type="button" onClick={() => onToggleTask?.(entry.task)} className={ANYTIME_PILL}>
        <span
          className={clsx(
            'flex size-3.5 items-center justify-center rounded-[5px] border-[1.5px] border-[var(--divider)]',
            entry.isDone && 'border-[var(--success)] bg-[var(--success)] text-white'
          )}
        >
          {entry.isDone && <IoCheckmark size={9} aria-hidden="true" />}
        </span>
        {entry.task.name}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onOpenRound?.(entry.round)} className={ANYTIME_PILL}>
      <IoBedOutline size={13} className="text-[var(--blue-text)]" aria-hidden="true" />
      {buildRoundHeading(entry.round)}
    </button>
  );
};

const VIEW_TOGGLE_OPTIONS: { value: MyDayView; label: string }[] = [
  { value: 'clinic', label: 'Clinic' },
  { value: 'my-day', label: 'My day' },
];

const ViewToggle = ({
  view,
  onViewChange,
}: {
  view: MyDayView;
  onViewChange?: (view: MyDayView) => void;
}) => {
  return (
    <span className="flex rounded-full border border-[var(--hairline)] bg-[var(--band)] p-[3px]">
      {VIEW_TOGGLE_OPTIONS.map((option) => {
        const isActive = option.value === view;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onViewChange?.(option.value)}
            className={clsx(
              'rounded-full px-[11px] py-[5px] text-[11px]',
              isActive
                ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
                : 'font-semibold text-[var(--ink-muted)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
};

const PhoneMyDayRail = ({
  now,
  contextLabel,
  userInitials,
  view,
  appointments,
  tasks,
  rounds,
  companionNameById,
  onViewChange,
  onOpenWorkspace,
  onOpenResult,
  onSelectAppointment,
  onToggleTask,
  onOpenRound,
  onSignRoundItem,
  className,
}: PhoneMyDayRailProps) => {
  const rail = React.useMemo(
    () => buildMyDayRail({ now, appointments, tasks, rounds }),
    [now, appointments, tasks, rounds]
  );
  const chips = React.useMemo(() => buildMyDaySummaryChips(rail.summary), [rail.summary]);

  return (
    <section
      aria-label="My day"
      className={clsx('flex h-full flex-col bg-[var(--screen)] text-[var(--ink-body)]', className)}
    >
      <header className="flex h-[54px] flex-none items-center justify-between border-b border-[var(--hairline)] px-4">
        <span className="flex items-center gap-[9px]">
          <span className="flex size-[30px] items-center justify-center rounded-full bg-[var(--avatar-violet-bg)] text-[11px] font-bold text-[var(--avatar-violet-ink)]">
            {userInitials}
          </span>
          <span>
            <span className="block text-[13px] font-bold leading-[1.15] text-[var(--ink)]">
              My day
            </span>
            <span className="block text-[10px] leading-[1.15] text-[var(--ink-faint)]">
              {contextLabel}
            </span>
          </span>
        </span>
        <ViewToggle view={view} onViewChange={onViewChange} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[9px] overflow-y-auto px-4 py-[13px]">
        <div className="flex gap-[7px]">
          {chips.map((chip) => (
            <span key={chip.key} className="flex-1 rounded-[11px] bg-[var(--inset)] px-2.5 py-2">
              <span className="block text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                {chip.label}
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[var(--ink)]">
                {chip.value}
              </span>
            </span>
          ))}
        </div>

        {rail.dated.length === 0 && rail.anytime.length === 0 && (
          <p className="py-6 text-center text-[11.5px] text-[var(--ink-faint)]">
            Nothing scheduled today.
          </p>
        )}

        {rail.dated.map((entry, index) => (
          <React.Fragment key={entry.id}>
            {rail.nowMarkerIndex === index && <NowMarker now={now} />}
            <div className="flex gap-[9px]">
              <RailTime entry={entry} />
              <RailEntryBody
                entry={entry}
                companionNameById={companionNameById}
                onOpenWorkspace={onOpenWorkspace}
                onOpenResult={onOpenResult}
                onSelectAppointment={onSelectAppointment}
                onToggleTask={onToggleTask}
                onOpenRound={onOpenRound}
                onSignRoundItem={onSignRoundItem}
              />
            </div>
          </React.Fragment>
        ))}
        {rail.anytime.length > 0 && (
          <div className="mt-auto flex flex-col gap-[7px] pb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
              {`Anytime today · ${rail.anytime.length}`}
            </span>
            <div className="flex gap-1.5 overflow-x-auto">
              {rail.anytime.map((entry) => (
                <AnytimePill
                  key={entry.id}
                  entry={entry}
                  onToggleTask={onToggleTask}
                  onOpenRound={onOpenRound}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PhoneMyDayRail;
