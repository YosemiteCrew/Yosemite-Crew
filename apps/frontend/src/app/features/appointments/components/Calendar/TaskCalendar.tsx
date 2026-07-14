import React, { memo, useState } from 'react';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import { TaskCalendarBody } from '@/app/features/appointments/components/Calendar/TaskCalendarBody';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useTaskCalendarDrag } from '@/app/features/appointments/components/Calendar/useTaskCalendarDrag';
import { useTaskCalendarActions } from '@/app/features/appointments/components/Calendar/useTaskCalendarActions';

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
  const allTaskItems = allTasks ?? filteredList;
  const teams = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');

  const {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    getDropAvailabilityIntervals,
    dragError,
    draggedTaskId,
    draggedTaskLabel,
    handleDragHoverTarget,
    handleTaskDragEnd,
    handleTaskDragStart,
    moveTask,
  } = useTaskCalendarDrag({ allTaskItems, teams, authUserId });

  const {
    dayEvents,
    handleChangeStatusTask,
    handleCreateTaskAt,
    handleRescheduleTask,
    handleViewTask,
  } = useTaskCalendarActions({
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
  });

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
