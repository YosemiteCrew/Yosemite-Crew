import type { Task } from '@/app/features/tasks/types/task';
import type { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';

/**
 * Shared drag/drop and slot-creation props accepted by every task calendar
 * surface (day, user, and week views).
 */
export type TaskCalendarInteractionProps = {
  canEditTasks?: boolean;
  draggedTaskId?: string | null;
  draggedTaskLabel?: string | null;
  canDragTask?: (task: Task) => boolean;
  onTaskDragStart?: (task: Task) => void;
  onTaskDragEnd?: () => void;
  onTaskDropAt?: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onCreateTaskAt?: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget?: (date: Date, targetAssigneeId?: string) => void;
  getDropAvailabilityIntervals?: (
    date: Date,
    targetAssigneeId?: string
  ) => DropAvailabilityInterval[];
  draggedTaskDurationMinutes?: number;
  slotStepMinutes?: number;
  resolveDisplayName?: (memberId?: string) => string;
};
