import React, { useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  getFirstRelevantTimedEventStart,
  getNowTopPxForHourRange,
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
  slotStepMinutes?: number;
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
  slotStepMinutes = 15,
}: DayCalendarProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const { weekday, dateNumber } = getDateDisplay(date);
  const now = useCalendarNow();
  const height = getHourRowHeightPx(zoomMode);
  const HOUR_ROW_TOP_OFFSET_PX = 8;
  const lastVisibleHour = HOURS_IN_DAY - 1;
  const slotOffsetMinutes = useMemo(() => {
    const step = Math.max(5, Math.round(slotStepMinutes || 15));
    if (step >= 60) return [];
    const offsets: number[] = [];
    for (let minute = step; minute < 60; minute += step) {
      offsets.push(minute);
    }
    return offsets;
  }, [slotStepMinutes]);

  const nowPosition = useMemo(() => {
    const topPx = getNowTopPxForHourRange(
      date,
      0,
      HOURS_IN_DAY - 1,
      height,
      now,
      HOUR_ROW_TOP_OFFSET_PX
    );
    if (topPx == null) return null;
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
        <div className="flex items-center gap-2 text-center">
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
          paddingBottom: zoomMode === 'out' ? 30 : 40,
          paddingTop: 12,
        }}
        data-calendar-scroll="true"
      >
        <div className="relative pt-2 pb-4">
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
                <div className="relative" style={{ height: `${height}px` }}>
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
                    showGridLines
                    slotOffsetMinutes={slotOffsetMinutes}
                    isLastVisibleHour={hour === lastVisibleHour}
                  />
                </div>
              </div>
            );
          })}
          <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />

          {nowPosition && (
            <div className="pointer-events-none absolute inset-0">
              <div className="grid h-full grid-cols-[64px_minmax(0,1fr)] min-w-max">
                <div />
                <div className="relative">
                  <div
                    className="absolute left-0 right-2 z-20"
                    style={{
                      top: nowPosition.topPx,
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
