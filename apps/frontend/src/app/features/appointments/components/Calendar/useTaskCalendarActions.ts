import React, { useCallback, useMemo } from 'react';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useNotify } from '@/app/hooks/useNotify';
import { buildDateInPreferredTimeZone, isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getPreferredNextTaskStatus,
} from '@/app/lib/tasks';
import { clampCalendarMinutes } from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';

type UseTaskCalendarActionsOptions = {
  filteredList: Task[];
  currentDate: Date;
  canEditTasks: boolean;
  resolveAssigneeId: (candidateId?: string) => string;
  setActiveTask?: (task: Task) => void;
  setViewPopup?: (open: boolean) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
  setReschedulePopup?: (open: boolean) => void;
  onCreateFromCalendarSlot?: (prefill: { dueAt: Date; assignedTo?: string }) => void;
};

// The user-facing task actions (view, status change, reschedule, create) and the
// day-scoped event list. Extracted so the TaskCalendar container stays focused on
// composing hooks and rendering.
export const useTaskCalendarActions = ({
  filteredList,
  currentDate,
  canEditTasks,
  resolveAssigneeId,
  setActiveTask,
  setViewPopup,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setReschedulePopup,
  onCreateFromCalendarSlot,
}: UseTaskCalendarActionsOptions) => {
  const { notify } = useNotify();

  const handleChangeStatusTask = useCallback(
    (task: Task) => {
      if (!canShowTaskStatusChangeAction(task.status)) {
        notify('warning', {
          title: 'Status change blocked',
          text: 'No status changes are available for this task.',
        });
        return;
      }
      setActiveTask?.(task);
      setChangeStatusPreferredStatus?.(getPreferredNextTaskStatus(task.status));
      setChangeStatusPopup?.(true);
    },
    [notify, setActiveTask, setChangeStatusPopup, setChangeStatusPreferredStatus]
  );

  const handleRescheduleTask = useCallback(
    (task: Task) => {
      if (!canRescheduleTask(task.status)) {
        notify('warning', {
          title: 'Reschedule blocked',
          text: 'Completed and cancelled tasks cannot be rescheduled.',
        });
        return;
      }
      setActiveTask?.(task);
      setReschedulePopup?.(true);
    },
    [notify, setActiveTask, setReschedulePopup]
  );

  const handleViewTask = useCallback(
    (task: Task) => {
      setActiveTask?.(task);
      setViewPopup?.(true);
    },
    [setActiveTask, setViewPopup]
  );

  const handleCreateTaskAt = useCallback(
    (date: Date, minuteOfDay: number, targetAssigneeId?: string) => {
      if (!canEditTasks || !onCreateFromCalendarSlot) return;
      const dueAt = buildDateInPreferredTimeZone(date, clampCalendarMinutes(minuteOfDay));
      const assignedTo = targetAssigneeId ? resolveAssigneeId(targetAssigneeId) : undefined;
      onCreateFromCalendarSlot({ dueAt, assignedTo: assignedTo || undefined });
    },
    [canEditTasks, onCreateFromCalendarSlot, resolveAssigneeId]
  );

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isOnPreferredTimeZoneCalendarDay(new Date(event.dueAt), currentDate)
      ),
    [filteredList, currentDate]
  );

  return {
    dayEvents,
    handleChangeStatusTask,
    handleCreateTaskAt,
    handleRescheduleTask,
    handleViewTask,
  };
};
