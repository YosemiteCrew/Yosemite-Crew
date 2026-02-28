import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSameDay } from '@/app/features/appointments/components/Calendar/helpers';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import DayCalendar from '@/app/features/appointments/components/Calendar/Task/DayCalendar';
import WeekCalendar from '@/app/features/appointments/components/Calendar/Task/WeekCalendar';
import UserCalendar from '@/app/features/appointments/components/Calendar/Task/UserCalendar';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { getProfileForUserForPrimaryOrg } from '@/app/features/organization/services/teamService';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { useAuthStore } from '@/app/stores/authStore';

type TaskCalendarProps = {
  filteredList: Task[];
  allTasks?: Task[];
  setActiveTask?: (inventory: Task) => void;
  setViewPopup?: (open: boolean) => void;
  activeCalendar: string;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks?: boolean;
};

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

const TaskCalendar = ({
  filteredList,
  allTasks,
  setActiveTask,
  setViewPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  canEditTasks = false,
}: TaskCalendarProps) => {
  const allTaskItems = allTasks ?? filteredList;
  const teams = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskLabel, setDraggedTaskLabel] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const availabilityCacheRef = useRef<Record<string, Record<string, DropAvailabilityInterval[]>>>(
    {}
  );
  const availabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const TASK_BLOCK_DURATION_MINUTES = 30;

  const normalizeId = useCallback(
    (value?: string) =>
      String(value ?? '')
        .trim()
        .split('/')
        .pop()
        ?.toLowerCase() ?? '',
    []
  );

  const clampMinutes = (minutes: number) =>
    Math.max(0, Math.min(24 * 60 - 5, Math.round(minutes / 5) * 5));

  const toLocalMinutesFromUtcTime = (utcTime: string) => {
    if (!utcTime) return 0;
    const date = new Date(`1970-01-01T${utcTime}:00Z`);
    if (Number.isNaN(date.getTime())) return 0;
    return date.getHours() * 60 + date.getMinutes();
  };

  const getDayKey = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  const resolveAssigneeId = useCallback(
    (candidateId?: string) => {
      if (!candidateId) return '';
      const normalizedCandidate = normalizeId(candidateId);
      const member = teams.find(
        (team) =>
          normalizeId(team.practionerId) === normalizedCandidate ||
          normalizeId(team._id) === normalizedCandidate ||
          normalizeId((team as any).userId) === normalizedCandidate ||
          normalizeId((team as any).id) === normalizedCandidate ||
          normalizeId((team as any).userOrganisation?.userId) === normalizedCandidate
      );
      return (
        member?.practionerId ||
        (member as any)?.userId ||
        (member as any)?.id ||
        (member as any)?.userOrganisation?.userId ||
        member?._id ||
        candidateId
      );
    },
    [normalizeId, teams]
  );

  const canEditTask = useCallback(
    (task: Task) => {
      const normalizedCurrentUser = normalizeId(authUserId);
      const isAssignedByCurrentUser =
        !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
      return task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && isAssignedByCurrentUser;
    },
    [authUserId, normalizeId]
  );
  const canDragTask = canEditTask;

  const shouldEnforceAvailability = useCallback(
    (task: Task, targetAssigneeId?: string) => {
      const normalizedCurrentUser = normalizeId(authUserId);
      const isAssignedByCurrentUser =
        !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
      if (isAssignedByCurrentUser) return false;
      const currentAssignee = resolveAssigneeId(task.assignedTo);
      const nextAssignee = resolveAssigneeId(targetAssigneeId || task.assignedTo);
      const isReassigning = normalizeId(nextAssignee) !== normalizeId(currentAssignee);
      if (isReassigning) return true;
      return true;
    },
    [authUserId, normalizeId, resolveAssigneeId]
  );

  const ensureAssigneeAvailability = useCallback(
    async (assigneeId?: string) => {
      const resolvedAssigneeId = resolveAssigneeId(assigneeId);
      if (!resolvedAssigneeId) return;
      const cacheKey = normalizeId(resolvedAssigneeId);
      if (availabilityCacheRef.current[cacheKey]) return;
      if (availabilityPendingRef.current[cacheKey]) {
        await availabilityPendingRef.current[cacheKey];
        return;
      }
      const task = (async () => {
        try {
          const profile = (await getProfileForUserForPrimaryOrg(resolvedAssigneeId)) as {
            baseAvailability?: Array<{
              dayOfWeek?: string;
              slots?: Array<{
                isAvailable?: boolean;
                startTime?: string;
                endTime?: string;
              }>;
            }>;
          };
          const output: Record<string, DropAvailabilityInterval[]> = {};
          const baseAvailability = Array.isArray(profile?.baseAvailability)
            ? profile.baseAvailability
            : [];
          for (const dayEntry of baseAvailability) {
            const dayKey = String(dayEntry?.dayOfWeek ?? '').toUpperCase();
            if (!dayKey) continue;
            const slots = Array.isArray(dayEntry?.slots) ? dayEntry.slots : [];
            const intervals: DropAvailabilityInterval[] = slots
              .filter((slot: any) => slot?.isAvailable !== false)
              .map((slot: any) => {
                const start = toLocalMinutesFromUtcTime(slot?.startTime || '');
                const end = toLocalMinutesFromUtcTime(slot?.endTime || '');
                const latestStart = end - TASK_BLOCK_DURATION_MINUTES;
                return {
                  startMinute: start,
                  endMinute: Math.max(start, latestStart),
                };
              })
              .filter(
                (interval: DropAvailabilityInterval) => interval.endMinute >= interval.startMinute
              );
            output[dayKey] = intervals;
          }
          availabilityCacheRef.current[cacheKey] = output;
          setAvailabilityVersion((version) => version + 1);
        } catch {
          availabilityCacheRef.current[cacheKey] = {};
          setAvailabilityVersion((version) => version + 1);
        }
      })();
      availabilityPendingRef.current[cacheKey] = task;
      await task;
      delete availabilityPendingRef.current[cacheKey];
    },
    [normalizeId, resolveAssigneeId]
  );

  const getDropAvailabilityIntervals = useCallback(
    (date: Date, assigneeId?: string): DropAvailabilityInterval[] => {
      const draggedTask = allTaskItems.find((item) => item._id === draggedTaskId);
      const targetAssigneeId = assigneeId || draggedTask?.assignedTo;
      if (draggedTask && !shouldEnforceAvailability(draggedTask, targetAssigneeId)) {
        return [
          {
            startMinute: 0,
            endMinute: 24 * 60 - TASK_BLOCK_DURATION_MINUTES,
          },
        ];
      }
      const resolvedAssigneeId = resolveAssigneeId(targetAssigneeId);
      if (!resolvedAssigneeId) return [];
      const assigneeKey = normalizeId(resolvedAssigneeId);
      const dayKey = getDayKey(date);
      return availabilityCacheRef.current[assigneeKey]?.[dayKey] || [];
    },
    [allTaskItems, draggedTaskId, normalizeId, resolveAssigneeId, shouldEnforceAvailability]
  );

  const isMinuteAvailableForAssignee = useCallback(
    async (date: Date, minute: number, assigneeId?: string) => {
      const resolvedAssigneeId = resolveAssigneeId(assigneeId);
      if (!resolvedAssigneeId) return false;
      await ensureAssigneeAvailability(resolvedAssigneeId);
      const intervals = getDropAvailabilityIntervals(date, resolvedAssigneeId);
      if (intervals.length === 0) return false;
      return intervals.some(
        (interval) => minute >= interval.startMinute && minute <= interval.endMinute
      );
    },
    [ensureAssigneeAvailability, getDropAvailabilityIntervals, resolveAssigneeId]
  );

  const moveTask = async (date: Date, minuteOfDay: number, targetAssigneeId?: string) => {
    if (!draggedTaskId) return;
    const task = allTaskItems.find((item) => item._id === draggedTaskId);
    if (!task?._id) return;
    if (!canEditTask(task)) {
      setDragError('Only pending or in-progress tasks can be moved.');
      return;
    }
    const snappedMinute = clampMinutes(minuteOfDay);
    const canReassign = task.audience === 'EMPLOYEE_TASK';
    const nextAssignee = resolveAssigneeId(
      (canReassign ? targetAssigneeId : undefined) || task.assignedTo
    );
    if (!nextAssignee) {
      setDragError('Task assignee is required.');
      return;
    }
    if (shouldEnforceAvailability(task, nextAssignee)) {
      const isAvailable = await isMinuteAvailableForAssignee(date, snappedMinute, nextAssignee);
      if (!isAvailable) {
        setDragError('Target assignee is unavailable at the selected time.');
        return;
      }
    }

    const nextDueAt = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      Math.floor(snappedMinute / 60),
      snappedMinute % 60,
      0,
      0
    );

    try {
      setDragError(null);
      await updateTask({
        ...task,
        assignedTo: nextAssignee,
        dueAt: nextDueAt,
      });
    } catch {
      setDragError('Unable to update task. Please try again.');
    }
  };

  const handleQuickStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      await updateTask({
        ...task,
        status,
      });
    } catch {
      setDragError('Unable to update task status. Please try again.');
    }
  };

  useEffect(() => {
    if (!draggedTaskId) return;
    const edgeThreshold = 72;
    const scrollAmount = 28;
    const handleDragOver = (event: DragEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      const viewportWidth = globalThis.innerWidth;
      const viewportHeight = globalThis.innerHeight;

      if (x >= 0 && x < edgeThreshold) {
        globalThis.scrollBy({ left: -scrollAmount });
      } else if (x > viewportWidth - edgeThreshold) {
        globalThis.scrollBy({ left: scrollAmount });
      }
      if (y >= 0 && y < edgeThreshold) {
        globalThis.scrollBy({ top: -scrollAmount });
      } else if (y > viewportHeight - edgeThreshold) {
        globalThis.scrollBy({ top: scrollAmount });
      }

      const hoveredElement = document.elementFromPoint(x, y) as HTMLElement | null;
      const scrollContainer = hoveredElement?.closest?.(
        "[data-calendar-scroll='true']"
      ) as HTMLElement | null;
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      let deltaX = 0;
      let deltaY = 0;
      if (x - rect.left < edgeThreshold) deltaX = -scrollAmount;
      else if (rect.right - x < edgeThreshold) deltaX = scrollAmount;
      if (y - rect.top < edgeThreshold) deltaY = -scrollAmount;
      else if (rect.bottom - y < edgeThreshold) deltaY = scrollAmount;
      if (deltaX !== 0 || deltaY !== 0) {
        scrollContainer.scrollBy({ left: deltaX, top: deltaY });
      }
    };

    globalThis.addEventListener('dragover', handleDragOver);
    return () => globalThis.removeEventListener('dragover', handleDragOver);
  }, [draggedTaskId, availabilityVersion]);

  const handleViewTask = (appointment: Task) => {
    setActiveTask?.(appointment);
    setViewPopup?.(true);
  };

  const dayEvents = useMemo(
    () => filteredList.filter((event) => isSameDay(new Date(event.dueAt), currentDate)),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col">
      <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          handleViewTask={handleViewTask}
          onQuickStatusChange={handleQuickStatusChange}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          draggedTaskId={draggedTaskId}
          draggedTaskLabel={draggedTaskLabel}
          canDragTask={canDragTask}
          onTaskDragStart={(task) => {
            if (!canDragTask(task)) return;
            setDragError(null);
            setDraggedTaskId(task._id);
            setDraggedTaskLabel(task.name || 'Task');
            if (shouldEnforceAvailability(task, task.assignedTo)) {
              ensureAssigneeAvailability(task.assignedTo).catch(() => undefined);
            }
          }}
          onTaskDragEnd={() => {
            setDraggedTaskId(null);
            setDraggedTaskLabel(null);
          }}
          onTaskDropAt={(dropDate, minute) => {
            moveTask(dropDate, minute).catch(() => undefined);
            setDraggedTaskId(null);
            setDraggedTaskLabel(null);
          }}
          onDragHoverTarget={(dropDate, assigneeId) => {
            const task = allTaskItems.find((item) => item._id === draggedTaskId);
            if (!task) return;
            if (shouldEnforceAvailability(task, assigneeId || task.assignedTo)) {
              ensureAssigneeAvailability(assigneeId || task.assignedTo).catch(() => undefined);
            }
          }}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          events={filteredList}
          date={currentDate}
          handleViewTask={handleViewTask}
          onQuickStatusChange={handleQuickStatusChange}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          draggedTaskId={draggedTaskId}
          draggedTaskLabel={draggedTaskLabel}
          canDragTask={canDragTask}
          onTaskDragStart={(task) => {
            if (!canDragTask(task)) return;
            setDragError(null);
            setDraggedTaskId(task._id);
            setDraggedTaskLabel(task.name || 'Task');
            if (shouldEnforceAvailability(task, task.assignedTo)) {
              ensureAssigneeAvailability(task.assignedTo).catch(() => undefined);
            }
          }}
          onTaskDragEnd={() => {
            setDraggedTaskId(null);
            setDraggedTaskLabel(null);
          }}
          onTaskDropAt={(dropDate, minute) => {
            moveTask(dropDate, minute).catch(() => undefined);
            setDraggedTaskId(null);
            setDraggedTaskLabel(null);
          }}
          onDragHoverTarget={(dropDate, assigneeId) => {
            const task = allTaskItems.find((item) => item._id === draggedTaskId);
            if (!task) return;
            if (shouldEnforceAvailability(task, assigneeId || task.assignedTo)) {
              ensureAssigneeAvailability(assigneeId || task.assignedTo).catch(() => undefined);
            }
          }}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          handleViewTask={handleViewTask}
          onQuickStatusChange={handleQuickStatusChange}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          draggedTaskId={draggedTaskId}
          draggedTaskLabel={draggedTaskLabel}
          canDragTask={canDragTask}
          onTaskDragStart={(task) => {
            if (!canDragTask(task)) return;
            setDragError(null);
            setDraggedTaskId(task._id);
            setDraggedTaskLabel(task.name || 'Task');
            if (shouldEnforceAvailability(task, task.assignedTo)) {
              ensureAssigneeAvailability(task.assignedTo).catch(() => undefined);
            }
          }}
          onTaskDragEnd={() => {
            setDraggedTaskId(null);
            setDraggedTaskLabel(null);
          }}
          onTaskDropAt={(dropDate, minute, assigneeId) => {
            moveTask(dropDate, minute, assigneeId).catch(() => undefined);
            setDraggedTaskId(null);
            setDraggedTaskLabel(null);
          }}
          onDragHoverTarget={(dropDate, assigneeId) => {
            const task = allTaskItems.find((item) => item._id === draggedTaskId);
            if (!task) return;
            if (shouldEnforceAvailability(task, assigneeId || task.assignedTo)) {
              ensureAssigneeAvailability(assigneeId || task.assignedTo).catch(() => undefined);
            }
          }}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        />
      )}
    </div>
  );
};

export default TaskCalendar;
