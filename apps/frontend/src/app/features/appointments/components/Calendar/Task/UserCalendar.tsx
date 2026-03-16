import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Task } from '@/app/features/tasks/types/task';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useCalendarNavigation } from '@/app/hooks/useCalendarNavigation';
import {
  CalendarZoomMode,
  formatHourLabel,
  getCalendarColumnGridStyle,
  getHourRowHeightPx,
} from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  getHourInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import NowIndicator from '@/app/features/appointments/components/Calendar/common/NowIndicator';
import SlotGridLines from '@/app/features/appointments/components/Calendar/common/SlotGridLines';

const HOUR_ROW_GAP_PX = 0;

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

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
  const slotOffsetMinutes = useMemo(() => {
    const step = Math.max(5, Math.round(slotStepMinutes || 15));
    if (step >= 60) return [];
    const offsets: number[] = [];
    for (let minute = step; minute < 60; minute += step) {
      offsets.push(minute);
    }
    return offsets;
  }, [slotStepMinutes]);
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
  const nowTimeLabel = useMemo(() => {
    if (!nowPosition) return null;
    return formatDateInPreferredTimeZone(now, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [now, nowPosition]);

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
      <div
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col">
          <div className="grid border-b border-grey-light py-2 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
            <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
              <Back onClick={handlePrevDay} />
            </div>
            <div className="bg-white min-w-max flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="text-body-4 text-text-brand">{weekday}</div>
                <div className="text-body-4-emphasis text-white h-8 w-8 flex items-center justify-center rounded-full bg-text-brand">
                  {dateNumber}
                </div>
              </div>
              <UserLabels team={team} columnsStyle={teamColumnsStyle} />
            </div>
            <div className="sticky right-0 z-30 bg-white flex items-center justify-center">
              <Next onClick={handleNextDay} />
            </div>
          </div>

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
                  <div
                    className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2! relative"
                    style={{ height: `${height}px` }}
                  >
                    <span className="absolute top-0 -translate-y-1/2">{formatHourLabel(hour)}</span>
                  </div>
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
