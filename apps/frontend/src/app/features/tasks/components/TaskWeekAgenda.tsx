import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { IoAdd, IoChevronBack, IoChevronForward } from 'react-icons/io5';
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

type TaskWeekAgendaProps = {
  filteredList: Task[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks?: boolean;
  setActiveTask?: (task: Task) => void;
  setViewPopup?: (open: boolean) => void;
  onCreateFromCalendarSlot?: (prefill: { dueAt: Date; assignedTo?: string }) => void;
};

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

/** Default drop time for a task created from an empty day column. */
const DEFAULT_NEW_TASK_HOUR = 9;

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
  const isMuted = isCompleted || task.status === 'CANCELLED';
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
        'w-full text-left rounded-[11px] border px-[11px] py-[9px] transition-transform hover:-translate-y-px',
        isMuted && 'opacity-75'
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
      <span
        className="mt-0.5 block text-[10px] leading-4"
        style={{ color: style.metaColor, opacity: isParent ? 1 : 0.8 }}
      >
        {metaParts.join(' · ')}
      </span>
    </button>
  );
};

const TaskWeekAgenda = ({
  filteredList,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
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
      bucket.toSorted((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
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

  const goToPrevWeek = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, -7));
    setWeekStart((prev) => addDays(prev, -7));
  }, [setCurrentDate, setWeekStart]);

  const goToNextWeek = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, 7));
    setWeekStart((prev) => addDays(prev, 7));
  }, [setCurrentDate, setWeekStart]);

  const weekRangeLabel = useMemo(() => buildWeekRangeLabel(days), [days]);
  const weekStartKey = weekStart.getTime();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-end">
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
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
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
                  isToday
                    ? 'text-[var(--blue-text)] bg-[var(--nav-active-bg)]'
                    : 'text-text-tertiary'
                )}
              >
                {weekday}{' '}
                <span className={clsx('text-[12px]', !isToday && 'text-text-primary')}>
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
            const dayTasks = tasksByDay[index] ?? [];
            return (
              <div
                key={`${weekStartKey}-${day.getTime()}`}
                className={clsx(
                  'group/col flex flex-col gap-2 px-2 py-2.5',
                  index > 0 && 'border-l border-card-border'
                )}
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
    </div>
  );
};

export default TaskWeekAgenda;
