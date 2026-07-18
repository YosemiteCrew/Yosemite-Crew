import { useCallback, useState } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import { logger } from '@/app/lib/logger';
import { clampCalendarMinutes } from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';
import { isSeriesTask, type RecurrenceScope } from '@/app/features/tasks/constants/taskTaxonomy';

type MoveTaskToCalendarSlotParams = {
  allTaskItems: Task[];
  canEditTask: (task: Task) => boolean;
  setDragError: React.Dispatch<React.SetStateAction<string | null>>;
  resolveAssigneeId: (candidateId?: string) => string;
  shouldEnforceAvailability: (task: Task, targetAssigneeId?: string) => boolean;
  isMinuteAvailableForAssignee: (
    date: Date,
    minute: number,
    assigneeId?: string
  ) => Promise<boolean>;
};

type ResolvedTaskMove = { task: Task; nextAssignee: string; snappedMinute: number };

/**
 * A drop on a task in a recurring series, held un-committed while the user picks
 * the scope. Nothing is written to the store until they confirm, so the card stays
 * in the slot it was dragged from and cancelling needs no rollback.
 */
export type PendingSeriesMove = {
  taskId: string;
  taskName: string;
  date: Date;
  minuteOfDay: number;
  targetAssigneeId?: string;
};

// Validate the drop and resolve the target assignee/minute. Returns null (after
// surfacing the reason via setDragError) when the move isn't allowed.
const resolveTaskMove = (
  taskId: string | null,
  minuteOfDay: number,
  targetAssigneeId: string | undefined,
  params: MoveTaskToCalendarSlotParams
): ResolvedTaskMove | null => {
  if (!taskId) return null;
  const task = params.allTaskItems.find((item) => item._id === taskId);
  if (!task) return null;
  if (!params.canEditTask(task)) {
    params.setDragError('Only pending or in-progress tasks can be moved.');
    return null;
  }
  const canReassign = task.audience === 'EMPLOYEE_TASK';
  const nextAssignee = params.resolveAssigneeId(
    (canReassign ? targetAssigneeId : undefined) || task.assignedTo
  );
  if (!nextAssignee) {
    params.setDragError('Task assignee is required.');
    return null;
  }
  return { task, nextAssignee, snappedMinute: clampCalendarMinutes(minuteOfDay) };
};

// Write the move. The availability check lives here rather than at drop time so a
// series move is validated when the user confirms, not against whatever happened
// to be free while the scope prompt sat open.
const commitTaskMove = async (
  date: Date,
  resolved: ResolvedTaskMove,
  params: MoveTaskToCalendarSlotParams,
  scope?: RecurrenceScope
) => {
  const { task, nextAssignee, snappedMinute } = resolved;

  if (params.shouldEnforceAvailability(task, nextAssignee)) {
    const isAvailable = await params.isMinuteAvailableForAssignee(
      date,
      snappedMinute,
      nextAssignee
    );
    if (!isAvailable) {
      params.setDragError('Target assignee is unavailable at the selected time.');
      return;
    }
  }

  try {
    params.setDragError(null);
    await updateTask(
      {
        ...task,
        assignedTo: nextAssignee,
        dueAt: buildDateInPreferredTimeZone(date, snappedMinute),
        timezone: task.timezone || getPreferredTimeZone(),
      },
      scope
    );
  } catch (error) {
    logger.warn('Failed to update task from calendar drop.', error);
    params.setDragError('Unable to update task. Please try again.');
  }
};

type UseTaskCalendarDragStateOptions = {
  allTaskItems: Task[];
  canDragTask: (task: Task) => boolean;
  canEditTask: (task: Task) => boolean;
  ensureAssigneeAvailability: (assigneeId?: string) => Promise<void>;
  isMinuteAvailableForAssignee: (
    date: Date,
    minute: number,
    assigneeId?: string
  ) => Promise<boolean>;
  onDraggedTaskChange?: (taskId: string | null) => void;
  resolveAssigneeId: (candidateId?: string) => string;
  shouldEnforceAvailability: (task: Task, targetAssigneeId?: string) => boolean;
};

