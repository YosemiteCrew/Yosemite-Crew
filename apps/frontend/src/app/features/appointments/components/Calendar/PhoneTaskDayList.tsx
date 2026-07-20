'use client';

import React, { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { IoCheckmark, IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';

import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import {
  buildGroupHeading,
  buildTaskDayList,
  buildTaskDaySubtitle,
  type TaskDayEntry,
  type TaskDayGroup,
} from '@/app/features/appointments/components/Calendar/taskDayList';
import type { Task, TaskStatus } from '@/app/features/tasks/types/task';

/**
 * The board filter is phone-local. `audience` already splits employee from
 * parent tasks, and `assignedTo` narrows to the signed-in user — so all three
 * segments are backed by real fields and nothing is pushed back up to the page.
 */
export type TaskBoardScope = 'mine' | 'everyone' | 'parents';

const SCOPE_OPTIONS: ReadonlyArray<SegmentedPillOption<TaskBoardScope>> = [
  { value: 'mine', label: 'My board' },
  { value: 'everyone', label: 'Everyone' },
  { value: 'parents', label: 'Parents' },
];

const STATUS_BADGE_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
};

const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  PENDING:
    'border-[var(--status-requested-border)] bg-[var(--status-requested-bg)] text-[var(--status-requested-text)]',
  IN_PROGRESS:
    'border-[var(--status-in-progress-border)] bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress-text)]',
  COMPLETED:
    'border-[var(--status-completed-border)] bg-[var(--status-completed-bg)] text-[var(--status-completed-text)]',
  CANCELLED:
    'border-[var(--status-cancelled-border)] bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)]',
};

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const matchesScope = (task: Task, scope: TaskBoardScope, currentUserId: string): boolean => {
  if (scope === 'parents') return task.audience === 'PARENT_TASK';
  if (scope === 'everyone') return task.audience !== 'PARENT_TASK';
  return task.audience !== 'PARENT_TASK' && !!currentUserId && task.assignedTo === currentUserId;
};

const TaskCheckbox = ({
  entry,
  disabled,
  onToggle,
}: {
  entry: TaskDayEntry;
  disabled: boolean;
  onToggle?: (task: Task) => void;
}) => (
  <button
    type="button"
    aria-pressed={entry.isDone}
    aria-label={`Complete ${entry.task.name}`}
    disabled={disabled}
    onClick={() => onToggle?.(entry.task)}
    // 22px box inside a 44px tap target — the design's checkbox, the platform's
    // minimum touch size.
    className="-m-[11px] flex size-11 flex-none items-center justify-center p-[11px] disabled:cursor-not-allowed disabled:opacity-60"
  >
    <span
      className={clsx(
        'flex size-[22px] items-center justify-center rounded-md border-[1.5px] border-[var(--divider)]',
        entry.isDone && 'border-[var(--blue)] bg-[var(--blue)] text-white'
      )}
    >
      {entry.isDone && <IoCheckmark size={14} aria-hidden="true" />}
    </span>
  </button>
);

const TaskCard = ({
  entry,
  assigneeName,
  companionName,
  canEditTasks,
  onToggleTask,
  onViewTask,
}: {
  entry: TaskDayEntry;
  assigneeName?: string;
  companionName?: string;
  canEditTasks: boolean;
  onToggleTask?: (task: Task) => void;
  onViewTask?: (task: Task) => void;
}) => (
  <div
    data-testid={`phone-task-${entry.id}`}
    className={clsx(
      'flex min-h-14 items-center gap-2.5 rounded-xl border bg-[var(--screen)] px-[11px] py-2.5',
      entry.isOverdue
        ? 'border-[var(--danger-border)] border-l-[3px] border-l-[var(--danger)]'
        : 'border-[var(--hairline)]',
      entry.isDone && 'opacity-[.66]'
    )}
  >
    <TaskCheckbox entry={entry} disabled={!canEditTasks} onToggle={onToggleTask} />
    <button
      type="button"
      onClick={() => onViewTask?.(entry.task)}
      className="min-w-0 flex-1 text-left"
    >
      <span
        className={clsx(
          'block truncate text-[13px] font-bold text-[var(--ink)]',
          entry.isDone && 'line-through'
        )}
      >
        {entry.task.name}
      </span>
      <span
        className={clsx(
          'block truncate text-[11px]',
          entry.isOverdue ? 'text-[var(--danger-text)]' : 'text-[var(--ink-faint)]'
        )}
      >
        {buildTaskDaySubtitle(entry, assigneeName)}
      </span>
    </button>
    {companionName && (
      <span
        title={companionName}
        className="flex size-[26px] flex-none items-center justify-center rounded-full bg-[var(--avatar-amber-bg)] text-[9.5px] font-bold text-[var(--ink-body)]"
      >
        {getInitials(companionName)}
      </span>
    )}
    <span
      className={clsx(
        'inline-flex flex-none rounded-full border px-[7px] py-0.5 text-[9px] font-bold',
        STATUS_BADGE_CLASSES[entry.status]
      )}
    >
      {STATUS_BADGE_LABELS[entry.status]}
    </span>
  </div>
);

