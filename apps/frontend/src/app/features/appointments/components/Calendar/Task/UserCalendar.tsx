import React, { useCallback, useMemo, useRef } from 'react';
import { HOURS_IN_DAY } from '@/app/features/appointments/components/Calendar/weekHelpers';
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import CalendarDayHeader from '@/app/features/appointments/components/Calendar/common/CalendarDayHeader';
import { Task } from '@/app/features/tasks/types/task';
import { useCalendarNavigation } from '@/app/hooks/useCalendarNavigation';
import {
  CalendarZoomMode,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import CalendarHourLabel from '@/app/features/appointments/components/Calendar/common/CalendarHourLabel';
import {
  getHourInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import NowIndicator from '@/app/features/appointments/components/Calendar/common/NowIndicator';
import SlotGridLines from '@/app/features/appointments/components/Calendar/common/SlotGridLines';
import {
  getTimedTaskProxyEvents,
  useCalendarAutoScroll,
  useNowIndicator,
  useSlotOffsetMinutes,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';

const HOUR_ROW_GAP_PX = 0;

type UserCalendarProps = {
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

const UserCalendar: React.FC<UserCalendarProps> = ({
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
}) => {
  const team = useTeamForPrimaryOrg();
  const now = useCalendarNow();
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const height = getHourRowHeightPx(zoomMode);
  const HOUR_ROW_TOP_OFFSET_PX = 8;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const teamColumnsStyle = useMemo(
    () => getCalendarColumnGridStyle(team.length, zoomMode === 'out' ? 108 : 170),
    [team.length, zoomMode]
  );
  const weekday = formatDateInPreferredTimeZone(date, { weekday: 'short' });
  const dateNumber = formatDateInPreferredTimeZone(date, { day: 'numeric' });

  const normalizeId = useCallback(
    (value?: string) =>
      String(value ?? '')
        .trim()
        .split('/')
        .pop()
        ?.toLowerCase() ?? '',
    []
  );
  const { slotOffsetMinutes, showSlotTimeLabels } = useSlotOffsetMinutes(slotStepMinutes, zoomMode);
  const lastVisibleHour = HOURS_IN_DAY - 1;
  const teamColumns = useMemo(
    () =>
      team.map((user) => ({
        user,
        key: user._id,
        assigneeId:
          user.practionerId ||
          (user as any).userId ||
          (user as any).id ||
          (user as any).userOrganisation?.userId ||
          user._id,
        memberIds: new Set(
          [
            user.practionerId,
            user._id,
            (user as any).userId,
            (user as any).id,
            (user as any).userOrganisation?.userId,
          ]
            .filter(Boolean)
            .map((value) => normalizeId(value))
        ),
      })),
    [normalizeId, team]
  );
  const eventsByHourAndAssignee = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    events.forEach((task) => {
      const dueAt = new Date(task.dueAt);
      if (!isOnPreferredTimeZoneCalendarDay(dueAt, date)) return;
      const hour = getHourInPreferredTimeZone(dueAt);
      if (hour < 0 || hour >= HOURS_IN_DAY) return;
      const normalizedAssignee = normalizeId(task.assignedTo);
      if (!normalizedAssignee) return;
      teamColumns.forEach((column, index) => {
        if (!column.memberIds.has(normalizedAssignee)) return;
        const key = `${index}-${hour}`;
        const list = grouped.get(key);
        if (list) list.push(task);
        else grouped.set(key, [task]);
      });
    });
    return grouped;
  }, [date, events, normalizeId, teamColumns]);

  const { nowPosition, nowTimeLabel } = useNowIndicator(
    date,
    0,
    HOURS_IN_DAY - 1,
    zoomMode,
    now,
    HOUR_ROW_TOP_OFFSET_PX
  );

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
      <div
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col">
          <CalendarDayHeader
            weekday={weekday}
            dateNumber={dateNumber}
            team={team}
            teamColumnsStyle={teamColumnsStyle}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
          />

          <div
            ref={scrollRef}
            className="relative flex-1 min-h-0"
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
              {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <CalendarHourLabel
                    hour={hour}
                    height={height}
                    slotOffsetMinutes={slotOffsetMinutes}
                    showSlotTimeLabels={showSlotTimeLabels}
                    className="sticky left-0 z-20 bg-white"
                  />
                  <div className="grid min-w-max" style={teamColumnsStyle}>
                    {teamColumns.map((column, index) => {
                      const { user } = column;
                      const slotEvents = eventsByHourAndAssignee.get(`${index}-${hour}`) ?? [];
                      return (
                        <div
                          key={`${column.key}-${hour}`}
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
                            dayIndex={index}
                            length={team.length - 1}
                            height={height}
                            hour={hour}
                            dropDate={date}
                            dropAssigneeId={column.assigneeId}
                            draggedTaskId={draggedTaskId}
                            draggedTaskLabel={draggedTaskLabel}
                            canDragTask={canDragTask}
                            onTaskDragStart={onTaskDragStart}
                            onTaskDragEnd={onTaskDragEnd}
                            onTaskDropAt={onTaskDropAt}
                            onCreateTaskAt={onCreateTaskAt}
                            onDragHoverTarget={onDragHoverTarget}
                            dropAvailabilityIntervals={
                              getDropAvailabilityIntervals?.(date, column.assigneeId) ?? []
                            }
                            draggedTaskDurationMinutes={draggedTaskDurationMinutes}
                            resolveDisplayName={resolveDisplayName}
                          />
                          <SlotGridLines
                            userId={user._id}
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
              {nowPosition && <NowIndicator topPx={nowPosition.topPx} timeLabel={nowTimeLabel} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
