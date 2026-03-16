import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import DayCalendar from '@/app/features/appointments/components/Calendar/Task/DayCalendar';
import WeekCalendar from '@/app/features/appointments/components/Calendar/Task/WeekCalendar';
import UserCalendar from '@/app/features/appointments/components/Calendar/Task/UserCalendar';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { getProfileForUserForPrimaryOrg } from '@/app/features/organization/services/teamService';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { useAuthStore } from '@/app/stores/authStore';
import { useNotify } from '@/app/hooks/useNotify';
import {
  buildDateInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  getPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getPreferredNextTaskStatus,
} from '@/app/lib/tasks';

type TaskCalendarProps = {
  filteredList: Task[];
  allTasks?: Task[];
  setActiveTask?: (inventory: Task) => void;
  setViewPopup?: (open: boolean) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
  setReschedulePopup?: (open: boolean) => void;
  activeCalendar: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks?: boolean;
  onCreateFromCalendarSlot?: (prefill: { dueAt: Date; assignedTo?: string }) => void;
};

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

const WEEKDAY_ORDER = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

function buildAvailabilityOutput(
  baseAvailability: Array<{
    dayOfWeek?: string;
    slots?: Array<{ isAvailable?: boolean; startTime?: string; endTime?: string }>;
  }>,
  taskBlockDuration: number,
  toLocalClock: (utcTime: string) => { dayOffset: number; minutes: number },
  shiftKey: (dayKey: string, offset: number) => string
): Record<string, DropAvailabilityInterval[]> {
  const output: Record<string, DropAvailabilityInterval[]> = {};
  for (const dayEntry of baseAvailability) {
    const sourceDayKey = String(dayEntry?.dayOfWeek ?? '').toUpperCase();
    if (!sourceDayKey) continue;
    const slots = Array.isArray(dayEntry?.slots) ? dayEntry.slots : [];
    for (const slot of slots) {
      if (slot?.isAvailable === false) continue;
      const startClock = toLocalClock(slot?.startTime || '');
      const endClock = toLocalClock(slot?.endTime || '');
      const startAbsoluteMinute = startClock.dayOffset * 1440 + startClock.minutes;
      let endAbsoluteMinute = endClock.dayOffset * 1440 + endClock.minutes;
      if (endAbsoluteMinute <= startAbsoluteMinute) {
        endAbsoluteMinute += 1440;
      }
      const latestStartAbsoluteMinute = endAbsoluteMinute - taskBlockDuration;
      if (latestStartAbsoluteMinute < startAbsoluteMinute) continue;
      const firstDayOffset = Math.floor(startAbsoluteMinute / 1440);
      const lastDayOffset = Math.floor(latestStartAbsoluteMinute / 1440);
      for (let offset = firstDayOffset; offset <= lastDayOffset; offset++) {
        const dayStartMinute = offset * 1440;
        const localStart = Math.max(startAbsoluteMinute, dayStartMinute);
        const localEnd = Math.min(latestStartAbsoluteMinute, dayStartMinute + 1435);
        if (localEnd < localStart) continue;
        const dayKey = shiftKey(sourceDayKey, offset);
        if (!output[dayKey]) output[dayKey] = [];
        output[dayKey].push({
          startMinute: localStart - dayStartMinute,
          endMinute: localEnd - dayStartMinute,
        });
      }
    }
  }
  return output;
}