const TaskGroup = ({
  group,
  resolveAssigneeName,
  companionNameById,
  canEditTasks,
  onToggleTask,
  onViewTask,
}: {
  group: TaskDayGroup;
  resolveAssigneeName: (task: Task) => string | undefined;
  companionNameById: Record<string, string>;
  canEditTasks: boolean;
  onToggleTask?: (task: Task) => void;
  onViewTask?: (task: Task) => void;
}) => (
  <section className="flex flex-col gap-1.5" aria-label={group.label}>
    <h3
      className={clsx(
        'm-0 text-[10px] font-bold uppercase tracking-[0.08em]',
        group.id === 'overdue' ? 'text-[var(--danger-text)]' : 'text-[var(--ink-faint)]'
      )}
    >
      {buildGroupHeading(group)}
    </h3>
    {group.entries.map((entry) => (
      <TaskCard
        key={entry.id}
        entry={entry}
        assigneeName={resolveAssigneeName(entry.task)}
        companionName={
          entry.task.companionId ? companionNameById[entry.task.companionId] : undefined
        }
        canEditTasks={canEditTasks}
        onToggleTask={onToggleTask}
        onViewTask={onViewTask}
      />
    ))}
  </section>
);

export type PhoneTaskDayListProps = {
  /** Tasks already filtered by the page's search/status/audience filters. */
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks: boolean;
  /** Signed-in user's id — drives the "My board" segment and the "you" subtitle. */
  currentUserId: string;
  resolveDisplayName: (memberId?: string) => string;
  companionNameById?: Record<string, string>;
  onToggleTask?: (task: Task) => void;
  onViewTask?: (task: Task) => void;
  /** Injectable for deterministic tests. Defaults to now. */
  now?: Date;
};

/**
 * Phone rendering of the tasks planner (< 768px only).
 *
 * The task time grid does not shrink, so on a phone it becomes a day list you
 * can check off with a thumb: Overdue / Today / Later this week, each row a
 * 22px checkbox wired to the real task status flow. Tablet and desktop keep the
 * real grid untouched.
 */
const PhoneTaskDayList = ({
  tasks,
  currentDate,
  setCurrentDate,
  canEditTasks,
  currentUserId,
  resolveDisplayName,
  companionNameById,
  onToggleTask,
  onViewTask,
  now,
}: PhoneTaskDayListProps) => {
  const [scope, setScope] = useState<TaskBoardScope>('everyone');
  const referenceNow = useMemo(() => now ?? new Date(), [now]);

  const scopedTasks = useMemo(
    () => tasks.filter((task) => matchesScope(task, scope, currentUserId)),
    [tasks, scope, currentUserId]
  );

  const list = useMemo(
    () => buildTaskDayList({ tasks: scopedTasks, now: referenceNow, anchor: currentDate }),
    [scopedTasks, referenceNow, currentDate]
  );

  const resolveAssigneeName = useCallback(
    (task: Task): string | undefined => {
      if (currentUserId && task.assignedTo === currentUserId) return 'you';
      return resolveDisplayName(task.assignedTo) || undefined;
    },
    [currentUserId, resolveDisplayName]
  );

  const stepDay = useCallback(
    (days: number) => setCurrentDate((prev) => addDays(prev, days)),
    [setCurrentDate]
  );

  return (
    <section
      aria-label="Tasks"
      className="flex h-full min-h-0 flex-col bg-[var(--screen)] text-[var(--ink-body)]"
    >
      <header className="flex h-[54px] flex-none items-center justify-between gap-2.5 border-b border-[var(--hairline)] px-3.5">
        <h2 className="m-0 font-satoshi text-[15px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          Tasks{' '}
          <span className="font-medium text-[var(--ink-faint)]">{`(${list.totalCount})`}</span>
        </h2>
        <span className="flex flex-none items-center gap-1">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => stepDay(-1)}
            className="flex size-11 items-center justify-center text-[var(--ink-muted)]"
          >
            <IoChevronBackOutline size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(referenceNow)}
            className="rounded-full border border-[var(--hairline)] bg-[var(--band)] px-3 py-[5px] text-[11.5px] font-bold text-[var(--ink)]"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => stepDay(1)}
            className="flex size-11 items-center justify-center text-[var(--ink-muted)]"
          >
            <IoChevronForwardOutline size={15} aria-hidden="true" />
          </button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <div className="flex flex-none justify-start">
          <SegmentedPill
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={setScope}
            ariaLabel="Task board scope"
          />
        </div>

        {list.groups.length === 0 ? (
          <p className="py-8 text-center text-[11.5px] text-[var(--ink-faint)]">
            No tasks due in this window.
          </p>
        ) : (
          list.groups.map((group) => (
            <TaskGroup
              key={group.id}
              group={group}
              resolveAssigneeName={resolveAssigneeName}
              companionNameById={companionNameById ?? {}}
              canEditTasks={canEditTasks}
              onToggleTask={onToggleTask}
              onViewTask={onViewTask}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default PhoneTaskDayList;
