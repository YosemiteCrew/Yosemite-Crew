'use client';
import React from 'react';
import type { SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';

const TaskPlannerSkeleton = () => (
  <div className="h-full min-h-125 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const TasksTable = dynamic(() => import('@/app/ui/tables/Tasks'), {
  loading: () => <TaskPlannerSkeleton />,
});
const TaskCalendar = dynamic(
  () => import('@/app/features/appointments/components/Calendar/TaskCalendar'),
  { loading: () => <TaskPlannerSkeleton /> }
);
const TaskBoard = dynamic(() => import('@/app/features/tasks/components/TaskBoard'), {
  loading: () => <TaskPlannerSkeleton />,
});

type TaskPlannerProps = {
  activeView: string;
  filteredList: Task[];
  allTasks: Task[];
  canEditTasks: boolean;
  setActiveTask: React.Dispatch<React.SetStateAction<Task | null>>;
  setViewPopup: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPopup: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPreferredStatus: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
  setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
  activeCalendar: string;
  setActiveCalendar: (next: SetStateAction<string>) => void;
  currentDate: Date;
  setCurrentDate: (next: SetStateAction<Date>) => void;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  onAddTask: () => void;
  onCreateFromCalendarSlot: (prefill: { dueAt: Date; assignedTo?: string }) => void;
  filterOptions: Array<{ key: string; name: string; dotColor?: string }>;
  activeFilter: string;
  setActiveFilter: React.Dispatch<React.SetStateAction<string>>;
  statusOptions: Array<{
    key: string;
    name: string;
    bg?: string;
    text?: string;
    border?: string;
    dropdownText?: string;
  }>;
  activeStatus: string;
  setActiveStatus: React.Dispatch<React.SetStateAction<string>>;
};

/**
 * The planner body for whichever view is active. Split out of the page so each
 * view's wiring reads in one place; the page still owns every piece of state.
 */
const TaskPlanner = ({
  activeView,
  filteredList,
  allTasks,
  canEditTasks,
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
  onAddTask,
  onCreateFromCalendarSlot,
  filterOptions,
  activeFilter,
  setActiveFilter,
  statusOptions,
  activeStatus,
  setActiveStatus,
}: TaskPlannerProps) => {
  if (activeView === 'calendar') {
    // Tasks share the appointments-grade planner: the header switches between the
    // Day, Week and Team grids on tablet/desktop, while TaskCalendar drops to the
    // thumb-checkable PhoneTaskDayList below 768px.
    return (
      <TaskCalendar
        filteredList={filteredList}
        allTasks={allTasks}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setReschedulePopup={setReschedulePopup}
        activeCalendar={activeCalendar}
        setActiveCalendar={setActiveCalendar}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        canEditTasks={canEditTasks}
        onAddTask={onAddTask}
        onCreateFromCalendarSlot={onCreateFromCalendarSlot}
        filterOptions={filterOptions}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        statusOptions={statusOptions}
        activeStatus={activeStatus}
        setActiveStatus={setActiveStatus}
      />
    );
  }

  if (activeView === 'board') {
    return (
      <TaskBoard
        tasks={filteredList}
        canEditTasks={canEditTasks}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        onAddTask={onAddTask}
      />
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <TasksTable
        filteredList={filteredList}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setReschedulePopup={setReschedulePopup}
        canEditTasks={canEditTasks}
      />
    </div>
  );
};

export default TaskPlanner;
