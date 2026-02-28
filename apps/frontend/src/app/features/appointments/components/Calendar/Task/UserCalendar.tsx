import React, { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_CALENDAR_FOCUS_MINUTES,
  EVENT_VERTICAL_GAP_PX,
  getFirstRelevantTimedEventStart,
  getTopPxForMinutes,
  minutesSinceStartOfDay,
  nextDay,
  scrollContainerToTarget,
  startOfDayDate,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from "@/app/features/appointments/components/Calendar/helpers";
import { HOURS_IN_DAY } from "@/app/features/appointments/components/Calendar/weekHelpers";
import TaskSlot from "@/app/features/appointments/components/Calendar/Task/TaskSlot";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import UserLabels from "@/app/features/appointments/components/Calendar/Task/UserLabels";
import { Task, TaskStatus } from "@/app/features/tasks/types/task";
import Back from "@/app/ui/primitives/Icons/Back";
import Next from "@/app/ui/primitives/Icons/Next";
import { useCalendarNavigation } from "@/app/hooks/useCalendarNavigation";

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type UserCalendarProps = {
  events: Task[];
  date: Date;
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
  const isSameDayLocal = (a?: Date | null, b?: Date | null) =>
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const team = useTeamForPrimaryOrg();
  const { handleNextDay, handlePrevDay } = useCalendarNavigation(setCurrentDate);
  const height = (PIXELS_PER_STEP / MINUTES_PER_STEP) * 60;
  const HOUR_ROW_TOP_OFFSET_PX = 8;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const normalizeId = (value?: string) =>
    String(value ?? "")
      .trim()
      .split("/")
      .pop()
      ?.toLowerCase() ?? "";

  const nowPosition = useMemo(() => {
    const now = new Date();
    if (!isSameDayLocal(now, date)) return null;
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const topPx = getTopPxForMinutes(
      minutesSinceMidnight,
      height,
      EVENT_VERTICAL_GAP_PX,
      HOUR_ROW_TOP_OFFSET_PX
    );
    return { topPx };
  }, [date, height]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const rangeStart = startOfDayDate(date);
    const rangeEnd = nextDay(date);
    const asTimed = events.map((task) => ({
      startTime: new Date(task.dueAt),
      endTime: new Date(new Date(task.dueAt).getTime() + 30 * 60 * 1000),
    })) as Array<{ startTime: Date; endTime: Date }>;
    const focusStart = getFirstRelevantTimedEventStart(
      asTimed as any,
      rangeStart,
      rangeEnd
    );
    const topPx = nowPosition
      ? Math.max(0, nowPosition.topPx)
      : getTopPxForMinutes(
          focusStart
            ? minutesSinceStartOfDay(focusStart)
            : DEFAULT_CALENDAR_FOCUS_MINUTES,
          height,
          EVENT_VERTICAL_GAP_PX,
          HOUR_ROW_TOP_OFFSET_PX
        );
    scrollContainerToTarget(scrollRef.current, topPx);
  }, [date, events, height, nowPosition]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="w-full flex-1 overflow-x-auto relative max-w-[calc(100vw-32px)] sm:max-w-[calc(100vw-96px)] lg:max-w-[calc(100vw-300px)]"
        data-calendar-scroll="true"
      >
        <div className="min-w-max">
          <div className="grid border-b border-grey-light py-3 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max bg-white">
            <div className="sticky left-0 z-30 bg-white flex items-center justify-center">
              <Back onClick={handlePrevDay} />
            </div>
            <div className="bg-white min-w-max">
              <UserLabels team={team} currentDate={date} />
            </div>
            <div className="sticky right-0 z-30 bg-white flex items-center justify-center">
              <Next onClick={handleNextDay} />
            </div>
          </div>

          <div
            ref={scrollRef}
            className="max-h-[680px] overflow-y-auto relative"
            data-calendar-scroll="true"
          >
            {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
              <div
                key={hour}
                className="grid gap-y-0.5 grid-cols-[64px_minmax(0,1fr)_64px] min-w-max"
              >
                <div
                  className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2!"
                  style={{ height: `${height}px`, opacity: hour === 0 ? 0 : 1 }}
                >
                  {new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="grid grid-flow-col auto-cols-[170px] min-w-max">
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
                        dueAt.getHours() === hour &&
                        isSameDayLocal(dueAt, date) &&
                        memberIds.has(normalizeId(task.assignedTo))
                      );
                    });
                    return (
                      <div
                        key={`${user._id}-${hour}-${index}`}
                        className="relative pt-2"
                        style={{ height: `${height}px` }}
                      >
                        {hour !== 0 && (
                          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 border-t border-grey-light" />
                        )}
                        <TaskSlot
                          slotEvents={slotEvents}
                          handleViewTask={handleViewTask}
                          onQuickStatusChange={onQuickStatusChange}
                          canEditTasks={canEditTasks}
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
                            getDropAvailabilityIntervals?.(
                              date,
                              user.practionerId || user._id
                            ) ?? []
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

            {nowPosition && (
              <div className="pointer-events-none absolute inset-0">
                <div className="grid h-full grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
                  <div />
                <div className="relative">
                  <div
                    className="absolute left-0 right-2 z-20"
                    style={{
                      top: nowPosition.topPx,
                      transform: "translateY(-50%)",
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
