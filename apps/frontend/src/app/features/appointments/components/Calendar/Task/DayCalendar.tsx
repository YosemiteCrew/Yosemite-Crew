import React, { useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  EVENT_VERTICAL_GAP_PX,
  getFirstRelevantTimedEventStart,
  getTopPxForMinutes,
  isSameDay,
  minutesSinceStartOfDay,
  nextDay,
  scrollContainerToTarget,
  startOfDayDate,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from '@/app/features/appointments/components/Calendar/helpers';
import { HOURS_IN_DAY } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useCalendarNavigation, getDateDisplay } from '@/app/hooks/useCalendarNavigation';

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type DayCalendarProps = {
  events: Task[];
  date: Date;
  handleViewTask: (task: Task) => void;
  onQuickStatusChange?: (task: Task, status: TaskStatus) => void;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks?: boolean;
  draggedTaskId?: string | null;
  draggedTaskLabel?: string | null;
  canDragTask?: (task: Task) => boolean;
  onTaskDragStart?: (task: Task) => void;
  onTaskDragEnd?: () => void;
  onTaskDropAt?: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget?: (date: Date, targetAssigneeId?: string) => void;
  getDropAvailabilityIntervals?: (
    date: Date,
    targetAssigneeId?: string
  ) => DropAvailabilityInterval[];
  draggedTaskDurationMinutes?: number;
};

const DayCalendar = ({
  events,
  date,
  handleViewTask,
  onQuickStatusChange,
  setCurrentDate,
  canEditTasks = false,
  draggedTaskId,
  draggedTaskLabel,
  canDragTask,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDropAt,
  onDragHoverTarget,
  getDropAvailabilityIntervals,
  draggedTaskDurationMinutes,
}: DayCalendarProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const { weekday, dateNumber } = getDateDisplay(date);
  const height = (PIXELS_PER_STEP / MINUTES_PER_STEP) * 60;
  const HOUR_ROW_TOP_OFFSET_PX = 8;

  const nowPosition = useMemo(() => {
    const now = new Date();
    if (!isSameDay(now, date)) return null;
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const topPx = getTopPxForMinutes(
      minutesSinceMidnight,
      height,
      EVENT_VERTICAL_GAP_PX,
      HOUR_ROW_TOP_OFFSET_PX
    );
    return { topPx };
  }, [date, height]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const rangeStart = startOfDayDate(date);
    const rangeEnd = nextDay(date);
    const asTimed = events.map((task) => ({
      startTime: new Date(task.dueAt),
      endTime: new Date(new Date(task.dueAt).getTime() + 30 * 60 * 1000),
    })) as Array<{ startTime: Date; endTime: Date }>;
    const focusStart = getFirstRelevantTimedEventStart(asTimed as any, rangeStart, rangeEnd);
    const focusMinutes = focusStart
      ? minutesSinceStartOfDay(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : getTopPxForMinutes(focusMinutes, height, EVENT_VERTICAL_GAP_PX, HOUR_ROW_TOP_OFFSET_PX);
    scrollContainerToTarget(scrollRef.current, topPx);
  }, [date, events, height, nowPosition]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <Back onClick={handlePrevDay} />
        <div className="flex flex-col items-center text-center">
          <div className="text-body-4 text-text-brand">{weekday}</div>
          <div className="text-body-4-emphasis text-white h-10 w-10 flex items-center justify-center rounded-full bg-text-brand">
            {dateNumber}
          </div>
        </div>
        <Next onClick={handleNextDay} />
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden flex-1 px-2 max-h-[680px]"
        data-calendar-scroll="true"
      >
        {events.length === 0 ? (
          <div className="py-2 text-caption-1 text-text-primary text-center">
            No tasks available for today
          </div>
        ) : null}
        <div className="relative">
          {Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
            const slotEvents = events.filter((task) => {
              const dueAt = new Date(task.dueAt);
              return isSameDay(dueAt, date) && dueAt.getHours() === hour;
            });
            return (
              <div
                key={`task-day-hour-${hour}`}
                className="grid gap-y-0.5 grid-cols-[64px_minmax(0,1fr)] min-w-max"
              >
                <div
                  className="text-caption-2 text-text-primary pl-2!"
                  style={{ height: `${height}px`, opacity: hour === 0 ? 0 : 1 }}
                >
                  {new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="relative pt-2" style={{ height: `${height}px` }}>
                  {hour !== 0 && (
                    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 border-t border-grey-light" />
                  )}
                  <TaskSlot
                    slotEvents={slotEvents}
                    handleViewTask={handleViewTask}
                    onQuickStatusChange={onQuickStatusChange}
                    canEditTasks={canEditTasks}
                    dayIndex={0}
                    length={0}
                    height={height}
                    hour={hour}
                    dropDate={date}
                    draggedTaskId={draggedTaskId}
                    draggedTaskLabel={draggedTaskLabel}
                    canDragTask={canDragTask}
                    onTaskDragStart={onTaskDragStart}
                    onTaskDragEnd={onTaskDragEnd}
                    onTaskDropAt={onTaskDropAt}
                    onDragHoverTarget={onDragHoverTarget}
                    dropAvailabilityIntervals={getDropAvailabilityIntervals?.(date) ?? []}
                    draggedTaskDurationMinutes={draggedTaskDurationMinutes}
                  />
                </div>
              </div>
            );
          })}

          {nowPosition && (
            <div className="pointer-events-none absolute inset-0">
              <div className="grid h-full grid-cols-[64px_minmax(0,1fr)] min-w-max">
                <div />
                <div className="relative">
                  <div
                    className="absolute left-0 right-2 z-20"
                    style={{
                      top: nowPosition.topPx,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    <div className="absolute left-[-5px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
                    <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayCalendar;
