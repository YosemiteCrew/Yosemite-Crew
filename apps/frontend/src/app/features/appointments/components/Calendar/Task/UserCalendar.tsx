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
import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import UserLabels from '@/app/features/appointments/components/Calendar/Task/UserLabels';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
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

const UserCalendar: React.FC<UserCalendarProps> = ({
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

  const normalizeId = (value?: string) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';
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
                    {team?.map((user, index) => {
                      const memberIds = new Set(
                        [
                          user.practionerId,
                          user._id,
                          (user as any).userId,
                          (user as any).id,
                          (user as any).userOrganisation?.userId,
                        ]
                          .filter(Boolean)
                          .map((value) => normalizeId(value))
                      );
                      const slotEvents = events.filter((task) => {
                        const dueAt = new Date(task.dueAt);
                        return (
                          getHourInPreferredTimeZone(dueAt) === hour &&
                          isOnPreferredTimeZoneCalendarDay(dueAt, date) &&
                          memberIds.has(normalizeId(task.assignedTo))
                        );
                      });
                      return (
                        <div
                          key={`${user._id}-${hour}`}
                          className="relative"
                          style={{ height: `${height}px` }}
                        >
                          <TaskSlot
                            slotEvents={slotEvents}
                            handleViewTask={handleViewTask}
                            onQuickStatusChange={onQuickStatusChange}
                            canEditTasks={canEditTasks}
                            zoomMode={zoomMode}
                            dayIndex={index}
                            length={team.length - 1}
                            height={height}
                            hour={hour}
                            dropDate={date}
                            dropAssigneeId={
                              user.practionerId ||
                              (user as any).userId ||
                              (user as any).id ||
                              (user as any).userOrganisation?.userId ||
                              user._id
                            }
                            draggedTaskId={draggedTaskId}
                            draggedTaskLabel={draggedTaskLabel}
                            canDragTask={canDragTask}
                            onTaskDragStart={onTaskDragStart}
                            onTaskDragEnd={onTaskDragEnd}
                            onTaskDropAt={onTaskDropAt}
                            onDragHoverTarget={onDragHoverTarget}
                            dropAvailabilityIntervals={
                              getDropAvailabilityIntervals?.(date, user.practionerId || user._id) ??
                              []
                            }
                            draggedTaskDurationMinutes={draggedTaskDurationMinutes}
                          />
                          <div className="pointer-events-none absolute inset-0 z-10">
                            <div className="absolute inset-x-0 top-0 border-t border-[#C3CEDC]" />
                            {slotOffsetMinutes.map((minute) => (
                              <div
                                key={`${user._id}-${hour}-slot-${minute}`}
                                className="absolute inset-x-0 border-t border-[#E9EDF3]"
                                style={{ top: `${(minute / 60) * 100}%` }}
                              />
                            ))}
                            {hour === lastVisibleHour && (
                              <div className="absolute inset-x-0 top-full border-t border-[#C3CEDC]" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-20 bg-white" style={{ height: `${height}px` }} />
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 30 : 40 }} />
              {nowPosition && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                    <div />
                    <div className="relative">
                      <div
                        className="absolute left-0 right-2 z-20"
                        style={{
                          top: nowPosition.topPx,
                        }}
                      >
                        <div className="absolute -left-[12px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
                        <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
                      </div>
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

export default UserCalendar;
