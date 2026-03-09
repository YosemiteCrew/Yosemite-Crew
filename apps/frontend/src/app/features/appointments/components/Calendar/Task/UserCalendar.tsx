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

  const normalizeId = (value?: string) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';

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
      <div
        className="w-full flex-1 overflow-x-auto overflow-y-hidden relative"
        data-calendar-scroll="true"
      >
        <div className="min-w-max h-full flex flex-col">
          <div className="grid border-b border-grey-light py-3 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
            <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
              <Back onClick={handlePrevDay} />
            </div>
            <div className="bg-white min-w-max">
              <UserLabels team={team} currentDate={date} columnsStyle={teamColumnsStyle} />
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
              paddingBottom: zoomMode === 'out' ? 12 : 0,
            }}
            data-calendar-scroll="true"
          >
            <div className="pt-1 pb-3">
              {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div
                    className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2!"
                    style={{ height: `${height}px`, paddingTop: hour === 0 ? 4 : 0 }}
                  >
                    {formatHourLabel(hour)}
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
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-20 bg-white" style={{ height: `${height}px` }} />
                </div>
              ))}
              <div style={{ height: zoomMode === 'out' ? 48 : 12 }} />
            </div>

            {nowPosition && (
              <div className="pointer-events-none absolute inset-0">
                <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div />
                  <div className="relative">
                    <div
                      className="absolute left-0 right-2 z-20"
                      style={{
                        top: nowPosition.topPx,
                        transform: 'translateY(-50%)',
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
  );
};

export default UserCalendar;
