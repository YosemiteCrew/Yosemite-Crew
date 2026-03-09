import React, { useEffect, useMemo, useRef } from 'react';
import {
  getNextWeek,
  getPrevWeek,
  getWeekDays,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  getFirstRelevantTimedEventStart,
  getTopPxForMinutes,
  scrollContainerToTarget,
} from '@/app/features/appointments/components/Calendar/helpers';
import DayLabels from '@/app/features/appointments/components/Calendar/Task/DayLabels';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import {
  CalendarZoomMode,
  formatHourLabel,
  getCalendarColumnGridStyle,
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

type WeekCalendarProps = {
  events: Task[];
  date?: Date;
  zoomMode?: CalendarZoomMode;
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
  zoomMode = 'in',
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
  const nextDayLocal = (dateValue: Date) => {
    const next = new Date(dateValue);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    return next;
  };

  const days = useMemo<Date[]>(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const now = useCalendarNow();
  const height = getHourRowHeightPx(zoomMode);
  const dayColumnsStyle = useMemo(
    () => getCalendarColumnGridStyle(days.length, zoomMode === 'out' ? 108 : 170),
    [days.length, zoomMode]
  );
  const HOUR_ROW_TOP_OFFSET_PX = zoomMode === 'out' ? 0 : 8;
  const fallbackDayKey = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);

  const nowPosition = useMemo(() => {
    const todayIndex = days.findIndex(
      (day) =>
        isOnPreferredTimeZoneCalendarDay(now, day) || fallbackDayKey(day) === fallbackDayKey(now)
    );
    if (todayIndex === -1) return null;

    const topPx = getTopPxForMinutes(
      getMinutesSinceStartOfDayInPreferredTimeZone(now),
      height,
      HOUR_ROW_GAP_PX,
      HOUR_ROW_TOP_OFFSET_PX
    );
    return { topPx, todayIndex };
  }, [days, height, now]);

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
      ? getMinutesSinceStartOfDayInPreferredTimeZone(focusStart)
      : DEFAULT_CALENDAR_FOCUS_MINUTES;
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : getTopPxForMinutes(focusMinutes, height, HOUR_ROW_GAP_PX, HOUR_ROW_TOP_OFFSET_PX);
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
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative rounded-2xl"
        data-calendar-scroll="true"
      >
        <div
          ref={scrollRef}
          className="min-w-max h-full flex flex-col relative"
          style={{
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            overflowY: 'auto',
            paddingBottom: zoomMode === 'out' ? 12 : 0,
          }}
          data-calendar-scroll="true"
        >
          <div className="sticky top-0 z-30 bg-white">
            <div className="grid border-b border-grey-light py-3 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
              <div className="sticky left-0 z-40 bg-white flex items-center justify-center">
                <Back onClick={handlePrevWeek} />
              </div>
              <div className="bg-white">
                <DayLabels
                  days={days}
                  currentDate={_date ?? weekStart}
                  columnsStyle={dayColumnsStyle}
                />
              </div>
              <div className="sticky right-0 z-40 bg-white flex items-center justify-center">
                <Next onClick={handleNextWeek} />
              </div>
            </div>
          </div>

          <div className="relative pt-1 pb-3">
            {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
              <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                <div
                  className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2!"
                  style={{ height: `${height}px`, paddingTop: hour === 0 ? 4 : 0 }}
                >
                  {formatHourLabel(hour)}
                </div>
                <div className="grid min-w-max" style={dayColumnsStyle}>
                  {days.map((day, dayIndex) => {
                    const slotEvents = events.filter((task) => {
                      const dueAt = new Date(task.dueAt);
                      return (
                        isOnPreferredTimeZoneCalendarDay(dueAt, day) &&
                        getHourInPreferredTimeZone(dueAt) === hour
                      );
                    });
                    return (
                      <div
                        key={`${day.getTime()}-${hour}`}
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
            <div style={{ height: zoomMode === 'out' ? 48 : 12 }} />
            {nowPosition && (
              <div className="pointer-events-none absolute inset-0" style={{ top: 0 }}>
                <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div />
                  <div className="grid min-w-max" style={dayColumnsStyle}>
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
