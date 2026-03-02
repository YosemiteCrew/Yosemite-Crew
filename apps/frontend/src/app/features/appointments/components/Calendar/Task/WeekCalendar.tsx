import React, { useEffect, useMemo, useRef } from 'react';
import {
  getNextWeek,
  getPrevWeek,
  getWeekDays,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  EVENT_VERTICAL_GAP_PX,
  getFirstRelevantTimedEventStart,
  getTopPxForMinutes,
  minutesSinceStartOfDay,
  scrollContainerToTarget,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from '@/app/features/appointments/components/Calendar/helpers';
import DayLabels from '@/app/features/appointments/components/Calendar/Task/DayLabels';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type WeekCalendarProps = {
  events: Task[];
  date?: Date;
  handleViewTask: (task: Task) => void;
  onQuickStatusChange?: (task: Task, status: TaskStatus) => void;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
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

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  date: _date,
  handleViewTask,
  onQuickStatusChange,
  weekStart,
  setWeekStart,
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
}) => {
  const isSameDayLocal = (a?: Date | null, b?: Date | null) =>
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const nextDayLocal = (dateValue: Date) => {
    const next = new Date(dateValue);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    return next;
  };

  const days = useMemo<Date[]>(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const height = (PIXELS_PER_STEP / MINUTES_PER_STEP) * 60;
  const HOUR_ROW_TOP_OFFSET_PX = 8;

  const nowPosition = useMemo(() => {
    const now = new Date();
    const weekStartDay = new Date(weekStart);
    weekStartDay.setHours(0, 0, 0, 0);
    const weekEndDay = new Date(weekStartDay);
    weekEndDay.setDate(weekEndDay.getDate() + 7);
    if (now < weekStartDay || now >= weekEndDay) return null;

    const todayIndex = days.findIndex((day) => isSameDayLocal(day, now));
    if (todayIndex === -1) return null;

    const topPx = getTopPxForMinutes(
      now.getHours() * 60 + now.getMinutes(),
      height,
      EVENT_VERTICAL_GAP_PX,
      HOUR_ROW_TOP_OFFSET_PX
    );
    return { topPx, todayIndex };
  }, [days, height, weekStart]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const rangeStart = new Date(days[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const lastDay = days.at(-1);
    if (!lastDay) return;
    const rangeEnd = nextDayLocal(lastDay);
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
  }, [days, events, height, nowPosition]);

  const handlePrevWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getPrevWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getNextWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto relative rounded-2xl max-w-[calc(100vw-32px)] sm:max-w-[calc(100vw-96px)] lg:max-w-[calc(100vw-300px)]"
        data-calendar-scroll="true"
      >
        <div
          ref={scrollRef}
          className="max-h-[680px] overflow-y-auto min-w-max"
          data-calendar-scroll="true"
        >
          <div className="sticky top-0 z-30 bg-white">
            <div className="grid border-b border-grey-light py-3 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
              <div className="sticky left-0 z-40 bg-white flex items-center justify-center">
                <Back onClick={handlePrevWeek} />
              </div>
              <div className="bg-white">
                <DayLabels days={days} currentDate={_date ?? weekStart} />
              </div>
              <div className="sticky right-0 z-40 bg-white flex items-center justify-center">
                <Next onClick={handleNextWeek} />
              </div>
            </div>
          </div>

          <div className="relative">
            {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
              <div
                key={hour}
                className="grid gap-y-0.5 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max"
              >
                <div
                  className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2!"
                  style={{ height: `${height}px`, opacity: hour === 0 ? 0 : 1 }}
                >
                  {new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="grid grid-flow-col auto-cols-[170px] min-w-max">
                  {days.map((day, dayIndex) => {
                    const slotEvents = events.filter((task) => {
                      const dueAt = new Date(task.dueAt);
                      return isSameDayLocal(dueAt, day) && dueAt.getHours() === hour;
                    });
                    return (
                      <div
                        key={`${day.getTime()}-${hour}`}
                        className="relative pt-2"
                        style={{ height: `${height}px` }}
                      >
                        {hour !== 0 && (
                          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 border-t border-grey-light" />
                        )}
                        <TaskSlot
                          slotEvents={slotEvents}
                          handleViewTask={handleViewTask}
                          onQuickStatusChange={onQuickStatusChange}
                          canEditTasks={canEditTasks}
                          dayIndex={dayIndex}
                          length={days.length - 1}
                          height={height}
                          hour={hour}
                          dropDate={day}
                          draggedTaskId={draggedTaskId}
                          draggedTaskLabel={draggedTaskLabel}
                          canDragTask={canDragTask}
                          onTaskDragStart={onTaskDragStart}
                          onTaskDragEnd={onTaskDragEnd}
                          onTaskDropAt={onTaskDropAt}
                          onDragHoverTarget={onDragHoverTarget}
                          dropAvailabilityIntervals={getDropAvailabilityIntervals?.(day) ?? []}
                          draggedTaskDurationMinutes={draggedTaskDurationMinutes}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="sticky right-0 z-20 bg-white" style={{ height: `${height}px` }} />
              </div>
            ))}

            {nowPosition && (
              <div className="pointer-events-none absolute inset-0">
                <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div />
                  <div className="grid grid-flow-col auto-cols-[170px] min-w-max">
                    {days.map((day, idx) => (
                      <div key={`now-line-${day.toISOString()}`} className="relative">
                        {idx === nowPosition.todayIndex && (
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
                        )}
                      </div>
                    ))}
                  </div>
                  <div />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;
