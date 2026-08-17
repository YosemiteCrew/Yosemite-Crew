import React, { useMemo, useState } from 'react';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
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
import type { TaskCalendarInteractionProps } from '@/app/features/appointments/components/Calendar/Task/taskCalendarInteractionProps';

const HOUR_ROW_GAP_PX = 0;

type DayCalendarProps = {
  events: Task[];
  date: Date;
  zoomMode?: CalendarZoomMode;
  handleViewTask: (task: Task) => void;
  handleChangeStatusTask?: (task: Task) => void;
  handleRescheduleTask?: (task: Task) => void;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
} & TaskCalendarInteractionProps;

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
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const onWheelBoundary = useScrollBoundaryWheel();
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
    scrollContainer,
    hourRowGapPx: HOUR_ROW_GAP_PX,
    hourRowTopOffsetPx: HOUR_ROW_TOP_OFFSET_PX,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-card-border">
        <Back onClick={handlePrevDay} />
        <div className="flex items-center gap-2 text-center">
          <div className="text-body-4 text-[var(--blue-text)]">{weekday}</div>
          <div className="text-body-4-emphasis text-white size-10 flex items-center justify-center rounded-full bg-[var(--blue-strong)]">
            {dateNumber}
          </div>
        </div>
        <Next onClick={handleNextDay} />
      </div>

      <div
        ref={setScrollContainer}
        className="overflow-x-hidden flex-1 px-2"
        style={{
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
          overflowY: 'auto',
          paddingBottom: zoomMode === 'out' ? 30 : 40,
          paddingTop: 12,
        }}
        onWheel={onWheelBoundary}
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
                    permissions={{ canEditTasks }}
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
                    layout={{
                      showGridLines: true,
                      slotOffsetMinutes,
                      isLastVisibleHour: hour === lastVisibleHour,
                    }}
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
                    {/* Matches common/HorizontalLines.tsx:102-125, which this page's own
                        Team tab already renders. The now-line was red here, red-but-a
                        different-red on the Week tab, and blue on Team, so the same page
                        changed the colour of the same line between its own tabs. */}
                    {nowTimeLabel && (
                      <div
                        className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold whitespace-nowrap"
                        style={{ color: 'var(--blue-text)' }}
                      >
                        {nowTimeLabel}
                      </div>
                    )}
                    <div
                      className="absolute left-[-5px] size-[7px] rounded-full translate-y-[-50%]"
                      style={{ backgroundColor: 'var(--blue)' }}
                    />
                    <div
                      className="translate-y-[-50%] border-t-2 border-solid"
                      style={{ borderTopColor: 'var(--blue)', opacity: 0.75 }}
                    />
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
