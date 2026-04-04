import React, { useMemo, useRef } from 'react';
import { HOURS_IN_DAY } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { Task } from '@/app/features/tasks/types/task';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useCalendarNavigation, getDateDisplay } from '@/app/hooks/useCalendarNavigation';
import {
  CalendarZoomMode,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import CalendarHourLabel from '@/app/features/appointments/components/Calendar/common/CalendarHourLabel';
import { getHourInPreferredTimeZone, isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import {
  getTimedTaskProxyEvents,
  useCalendarAutoScroll,
  useNowIndicator,
  useSlotOffsetMinutes,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';

const HOUR_ROW_GAP_PX = 0;

type DayCalendarProps = {
  events: Task[];
  date: Date;
  zoomMode?: CalendarZoomMode;
  handleViewTask: (task: Task) => void;
  handleChangeStatusTask?: (task: Task) => void;
  handleRescheduleTask?: (task: Task) => void;
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

const DayCalendar = ({
  events,
  date,
  zoomMode = 'in',
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
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
}: DayCalendarProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const { weekday, dateNumber } = getDateDisplay(date);
  const now = useCalendarNow();
  const height = getHourRowHeightPx(zoomMode);
  const HOUR_ROW_TOP_OFFSET_PX = 8;
  const lastVisibleHour = HOURS_IN_DAY - 1;
  const { slotOffsetMinutes, showSlotTimeLabels } = useSlotOffsetMinutes(slotStepMinutes, zoomMode);
  const { nowPosition, nowTimeLabel } = useNowIndicator(
    date,
    0,
    HOURS_IN_DAY - 1,
    zoomMode,
    now,
    HOUR_ROW_TOP_OFFSET_PX
  );
  const eventsByHour = useMemo(() => {
    const grouped: Task[][] = Array.from({ length: HOURS_IN_DAY }, () => []);
    events.forEach((task) => {
      const dueAt = new Date(task.dueAt);
      if (!isOnPreferredTimeZoneCalendarDay(dueAt, date)) return;
      const hour = getHourInPreferredTimeZone(dueAt);
      if (hour < 0 || hour >= HOURS_IN_DAY) return;
      grouped[hour].push(task);
    });
    return grouped;
  }, [date, events]);

  useCalendarAutoScroll({
    date,
    events: getTimedTaskProxyEvents(events),
    height,
    nowPosition,
    scrollContainer: scrollRef.current,
    hourRowGapPx: HOUR_ROW_GAP_PX,
    hourRowTopOffsetPx: HOUR_ROW_TOP_OFFSET_PX,
  });

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
            const slotEvents = eventsByHour[hour];
            return (
              <div
                key={`task-day-hour-${hour}`}
                className="grid grid-cols-[64px_minmax(0,1fr)] min-w-max"
              >
                <CalendarHourLabel
                  hour={hour}
                  height={height}
                  slotOffsetMinutes={slotOffsetMinutes}
                  showSlotTimeLabels={showSlotTimeLabels}
                  pinFirstHour
                />
                <div className="relative" style={{ height: `${height}px` }}>
                  <TaskSlot
                    slotEvents={slotEvents}
                    handleViewTask={handleViewTask}
                    handleChangeStatusTask={handleChangeStatusTask}
                    handleRescheduleTask={handleRescheduleTask}
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
                    onCreateTaskAt={onCreateTaskAt}
                    onDragHoverTarget={onDragHoverTarget}
                    dropAvailabilityIntervals={getDropAvailabilityIntervals?.(date) ?? []}
                    draggedTaskDurationMinutes={draggedTaskDurationMinutes}
                    showGridLines
                    slotOffsetMinutes={slotOffsetMinutes}
                    isLastVisibleHour={hour === lastVisibleHour}
                    resolveDisplayName={resolveDisplayName}
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
                    {nowTimeLabel && (
                      <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-red-500 whitespace-nowrap">
                        {nowTimeLabel}
                      </div>
                    )}
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
