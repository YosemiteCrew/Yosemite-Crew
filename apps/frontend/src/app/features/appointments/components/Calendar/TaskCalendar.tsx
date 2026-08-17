import React, { memo, useCallback, useMemo, useState } from 'react';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import { TaskCalendarBody } from '@/app/features/appointments/components/Calendar/TaskCalendarBody';
import PhoneTaskDayList from '@/app/features/appointments/components/Calendar/PhoneTaskDayList';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useAuthStore } from '@/app/stores/authStore';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import { useNotify } from '@/app/hooks/useNotify';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useTaskCalendarDrag } from '@/app/features/appointments/components/Calendar/useTaskCalendarDrag';
import { useTaskCalendarActions } from '@/app/features/appointments/components/Calendar/useTaskCalendarActions';
import RecurrenceScopeModal from '@/app/features/tasks/components/RecurrenceScopeModal';

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
  filterOptions?: Array<{ key: string; name: string; dotColor?: string }>;
  activeFilter?: string;
  setActiveFilter?: (value: string) => void;
  statusOptions?: Array<{
    key: string;
    name: string;
    bg?: string;
    text?: string;
    border?: string;
    dropdownText?: string;
  }>;
  activeStatus?: string;
  setActiveStatus?: (value: string) => void;
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
  filterOptions,
  activeFilter,
  setActiveFilter,
  statusOptions,
  activeStatus,
  setActiveStatus,
}: TaskCalendarProps) => {
  const allTaskItems = allTasks ?? filteredList;
  const teams = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
  const isPhone = useIsPhone();
  const companions = useCompanionsForPrimaryOrg();
  const { notify } = useNotify();

  const companionNameById = useMemo(
    () => Object.fromEntries(companions.map((companion) => [companion.id, companion.name])),
    [companions]
  );

  const handleToggleTask = useCallback(
    (task: Task) => {
      const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      void changeTaskStatus({ ...task, status: nextStatus }).catch(() => {
        notify('warning', {
          title: 'Task not updated',
          text: 'Unable to update this task. Please try again.',
        });
      });
    },
    [notify]
  );

  const {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    getDropAvailabilityIntervals,
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
  } = useTaskCalendarDrag({ allTaskItems, teams, authUserId });

  // The scope prompt is mounted only while a drop is held, and the only thing it
  // asks for is to close (Cancel, the header X, or the backdrop) — confirming goes
  // through onConfirm instead. So every close request is a cancel.
  const handleSeriesScopeModalClose = useCallback(() => {
    cancelSeriesMove();
  }, [cancelSeriesMove]);

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

  // A task time grid cannot shrink to a phone, so below 768px the planner
  // becomes a thumb-checkable day list. Tablet and desktop keep the real grid.
  if (isPhone) {
    return (
      <div className="border border-card-border rounded-2xl size-full min-h-0 flex flex-col overflow-hidden">
        <PhoneTaskDayList
          tasks={filteredList}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          currentUserId={authUserId}
          resolveDisplayName={resolveDisplayName}
          companionNameById={companionNameById}
          onToggleTask={handleToggleTask}
          onViewTask={handleViewTask}
        />
      </div>
    );
  }

  return (
    <>
      {/* The same lifted card as AppointmentCalendar.tsx:245-251. This painted no
          surface at all, so --page showed through the 64px time gutter and the
          side padding while the slots painted --neutral-0 on top: the Tasks grid
          read as a two-tone unpainted region while Appointments read as a card.
          The phone branch above is left alone - it already matches the phone
          branch on the Appointments side, which is also bordered with no fill. */}
      <div
        className="size-full min-h-0 flex flex-col overflow-hidden rounded-[18px] border"
        style={{
          borderColor: 'var(--hairline)',
          backgroundColor: 'var(--screen)',
          boxShadow: '0 1px 2px var(--sh03), 0 8px 22px var(--sh05)',
        }}
      >
        <Header
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          // Header derives `navigatesByWeek` from `activeCalendar === 'week' &&
          // !!setWeekStart`. Without this prop it stayed false on the Tasks WEEK
          // view, so the toolbar chevrons ran day navigation: the grid rolled
          // forward one day at a time (Mon 17 - Sun 23 became Tue 18 - Mon 24)
          // instead of moving a calendar week, and the buttons were labelled
          // "Previous day" / "Next day" on a week view. Appointments passes it
          // (AppointmentCalendar.tsx:256) and pages Mon 17 -> Mon 24 correctly.
          setWeekStart={setWeekStart}
          zoomMode={zoomMode}
          setZoomMode={setZoomMode}
          activeCalendar={activeCalendar}
          setActiveCalendar={setActiveCalendar}
          filterOptions={filterOptions}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          statusOptions={statusOptions}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
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
      {pendingSeriesMove && (
        <RecurrenceScopeModal
          showModal
          setShowModal={handleSeriesScopeModalClose}
          action="edit"
          taskName={pendingSeriesMove.taskName}
          busy={seriesMoveBusy}
          onConfirm={confirmSeriesMove}
        />
      )}
    </>
  );
};

export default memo(TaskCalendar);
