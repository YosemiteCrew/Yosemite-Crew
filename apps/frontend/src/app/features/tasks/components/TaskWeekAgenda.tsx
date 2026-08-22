import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { IoAdd } from 'react-icons/io5';
import {
  getStartOfWeek,
  getWeekDays,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { getTaskCategoryLabel } from '@/app/features/tasks/constants/taskTaxonomy';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useAuthStore } from '@/app/stores/authStore';
import { Task } from '@/app/features/tasks/types/task';
import {
  getAgendaCardStyle,
  getTaskCardVariant,
} from '@/app/features/tasks/components/taskCardVisuals';

/**
 * The week-range navigator that drives `currentDate`/`weekStart` renders in the
 * page title row (TaskWeekNav), per the design; this board only reads the week.
 */
type TaskWeekAgendaProps = {
  filteredList: Task[];
  currentDate: Date;
  weekStart: Date;
  canEditTasks?: boolean;
  setActiveTask?: (task: Task) => void;
  setViewPopup?: (open: boolean) => void;
  onCreateFromCalendarSlot?: (prefill: { dueAt: Date; assignedTo?: string }) => void;
};

/** Default drop time for a task created from an empty day column. */
const DEFAULT_NEW_TASK_HOUR = 9;

type AgendaCardProps = {
  task: Task;
  isFutureDay: boolean;
  assigneeName: string;
  onOpen: (task: Task) => void;
};

const AgendaCard = ({ task, isFutureDay, assigneeName, onOpen }: AgendaCardProps) => {
  const variant = getTaskCardVariant(task, isFutureDay);
  const isParent = variant === 'parent';
  const isCompleted = task.status === 'COMPLETED';
  const style = getAgendaCardStyle(variant);

  const timeLabel = formatDateInPreferredTimeZone(new Date(task.dueAt), {
    hour: 'numeric',
    minute: '2-digit',
  });
  const metaParts = isParent
    ? ['Parent task', assigneeName].filter(Boolean)
    : [getTaskCategoryLabel(task.category) || 'Task', timeLabel, assigneeName].filter(Boolean);

  return (
    <button
      type="button"
      aria-label={`Open task ${task.name || '-'}`}
      onClick={() => onOpen(task)}
      className={clsx(
        // No dim for the muted state. The card stays clickable, and every text
        // descendant is on a faint token: at 0.75 the --ink-faint meta fell to
        // 3.23:1 and the status-token title to 3.86-4.03:1. Completed/cancelled
        // already recede twice - line-through on the title, plus their own
        // --status-* background, border and text family.
        'w-full text-left rounded-[11px] border px-[11px] py-[9px] transition-transform hover:-translate-y-px'
      )}
      style={{
        background: style.background,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      }}
    >
      <span
        className={clsx(
          'flex items-center gap-1.5 text-[11.5px] font-bold leading-4',
          isCompleted && 'line-through'
        )}
        style={{ color: style.textColor }}
      >
        {isParent && (
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: 'var(--pink)' }}
          />
        )}
        <span className="min-w-0 break-words">{task.name || '-'}</span>
      </span>
      <span className="mt-0.5 block text-[10px] leading-4" style={{ color: style.metaColor }}>
        {metaParts.join(' · ')}
      </span>
    </button>
  );
};