const TaskCalendar = ({
  filteredList,
  allTasks,
  setActiveTask,
  setViewPopup,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setReschedulePopup,
  activeCalendar,
  setActiveCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  canEditTasks = false,
  onCreateFromCalendarSlot,
}: TaskCalendarProps) => {
  const { notify } = useNotify();
  const allTaskItems = allTasks ?? filteredList;
  const teams = useTeamForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskLabel, setDraggedTaskLabel] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
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

  const toLocalClockFromUtcTime = (utcTime: string) =>
    utcClockTimeToPreferredTimeZoneClock(utcTime);

  const getDayKey = (date: Date) =>
    formatDateInPreferredTimeZone(date, { weekday: 'long' }).toUpperCase();

  const shiftDayKey = useCallback((dayKey: string, offset: number): string => {
    const index = WEEKDAY_ORDER.indexOf(String(dayKey || '').toUpperCase());
    if (index < 0) return String(dayKey || '').toUpperCase();
    const shifted = (index + offset) % WEEKDAY_ORDER.length;
    const safe = shifted < 0 ? shifted + WEEKDAY_ORDER.length : shifted;
    return WEEKDAY_ORDER[safe];
  }, []);

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

  const teamNameById = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((member) => {
      const name = member.name || (member as any).displayName || '-';
      const ids = [
        member.practionerId,
        member._id,
        (member as any).userId,
        (member as any).id,
        (member as any).userOrganisation?.userId,
      ];
      ids.forEach((id) => {
        const normalized = normalizeId(id);
        if (normalized) map[normalized] = name;
      });
    });
    return map;
  }, [normalizeId, teams]);

  const resolveDisplayName = useCallback(
    (memberId?: string) => {
      const raw = String(memberId ?? '').trim();
      if (!raw) return '-';
      const resolved = resolveMemberName(raw);
      if (resolved && resolved !== '-') return resolved;
      return teamNameById[normalizeId(raw)] || raw;
    },
    [normalizeId, resolveMemberName, teamNameById]
  );

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
          const baseAvailability = Array.isArray(profile?.baseAvailability)
            ? profile.baseAvailability
            : [];
          availabilityCacheRef.current[cacheKey] = buildAvailabilityOutput(
            baseAvailability,
            TASK_BLOCK_DURATION_MINUTES,
            toLocalClockFromUtcTime,
            shiftDayKey
          );
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
    [normalizeId, resolveAssigneeId, shiftDayKey]
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

    const nextDueAt = buildDateInPreferredTimeZone(date, snappedMinute);

    try {
      setDragError(null);
      await updateTask({
        ...task,
        assignedTo: nextAssignee,
        dueAt: nextDueAt,
        timezone: task.timezone || getPreferredTimeZone(),
      });
    } catch {
      setDragError('Unable to update task. Please try again.');
    }
  };

  const handleChangeStatusTask = (task: Task) => {
    if (!canShowTaskStatusChangeAction(task.status)) {
      notify('warning', {
        title: 'Status change blocked',
        text: 'No status changes are available for this task.',
      });
      return;
    }
    setActiveTask?.(task);
    setChangeStatusPreferredStatus?.(getPreferredNextTaskStatus(task.status));
    setChangeStatusPopup?.(true);
  };

  const handleRescheduleTask = (task: Task) => {
    if (!canRescheduleTask(task.status)) {
      notify('warning', {
        title: 'Reschedule blocked',
        text: 'Completed and cancelled tasks cannot be rescheduled.',
      });
      return;
    }
    setActiveTask?.(task);
    setReschedulePopup?.(true);
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

  const handleTaskDragStart = useCallback(
    (task: Task) => {
      if (!canDragTask(task)) return;
      setDragError(null);
      setDraggedTaskId(task._id);
      setDraggedTaskLabel(task.name || 'Task');
      if (shouldEnforceAvailability(task, task.assignedTo)) {
        ensureAssigneeAvailability(task.assignedTo).catch(() => undefined);
      }
    },
    [canDragTask, ensureAssigneeAvailability, shouldEnforceAvailability]
  );

  const handleTaskDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDraggedTaskLabel(null);
  }, []);

  const handleDragHoverTarget = useCallback(
    (_dropDate: Date, assigneeId?: string) => {
      const task = allTaskItems.find((item) => item._id === draggedTaskId);
      if (!task) return;
      if (shouldEnforceAvailability(task, assigneeId || task.assignedTo)) {
        ensureAssigneeAvailability(assigneeId || task.assignedTo).catch(() => undefined);
      }
    },
    [allTaskItems, draggedTaskId, ensureAssigneeAvailability, shouldEnforceAvailability]
  );

  const handleCreateTaskAt = useCallback(
    (date: Date, minuteOfDay: number, targetAssigneeId?: string) => {
      if (!canEditTasks || !onCreateFromCalendarSlot) return;
      const dueAt = buildDateInPreferredTimeZone(date, clampMinutes(minuteOfDay));
      const assignedTo = targetAssigneeId ? resolveAssigneeId(targetAssigneeId) : undefined;
      onCreateFromCalendarSlot({
        dueAt,
        assignedTo: assignedTo || undefined,
      });
    },
    [canEditTasks, onCreateFromCalendarSlot, resolveAssigneeId]
  );

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isOnPreferredTimeZoneCalendarDay(new Date(event.dueAt), currentDate)
      ),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full h-full min-h-0 flex flex-col overflow-hidden">
      <Header
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        zoomMode={zoomMode}
        setZoomMode={setZoomMode}
        activeCalendar={activeCalendar}
        setActiveCalendar={setActiveCalendar}
      />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          handleViewTask={handleViewTask}
          handleChangeStatusTask={handleChangeStatusTask}
          handleRescheduleTask={handleRescheduleTask}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          draggedTaskId={draggedTaskId}
          draggedTaskLabel={draggedTaskLabel}
          canDragTask={canDragTask}
          onTaskDragStart={handleTaskDragStart}
          onTaskDragEnd={handleTaskDragEnd}
          onTaskDropAt={(dropDate, minute) => {
            moveTask(dropDate, minute).catch(() => undefined);
            handleTaskDragEnd();
          }}
          onCreateTaskAt={handleCreateTaskAt}
          onDragHoverTarget={handleDragHoverTarget}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          resolveDisplayName={resolveDisplayName}
          slotStepMinutes={15}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          events={filteredList}
          zoomMode={zoomMode}
          handleViewTask={handleViewTask}
          handleChangeStatusTask={handleChangeStatusTask}
          handleRescheduleTask={handleRescheduleTask}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          draggedTaskId={draggedTaskId}
          draggedTaskLabel={draggedTaskLabel}
          canDragTask={canDragTask}
          onTaskDragStart={handleTaskDragStart}
          onTaskDragEnd={handleTaskDragEnd}
          onTaskDropAt={(dropDate, minute) => {
            moveTask(dropDate, minute).catch(() => undefined);
            handleTaskDragEnd();
          }}
          onCreateTaskAt={handleCreateTaskAt}
          onDragHoverTarget={handleDragHoverTarget}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          resolveDisplayName={resolveDisplayName}
          slotStepMinutes={15}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          handleViewTask={handleViewTask}
          handleChangeStatusTask={handleChangeStatusTask}
          handleRescheduleTask={handleRescheduleTask}
          setCurrentDate={setCurrentDate}
          canEditTasks={canEditTasks}
          draggedTaskId={draggedTaskId}
          draggedTaskLabel={draggedTaskLabel}
          canDragTask={canDragTask}
          onTaskDragStart={handleTaskDragStart}
          onTaskDragEnd={handleTaskDragEnd}
          onTaskDropAt={(dropDate, minute, assigneeId) => {
            moveTask(dropDate, minute, assigneeId).catch(() => undefined);
            handleTaskDragEnd();
          }}
          onCreateTaskAt={handleCreateTaskAt}
          onDragHoverTarget={handleDragHoverTarget}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          resolveDisplayName={resolveDisplayName}
          slotStepMinutes={15}
        />
      )}
    </div>
  );
};

export default memo(TaskCalendar);