export const useTaskCalendarDragState = ({
  allTaskItems,
  canDragTask,
  canEditTask,
  ensureAssigneeAvailability,
  isMinuteAvailableForAssignee,
  onDraggedTaskChange,
  resolveAssigneeId,
  shouldEnforceAvailability,
}: UseTaskCalendarDragStateOptions) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskLabel, setDraggedTaskLabel] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [pendingSeriesMove, setPendingSeriesMove] = useState<PendingSeriesMove | null>(null);
  const [seriesMoveBusy, setSeriesMoveBusy] = useState(false);

  const buildMoveParams = useCallback(
    (): MoveTaskToCalendarSlotParams => ({
      allTaskItems,
      canEditTask,
      setDragError,
      resolveAssigneeId,
      shouldEnforceAvailability,
      isMinuteAvailableForAssignee,
    }),
    [
      allTaskItems,
      canEditTask,
      isMinuteAvailableForAssignee,
      resolveAssigneeId,
      shouldEnforceAvailability,
    ]
  );

  const moveTask = useCallback(
    async (date: Date, minuteOfDay: number, targetAssigneeId?: string) => {
      const params = buildMoveParams();
      const resolved = resolveTaskMove(draggedTaskId, minuteOfDay, targetAssigneeId, params);
      if (!resolved) return;

      // A task in a recurring series asks which occurrences the move applies to,
      // rather than silently rescheduling only this one — matching the Reschedule
      // and TaskInfo paths. Holding the drop here instead of writing it is what
      // keeps the card still while the prompt is open.
      if (isSeriesTask(resolved.task.recurrence)) {
        setDragError(null);
        setPendingSeriesMove({
          taskId: resolved.task._id,
          taskName: resolved.task.name,
          date,
          minuteOfDay,
          targetAssigneeId,
        });
        return;
      }

      await commitTaskMove(date, resolved, params);
    },
    [buildMoveParams, draggedTaskId]
  );

  // Commit the held drop against the scope the user chose.
  const confirmSeriesMove = useCallback(
    async (scope: RecurrenceScope) => {
      if (!pendingSeriesMove) return;
      const params = buildMoveParams();
      // Re-resolve rather than reuse the drop-time result: the drag has ended and
      // the task may have changed while the prompt was open.
      const resolved = resolveTaskMove(
        pendingSeriesMove.taskId,
        pendingSeriesMove.minuteOfDay,
        pendingSeriesMove.targetAssigneeId,
        params
      );
      if (!resolved) {
        setPendingSeriesMove(null);
        return;
      }
      setSeriesMoveBusy(true);
      try {
        await commitTaskMove(pendingSeriesMove.date, resolved, params, scope);
      } finally {
        setSeriesMoveBusy(false);
        // Close on success and failure alike: a failed commit wrote nothing, so the
        // task stays put and the reason shows in the drag-error banner.
        setPendingSeriesMove(null);
      }
    },
    [buildMoveParams, pendingSeriesMove]
  );

  // Cancelling writes nothing, so the task is already where it started — there is
  // no optimistic update to roll back.
  const cancelSeriesMove = useCallback(() => {
    setPendingSeriesMove(null);
  }, []);

  const handleTaskDragStart = useCallback(
    (task: Task) => {
      if (!canDragTask(task)) return;
      setDragError(null);
      setDraggedTaskId(task._id);
      onDraggedTaskChange?.(task._id);
      setDraggedTaskLabel(task.name || 'Task');
      if (shouldEnforceAvailability(task, task.assignedTo)) {
        ensureAssigneeAvailability(task.assignedTo).catch((error: unknown) => {
          logger.warn('Failed to load assignee availability on drag start.', error);
        });
      }
    },
    [canDragTask, ensureAssigneeAvailability, onDraggedTaskChange, shouldEnforceAvailability]
  );

  const handleTaskDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    onDraggedTaskChange?.(null);
    setDraggedTaskLabel(null);
  }, [onDraggedTaskChange]);

  const handleDragHoverTarget = useCallback(
    (_dropDate: Date, assigneeId?: string) => {
      const task = allTaskItems.find((item) => item._id === draggedTaskId);
      if (!task) return;
      if (shouldEnforceAvailability(task, assigneeId || task.assignedTo)) {
        ensureAssigneeAvailability(assigneeId || task.assignedTo).catch((error: unknown) => {
          logger.warn('Failed to refresh assignee availability while dragging.', error);
        });
      }
    },
    [allTaskItems, draggedTaskId, ensureAssigneeAvailability, shouldEnforceAvailability]
  );

  return {
    cancelSeriesMove,
    confirmSeriesMove,
    dragError,
    draggedTaskId,
    draggedTaskLabel,
    handleDragHoverTarget,
    handleTaskDragEnd,
    handleTaskDragStart,
    moveTask,
    pendingSeriesMove,
    seriesMoveBusy,
  };
};

// Build the calendar drop handler that performs the move, logs any failure, and
// ends the drag. Kept out of the render component so it stays a pure factory.
export const createTaskDropHandler =
  (
    moveTask: (date: Date, minute: number, assigneeId?: string) => Promise<void>,
    onDragEnd: () => void
  ) =>
  (dropDate: Date, minute: number, assigneeId?: string) => {
    moveTask(dropDate, minute, assigneeId).catch((error: unknown) => {
      logger.warn('Failed to move task from calendar drop.', error);
    });
    onDragEnd();
  };
