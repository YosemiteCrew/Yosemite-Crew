import { useCallback, useState } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import { logger } from '@/app/lib/logger';
import { clampCalendarMinutes } from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';

type MoveTaskToCalendarSlotParams = {
  allTaskItems: Task[];
  draggedTaskId: string | null;
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

// Validate the drop and resolve the target assignee/minute. Returns null (after
// surfacing the reason via setDragError) when the move isn't allowed.
const resolveTaskMove = (
  minuteOfDay: number,
  targetAssigneeId: string | undefined,
  params: MoveTaskToCalendarSlotParams
): ResolvedTaskMove | null => {
  if (!params.draggedTaskId) return null;
  const task = params.allTaskItems.find((item) => item._id === params.draggedTaskId);
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

const moveTaskToCalendarSlot = async (
  date: Date,
  minuteOfDay: number,
  targetAssigneeId: string | undefined,
  params: MoveTaskToCalendarSlotParams
) => {
  const resolved = resolveTaskMove(minuteOfDay, targetAssigneeId, params);
  if (!resolved) return;
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
    await updateTask({
      ...task,
      assignedTo: nextAssignee,
      dueAt: buildDateInPreferredTimeZone(date, snappedMinute),
      timezone: task.timezone || getPreferredTimeZone(),
    });
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

  const moveTask = useCallback(
    (date: Date, minuteOfDay: number, targetAssigneeId?: string) =>
      moveTaskToCalendarSlot(date, minuteOfDay, targetAssigneeId, {
        allTaskItems,
        draggedTaskId,
        canEditTask,
        setDragError,
        resolveAssigneeId,
        shouldEnforceAvailability,
        isMinuteAvailableForAssignee,
      }),
    [
      allTaskItems,
      canEditTask,
      draggedTaskId,
      isMinuteAvailableForAssignee,
      resolveAssigneeId,
      shouldEnforceAvailability,
    ]
  );

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
    dragError,
    draggedTaskId,
    draggedTaskLabel,
    handleDragHoverTarget,
    handleTaskDragEnd,
    handleTaskDragStart,
    moveTask,
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
