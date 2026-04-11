import React, { useMemo, useRef } from 'react';
import {
  getWeekDays,
  HOURS_IN_DAY,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { getNowTopPxForHourRange } from '@/app/features/appointments/components/Calendar/helpers';
import DayLabels from '@/app/features/appointments/components/Calendar/Task/DayLabels';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { Task } from '@/app/features/tasks/types/task';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import {
  CalendarZoomMode,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import CalendarHourLabel from '@/app/features/appointments/components/Calendar/common/CalendarHourLabel';
import {
  formatDateInPreferredTimeZone,
  getHourInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import SlotGridLines from '@/app/features/appointments/components/Calendar/common/SlotGridLines';
import {
  getTimedTaskProxyEvents,
  useCalendarAutoScroll,
  useCalendarWeekNavigation,
  useSlotOffsetMinutes,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';

const HOUR_ROW_GAP_PX = 0;

type WeekCalendarProps = {
  events: Task[];
  date?: Date;
  zoomMode?: CalendarZoomMode;
  handleViewTask: (task: Task) => void;
  handleChangeStatusTask?: (task: Task) => void;
  handleRescheduleTask?: (task: Task) => void;
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
  onCreateTaskAt?: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget?: (date: Date, targetAssigneeId?: string) => void;
  getDropAvailabilityIntervals?: (
    date: Date,
    targetAssigneeId?: string
  ) => DropAvailabilityInterval[];
  draggedTaskDurationMinutes?: number;
  slotStepMinutes?: number;
  resolveDisplayName?: (memberId?: string) => string;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  date: _date,
  zoomMode = 'in',
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
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
  onCreateTaskAt,
  onDragHoverTarget,
  getDropAvailabilityIntervals,
  draggedTaskDurationMinutes,
  slotStepMinutes = 15,
  resolveDisplayName,
}) => {
  const days = useMemo<Date[]>(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const now = useCalendarNow();
  const height = getHourRowHeightPx(zoomMode);
  const dayColumnsStyle = useMemo(
    () => getCalendarColumnGridStyle(days.length, zoomMode === 'out' ? 108 : 170),
    [days.length, zoomMode]
  );
  const HOUR_ROW_TOP_OFFSET_PX = 0;
  const { slotOffsetMinutes, showSlotTimeLabels } = useSlotOffsetMinutes(slotStepMinutes, zoomMode);
  const lastVisibleHour = HOURS_IN_DAY - 1;
  const nowPosition = useMemo(() => {
    const todayIndex = days.findIndex((day) => isOnPreferredTimeZoneCalendarDay(now, day));
    if (todayIndex === -1) return null;

    const topPx = getNowTopPxForHourRange(
      days[todayIndex],
      0,
      HOURS_IN_DAY - 1,
      height,
      now,
      HOUR_ROW_TOP_OFFSET_PX
    );
    if (topPx == null) return null;
    return { topPx, todayIndex };
  }, [days, height, now, HOUR_ROW_TOP_OFFSET_PX]);
  const nowTimeLabel = useMemo(
    () =>
      nowPosition
        ? formatDateInPreferredTimeZone(now, { hour: 'numeric', minute: '2-digit' })
        : null,
    [now, nowPosition]
  );
  const eventsByDayHour = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    events.forEach((task) => {
      const dueAt = new Date(task.dueAt);
      const dayIndex = days.findIndex((day) => isOnPreferredTimeZoneCalendarDay(dueAt, day));
      if (dayIndex === -1) return;
      const hour = getHourInPreferredTimeZone(dueAt);
      if (hour < 0 || hour >= HOURS_IN_DAY) return;
      const key = `${dayIndex}-${hour}`;
      const list = grouped.get(key);
      if (list) list.push(task);
      else grouped.set(key, [task]);
    });
    return grouped;
  }, [days, events]);

  useCalendarAutoScroll({
    date: days[0] ?? weekStart,
    events: getTimedTaskProxyEvents(events),
    height,
    nowPosition,
    scrollContainer: scrollRef.current,
    skip: !!draggedTaskId || !days.length,
    rangeStart: days[0],
    rangeEnd: days.at(-1)
      ? new Date(new Date(days.at(-1) as Date).setHours(24, 0, 0, 0))
      : undefined,
    hourRowGapPx: HOUR_ROW_GAP_PX,
    hourRowTopOffsetPx: HOUR_ROW_TOP_OFFSET_PX,
  });

  const { handlePrevWeek, handleNextWeek } = useCalendarWeekNavigation(
    setWeekStart,
    setCurrentDate
  );

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative rounded-2xl"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col relative">
          <div className="z-30 bg-white">
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

          <div
            ref={scrollRef}
            className="min-w-max flex-1 min-h-0"
            style={{
              height: '100%',
              maxHeight: '100%',
              minHeight: 0,
              overflowY: 'auto',
              paddingBottom: zoomMode === 'out' ? 30 : 40,
            }}
            data-calendar-scroll="true"
          >
            <div className="relative pb-4">
              {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <CalendarHourLabel
                    hour={hour}
                    height={height}
                    slotOffsetMinutes={slotOffsetMinutes}
                    showSlotTimeLabels={showSlotTimeLabels}
                    pinFirstHour
                    className="sticky left-0 z-20 bg-white"
                  />
                  <div className="grid min-w-max" style={dayColumnsStyle}>
                    {days.map((day, dayIndex) => {
                      const slotEvents = eventsByDayHour.get(`${dayIndex}-${hour}`) ?? [];
                      return (
                        <div
                          key={`${day.getTime()}-${hour}`}
                          className="relative"
                          style={{ height: `${height}px` }}
                        >
                          <TaskSlot
                            slotEvents={slotEvents}
                            handleViewTask={handleViewTask}
                            handleChangeStatusTask={handleChangeStatusTask}
                            handleRescheduleTask={handleRescheduleTask}
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
                            onCreateTaskAt={onCreateTaskAt}
                            onDragHoverTarget={onDragHoverTarget}
                            dropAvailabilityIntervals={getDropAvailabilityIntervals?.(day) ?? []}
                            draggedTaskDurationMinutes={draggedTaskDurationMinutes}
                            resolveDisplayName={resolveDisplayName}
                          />
                          <SlotGridLines
                            userId={String(day.getTime())}
                            hour={hour}
                            lastVisibleHour={lastVisibleHour}
                            slotOffsetMinutes={slotOffsetMinutes}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-20 bg-white" style={{ height: `${height}px` }} />
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />
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
                              }}
                            >
                              {nowTimeLabel && (
                                <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-red-500 whitespace-nowrap">
                                  {nowTimeLabel}
                                </div>
                              )}
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
    </div>
  );
};

export default WeekCalendar;
