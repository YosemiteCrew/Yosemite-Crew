import React, { useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  getFirstRelevantTimedEventStart,
  getTopPxForMinutes,
  nextDay,
  scrollContainerToTarget,
  startOfDayDate,
} from '@/app/features/appointments/components/Calendar/helpers';
import { HOURS_IN_DAY } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useCalendarNavigation, getDateDisplay } from '@/app/hooks/useCalendarNavigation';
import {
  CalendarZoomMode,
  formatHourLabel,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  getHourInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';

const HOUR_ROW_GAP_PX = 0;

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type DayCalendarProps = {
  events: Task[];
  date: Date;
  zoomMode?: CalendarZoomMode;
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
  zoomMode = 'in',
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
  const now = useCalendarNow();
  const height = getHourRowHeightPx(zoomMode);
  const HOUR_ROW_TOP_OFFSET_PX = 8;

  const nowPosition = useMemo(() => {
    if (!isOnPreferredTimeZoneCalendarDay(now, date)) return null;
    const minutesSinceMidnight = getMinutesSinceStartOfDayInPreferredTimeZone(now);
    const topPx = getTopPxForMinutes(
      minutesSinceMidnight,
      height,
      HOUR_ROW_GAP_PX,
      HOUR_ROW_TOP_OFFSET_PX
    );
    return { topPx };
  }, [date, height, now]);

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
      ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : getTopPxForMinutes(focusMinutes, height, HOUR_ROW_GAP_PX, HOUR_ROW_TOP_OFFSET_PX);
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
        className="overflow-x-hidden flex-1 px-2"
        style={{
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
          overflowY: 'auto',
          paddingBottom: zoomMode === 'out' ? 12 : 0,
        }}
        data-calendar-scroll="true"
      >
        <div className="relative pt-1 pb-3">
          {Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
            const slotEvents = events.filter((task) => {
              const dueAt = new Date(task.dueAt);
              return (
                isOnPreferredTimeZoneCalendarDay(dueAt, date) &&
                getHourInPreferredTimeZone(dueAt) === hour
              );
            });
            return (
              <div
                key={`task-day-hour-${hour}`}
                className="grid grid-cols-[64px_minmax(0,1fr)] min-w-max"
              >
                <div
                  className="text-caption-2 text-text-primary pl-2!"
                  style={{ height: `${height}px`, paddingTop: hour === 0 ? 4 : 0 }}
                >
                  {formatHourLabel(hour)}
                </div>
                <div
                  className={`relative ${zoomMode === 'out' ? 'pt-0' : 'pt-2'}`}
                  style={{ height: `${height}px` }}
                >
                  {hour !== 0 && (
                    <div
                      className={`pointer-events-none absolute inset-x-0 z-10 border-t border-grey-light ${
                        zoomMode === 'out' ? 'top-0' : 'top-2'
                      }`}
                    />
                  )}
                  <TaskSlot
                    slotEvents={slotEvents}
                    handleViewTask={handleViewTask}
                    onQuickStatusChange={onQuickStatusChange}
                    canEditTasks={canEditTasks}
                    zoomMode={zoomMode}
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
          <div style={{ height: zoomMode === 'out' ? 48 : 12 }} />

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