const TaskWeekAgenda = ({
  filteredList,
  currentDate,
  weekStart,
  canEditTasks = false,
  setActiveTask,
  setViewPopup,
  onCreateFromCalendarSlot,
}: TaskWeekAgendaProps) => {
  const { resolveMemberName } = useMemberMap();
  const authUserId = useAuthStore((s) => s.attributes?.sub || '');

  // The board is Monday-aligned (MON..SUN) regardless of where the caller's
  // weekStart/currentDate happen to land, matching the design's week header.
  const days = useMemo(() => getWeekDays(getStartOfWeek(currentDate, 1)), [currentDate]);
  const today = useMemo(() => new Date(), []);
  const todayStartMs = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }, [today]);

  const tasksByDay = useMemo(() => {
    const buckets = days.map(() => [] as Task[]);
    filteredList.forEach((task) => {
      const due = new Date(task.dueAt);
      const dayIndex = days.findIndex((day) => isOnPreferredTimeZoneCalendarDay(due, day));
      if (dayIndex === -1) return;
      buckets[dayIndex].push(task);
    });
    return buckets.map((bucket) =>
      [...bucket].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    );
  }, [days, filteredList]);

  const resolveAssignee = useCallback(
    (task: Task): string => {
      const raw = String(task.assignedTo ?? '').trim();
      if (!raw) return '';
      if (authUserId && raw === authUserId) return 'you';
      const resolved = resolveMemberName(raw);
      return resolved && resolved !== '-' ? resolved : '';
    },
    [authUserId, resolveMemberName]
  );

  const openTask = useCallback(
    (task: Task) => {
      setActiveTask?.(task);
      setViewPopup?.(true);
    },
    [setActiveTask, setViewPopup]
  );

  const handleColumnAdd = useCallback(
    (day: Date) => {
      const dueAt = new Date(day);
      dueAt.setHours(DEFAULT_NEW_TASK_HOUR, 0, 0, 0);
      onCreateFromCalendarSlot?.({ dueAt });
    },
    [onCreateFromCalendarSlot]
  );

  const weekStartKey = weekStart.getTime();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <div className="grid grid-cols-7 border-b border-card-border bg-[var(--screen-2)]">
        {days.map((day, index) => {
          const isToday = isOnPreferredTimeZoneCalendarDay(today, day);
          const weekday = formatDateInPreferredTimeZone(day, { weekday: 'short' }).toUpperCase();
          const dayNumber = formatDateInPreferredTimeZone(day, { day: 'numeric' });
          return (
            <span
              key={day.getTime()}
              className={clsx(
                'px-3.5 py-2.5 text-[11px] font-bold tracking-[0.08em]',
                index > 0 && 'border-l border-card-border',
                isToday ? 'text-[var(--blue-text)] bg-[var(--nav-active-bg)]' : 'text-text-tertiary'
              )}
            >
              {weekday}{' '}
              <span className="text-[12px]" style={isToday ? undefined : { color: 'var(--ink)' }}>
                {dayNumber}
                {isToday && ' · today'}
              </span>
            </span>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto scrollbar-hidden">
        {days.map((day, index) => {
          const isFutureDay = day.getTime() > todayStartMs;
          const isTodayColumn = isOnPreferredTimeZoneCalendarDay(today, day);
          const dayTasks = tasksByDay[index] ?? [];
          return (
            <div
              key={`${weekStartKey}-${day.getTime()}`}
              className={clsx(
                'group/col flex flex-col gap-2 px-2 py-2.5',
                index > 0 && 'border-l border-card-border'
              )}
              // The design tints the whole current-day column, not just its header cell.
              style={isTodayColumn ? { backgroundColor: 'var(--surface-soft)' } : undefined}
            >
              {dayTasks.map((task) => (
                <AgendaCard
                  key={task._id}
                  task={task}
                  isFutureDay={isFutureDay}
                  assigneeName={resolveAssignee(task)}
                  onOpen={openTask}
                />
              ))}
              {canEditTasks && (
                <button
                  type="button"
                  aria-label={`Add task on ${formatDateInPreferredTimeZone(day, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}`}
                  onClick={() => handleColumnAdd(day)}
                  className="mt-auto flex items-center justify-center gap-1 rounded-[10px] border border-dashed border-[var(--divider)] py-1.5 text-[11px] font-semibold text-text-tertiary opacity-0 transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover/col:opacity-100"
                >
                  <IoAdd size={13} aria-hidden="true" />
                  Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskWeekAgenda;
