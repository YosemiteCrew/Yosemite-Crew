import React, { memo, useCallback, useMemo, useState } from 'react';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import { TaskCalendarBody } from '@/app/features/appointments/components/Calendar/TaskCalendarBody';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { useNotify } from '@/app/hooks/useNotify';
import { buildDateInPreferredTimeZone, isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';
import { useAppointmentDragAutoScroll } from '@/app/features/appointments/components/Calendar/useAppointmentDragAutoScroll';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getPreferredNextTaskStatus,
} from '@/app/lib/tasks';
import { clampCalendarMinutes } from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';
import { useTaskAvailability } from '@/app/features/appointments/components/Calendar/useTaskAvailability';
import { useTaskCalendarDragState } from '@/app/features/appointments/components/Calendar/useTaskCalendarDragState';
import { useTaskCalendarIdentity } from '@/app/features/appointments/components/Calendar/useTaskCalendarIdentity';

type TaskCalendarProps = {
  filteredList: Task[];
  allTasks?: Task[];
  setActiveTask?: (inventory: Task) => void;
  setViewPopup?: (open: boolean) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
  setReschedulePopup?: (open: boolean) => void;
  activeCalendar: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks?: boolean;
  onCreateFromCalendarSlot?: (prefill: { dueAt: Date; assignedTo?: string }) => void;
};

const handleTaskStatusChangeAction = (
  task: Task,
  notify: ReturnType<typeof useNotify>['notify'],
  setActiveTask?: (inventory: Task) => void,
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>,
  setChangeStatusPopup?: (open: boolean) => void
) => {
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
};

const handleTaskRescheduleAction = (
  task: Task,
  notify: ReturnType<typeof useNotify>['notify'],
  setActiveTask?: (inventory: Task) => void,
  setReschedulePopup?: (open: boolean) => void
) => {
  if (!canRescheduleTask(task.status)) {
    notify('warning', {
      title: 'Reschedule blocked',
      text: 'Completed and cancelled tasks cannot be rescheduled.',
    });
    return;
  }
  setActiveTask?.(task);
  setReschedulePopup?.(true);
};

const TaskCalendar = ({
  filteredList,
  allTasks,
  setActiveTask,
  setViewPopup,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setReschedulePopup,
  activeCalendar,
  setActiveCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  canEditTasks = false,
  onCreateFromCalendarSlot,
}: TaskCalendarProps) => {
  const { notify } = useNotify();
  const allTaskItems = allTasks ?? filteredList;
  const teams = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
  const [draggedTaskIdForAvailability, setDraggedTaskIdForAvailability] = useState<string | null>(
    null
  );

  const {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    shiftDayKey,
    shouldEnforceAvailability,
  } = useTaskCalendarIdentity(teams, authUserId);
  const {
    availabilityVersion,
    ensureAssigneeAvailability,
    getDropAvailabilityIntervals,
    isMinuteAvailableForAssignee,
  } = useTaskAvailability({
    allTaskItems,
    draggedTaskId: draggedTaskIdForAvailability,
    resolveAssigneeId,
    shiftDayKey,
    shouldEnforceAvailability,
  });
  const {
    dragError,
    draggedTaskId,
    draggedTaskLabel,
    handleDragHoverTarget,
    handleTaskDragEnd,
    handleTaskDragStart,
    moveTask,
  } = useTaskCalendarDragState({
    allTaskItems,
    canDragTask: canEditTask,
    canEditTask,
    ensureAssigneeAvailability,
    isMinuteAvailableForAssignee,
    onDraggedTaskChange: setDraggedTaskIdForAvailability,
    resolveAssigneeId,
    shouldEnforceAvailability,
  });

  useAppointmentDragAutoScroll(draggedTaskId, availabilityVersion);

  const handleChangeStatusTask = useCallback(
    (task: Task) =>
      handleTaskStatusChangeAction(
        task,
        notify,
        setActiveTask,
        setChangeStatusPreferredStatus,
        setChangeStatusPopup
      ),
    [notify, setActiveTask, setChangeStatusPopup, setChangeStatusPreferredStatus]
  );

  const handleRescheduleTask = useCallback(
    (task: Task) => handleTaskRescheduleAction(task, notify, setActiveTask, setReschedulePopup),
    [notify, setActiveTask, setReschedulePopup]
  );

  const handleViewTask = useCallback(
    (appointment: Task) => {
      setActiveTask?.(appointment);
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

  return (
    <div className="border border-grey-light rounded-2xl size-full min-h-0 flex flex-col overflow-hidden">
      <Header
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        zoomMode={zoomMode}
        setZoomMode={setZoomMode}
        activeCalendar={activeCalendar}
        setActiveCalendar={setActiveCalendar}
      />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      <TaskCalendarBody
        activeCalendar={activeCalendar}
        dayEvents={dayEvents}
        filteredList={filteredList}
        currentDate={currentDate}
        zoomMode={zoomMode}
        handleViewTask={handleViewTask}
        handleChangeStatusTask={handleChangeStatusTask}
        handleRescheduleTask={handleRescheduleTask}
        setCurrentDate={setCurrentDate}
        canEditTasks={canEditTasks}
        draggedTaskId={draggedTaskId}
        draggedTaskLabel={draggedTaskLabel}
        canDragTask={canEditTask}
        handleTaskDragStart={handleTaskDragStart}
        handleTaskDragEnd={handleTaskDragEnd}
        moveTask={moveTask}
        onCreateTaskAt={handleCreateTaskAt}
        onDragHoverTarget={handleDragHoverTarget}
        getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        resolveDisplayName={resolveDisplayName}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
      />
    </div>
  );
};

export default memo(TaskCalendar);
