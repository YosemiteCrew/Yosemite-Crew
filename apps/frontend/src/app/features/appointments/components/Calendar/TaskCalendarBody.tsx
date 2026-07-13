import { Dispatch, SetStateAction } from 'react';
import DayCalendar from '@/app/features/appointments/components/Calendar/Task/DayCalendar';
import WeekCalendar from '@/app/features/appointments/components/Calendar/Task/WeekCalendar';
import UserCalendar from '@/app/features/appointments/components/Calendar/Task/UserCalendar';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';
import { createTaskDropHandler } from '@/app/features/appointments/components/Calendar/useTaskCalendarDragState';
import { Task } from '@/app/features/tasks/types/task';

type TaskCalendarBodyProps = {
  activeCalendar: string;
  dayEvents: Task[];
  filteredList: Task[];
  currentDate: Date;
  zoomMode: CalendarZoomMode;
  handleViewTask: (appointment: Task) => void;
  handleChangeStatusTask: (task: Task) => void;
  handleRescheduleTask: (task: Task) => void;
  setCurrentDate: Dispatch<SetStateAction<Date>>;
  canEditTasks: boolean;
  draggedTaskId: string | null;
  draggedTaskLabel: string | null;
  canDragTask: (task: Task) => boolean;
  handleTaskDragStart: (task: Task) => void;
  handleTaskDragEnd: () => void;
  moveTask: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => Promise<void>;
  onCreateTaskAt: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget: (dropDate: Date, assigneeId?: string) => void;
  getDropAvailabilityIntervals: (date: Date, assigneeId?: string) => DropAvailabilityInterval[];
  resolveDisplayName: (memberId?: string) => string;
  weekStart: Date;
  setWeekStart: Dispatch<SetStateAction<Date>>;
};

export const TaskCalendarBody = ({
  activeCalendar,
  dayEvents,
  filteredList,
  currentDate,
  zoomMode,
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
  setCurrentDate,
  canEditTasks,
  draggedTaskId,
  draggedTaskLabel,
  canDragTask,
  handleTaskDragStart,
  handleTaskDragEnd,
  moveTask,
  onCreateTaskAt,
  onDragHoverTarget,
  getDropAvailabilityIntervals,
  resolveDisplayName,
  weekStart,
  setWeekStart,
}: TaskCalendarBodyProps) => {
  const handleDrop = createTaskDropHandler(moveTask, handleTaskDragEnd);

  const commonCalendarProps = {
    zoomMode,
    handleViewTask,
    handleChangeStatusTask,
    handleRescheduleTask,
    canEditTasks,
    draggedTaskId,
    draggedTaskLabel,
    canDragTask,
    onTaskDragStart: handleTaskDragStart,
    onTaskDragEnd: handleTaskDragEnd,
    onCreateTaskAt,
    onDragHoverTarget,
    getDropAvailabilityIntervals,
    resolveDisplayName,
    slotStepMinutes: 15,
  };

  if (activeCalendar === 'day') {
    return (
      <DayCalendar
        {...commonCalendarProps}
        events={dayEvents}
        date={currentDate}
        setCurrentDate={setCurrentDate}
        onTaskDropAt={(dropDate, minute) => handleDrop(dropDate, minute)}
      />
    );
  }

  if (activeCalendar === 'week') {
    return (
      <WeekCalendar
        {...commonCalendarProps}
        events={filteredList}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setCurrentDate={setCurrentDate}
        onTaskDropAt={(dropDate, minute) => handleDrop(dropDate, minute)}
      />
    );
  }

  if (activeCalendar !== 'team') return null;

  return (
    <UserCalendar
      {...commonCalendarProps}
      events={dayEvents}
      date={currentDate}
      setCurrentDate={setCurrentDate}
      onTaskDropAt={handleDrop}
    />
  );
};
