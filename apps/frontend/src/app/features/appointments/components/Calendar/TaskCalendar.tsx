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

const normalizeCalendarId = (value?: string) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

const clampCalendarMinutes = (minutes: number) =>
  Math.max(0, Math.min(24 * 60 - 5, Math.round(minutes / 5) * 5));

const getCalendarDayKey = (date: Date) =>
  formatDateInPreferredTimeZone(date, { weekday: 'long' }).toUpperCase();

const shouldAllowTaskAvailabilityBypass = (
  authUserId: string,
  task: Task,
  normalizeId: (value?: string) => string,
  resolveAssigneeId: (candidateId?: string) => string,
  targetAssigneeId?: string
) => {
  const normalizedCurrentUser = normalizeId(authUserId);
  const isAssignedByCurrentUser =
    !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
  if (isAssignedByCurrentUser) return false;
  const currentAssignee = resolveAssigneeId(task.assignedTo);
  const nextAssignee = resolveAssigneeId(targetAssigneeId || task.assignedTo);
  return normalizeId(nextAssignee) !== normalizeId(currentAssignee) || true;
};

type AvailabilitySlot = {
  isAvailable?: boolean;
  startTime?: string;
  endTime?: string;
};

type AvailabilityDayEntry = {
  dayOfWeek?: string;
  slots?: AvailabilitySlot[];
};

type LocalClock = {
  dayOffset: number;
  minutes: number;
};

type AbsoluteMinuteRange = {
  start: number;
  end: number;
};

const getSourceDayKey = (dayEntry: AvailabilityDayEntry) =>
  String(dayEntry?.dayOfWeek ?? '').toUpperCase();

const getAvailabilitySlots = (dayEntry: AvailabilityDayEntry) =>
  Array.isArray(dayEntry?.slots) ? dayEntry.slots : [];

const getAbsoluteMinuteRange = (
  slot: AvailabilitySlot,
  toLocalClock: (utcTime: string) => LocalClock
): AbsoluteMinuteRange => {
  const startClock = toLocalClock(slot?.startTime || '');
  const endClock = toLocalClock(slot?.endTime || '');
  const start = startClock.dayOffset * 1440 + startClock.minutes;
  let end = endClock.dayOffset * 1440 + endClock.minutes;
  if (end <= start) end += 1440;
  return { start, end };
};

const getDayOffsetBounds = (range: AbsoluteMinuteRange, taskBlockDuration: number) => {
  const latestStart = range.end - taskBlockDuration;
  if (latestStart < range.start) return null;
  return {
    latestStart,
    firstDayOffset: Math.floor(range.start / 1440),
    lastDayOffset: Math.floor(latestStart / 1440),
  };
};

const appendAvailabilityInterval = (
  output: Record<string, DropAvailabilityInterval[]>,
  sourceDayKey: string,
  offset: number,
  rangeStart: number,
  latestStart: number,
  shiftKey: (dayKey: string, offset: number) => string
) => {
  const dayStartMinute = offset * 1440;
  const localStart = Math.max(rangeStart, dayStartMinute);
  const localEnd = Math.min(latestStart, dayStartMinute + 1435);
  if (localEnd < localStart) return;
  const dayKey = shiftKey(sourceDayKey, offset);
  if (!output[dayKey]) output[dayKey] = [];
  output[dayKey].push({
    startMinute: localStart - dayStartMinute,
    endMinute: localEnd - dayStartMinute,
  });
};

function buildAvailabilityOutput(
  baseAvailability: AvailabilityDayEntry[],
  taskBlockDuration: number,
  toLocalClock: (utcTime: string) => LocalClock,
  shiftKey: (dayKey: string, offset: number) => string
): Record<string, DropAvailabilityInterval[]> {
  const output: Record<string, DropAvailabilityInterval[]> = {};
  for (const dayEntry of baseAvailability) {
    const sourceDayKey = getSourceDayKey(dayEntry);
    if (!sourceDayKey) continue;
    for (const slot of getAvailabilitySlots(dayEntry)) {
      if (slot?.isAvailable === false) continue;
      const range = getAbsoluteMinuteRange(slot, toLocalClock);
      const bounds = getDayOffsetBounds(range, taskBlockDuration);
      if (!bounds) continue;
      for (let offset = bounds.firstDayOffset; offset <= bounds.lastDayOffset; offset++) {
        appendAvailabilityInterval(
          output,
          sourceDayKey,
          offset,
          range.start,
          bounds.latestStart,
          shiftKey
        );
      }
    }
  }
  return output;
}

type MoveTaskToCalendarSlotParams = {
  allTaskItems: Task[];
  draggedTaskId: string | null;
  canEditTask: (task: Task) => boolean;
  setDragError: React.Dispatch<React.SetStateAction<string | null>>;
  resolveAssigneeId: (candidateId?: string) => string;
  shouldEnforceAvailability: (task: Task, targetAssigneeId?: string) => boolean;
  isMinuteAvailableForAssignee: (
    date: Date,
    minute: number,
    assigneeId?: string
  ) => Promise<boolean>;
};

const moveTaskToCalendarSlot = async (
  date: Date,
  minuteOfDay: number,
  targetAssigneeId: string | undefined,
  params: MoveTaskToCalendarSlotParams
) => {
  if (!params.draggedTaskId) return;
  const task = params.allTaskItems.find((item) => item._id === params.draggedTaskId);
  if (!task?._id) return;
  if (!params.canEditTask(task)) {
    params.setDragError('Only pending or in-progress tasks can be moved.');
    return;
  }
  const snappedMinute = clampCalendarMinutes(minuteOfDay);
  const canReassign = task.audience === 'EMPLOYEE_TASK';
  const nextAssignee = params.resolveAssigneeId(
    (canReassign ? targetAssigneeId : undefined) || task.assignedTo
  );
  if (!nextAssignee) {
    params.setDragError('Task assignee is required.');
    return;
  }
  if (params.shouldEnforceAvailability(task, nextAssignee)) {
    const isAvailable = await params.isMinuteAvailableForAssignee(
      date,
      snappedMinute,
      nextAssignee
    );
    if (!isAvailable) {
      params.setDragError('Target assignee is unavailable at the selected time.');
      return;
    }
  }

  const nextDueAt = buildDateInPreferredTimeZone(date, snappedMinute);

  try {
    params.setDragError(null);
    await updateTask({
      ...task,
      assignedTo: nextAssignee,
      dueAt: nextDueAt,
      timezone: task.timezone || getPreferredTimeZone(),
    });
  } catch {
    params.setDragError('Unable to update task. Please try again.');
  }
};

const handleTaskStatusChangeAction = (
  task: Task,
  notify: ReturnType<typeof useNotify>['notify'],
  setActiveTask?: (inventory: Task) => void,
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>,
  setChangeStatusPopup?: (open: boolean) => void
) => {
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

const handleTaskRescheduleAction = (
  task: Task,
  notify: ReturnType<typeof useNotify>['notify'],
  setActiveTask?: (inventory: Task) => void,
  setReschedulePopup?: (open: boolean) => void
) => {
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

const registerCalendarDragAutoScroll = (
  event: DragEvent,
  edgeThreshold: number,
  scrollAmount: number
) => {
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

type TaskCalendarBodyProps = {
  activeCalendar: string;
  dayEvents: Task[];
  filteredList: Task[];
  currentDate: Date;
  zoomMode: CalendarZoomMode;
  handleViewTask: (appointment: Task) => void;
  handleChangeStatusTask: (task: Task) => void;
  handleRescheduleTask: (task: Task) => void;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks: boolean;
  draggedTaskId: string | null;
  draggedTaskLabel: string | null;
  canDragTask: (task: Task) => boolean;
  handleTaskDragStart: (task: Task) => void;
  handleTaskDragEnd: () => void;
  moveTask: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => Promise<void>;
  onCreateTaskAt: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget: (dropDate: Date, assigneeId?: string) => void;
  getDropAvailabilityIntervals: (date: Date, assigneeId?: string) => DropAvailabilityInterval[];
  resolveDisplayName: (memberId?: string) => string;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
};

const TaskCalendarBody = ({
  activeCalendar,
  dayEvents,
  filteredList,
  currentDate,
  zoomMode,
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
  setCurrentDate,
  canEditTasks,
  draggedTaskId,
  draggedTaskLabel,
  canDragTask,
  handleTaskDragStart,
  handleTaskDragEnd,
  moveTask,
  onCreateTaskAt,
  onDragHoverTarget,
  getDropAvailabilityIntervals,
  resolveDisplayName,
  weekStart,
  setWeekStart,
}: TaskCalendarBodyProps) => {
  const handleDrop = (dropDate: Date, minute: number, assigneeId?: string) => {
    moveTask(dropDate, minute, assigneeId).catch(() => undefined);
    handleTaskDragEnd();
  };

  if (activeCalendar === 'day') {
    return (
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
        onTaskDropAt={(dropDate, minute) => handleDrop(dropDate, minute)}
        onCreateTaskAt={onCreateTaskAt}
        onDragHoverTarget={onDragHoverTarget}
        getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        resolveDisplayName={resolveDisplayName}
        slotStepMinutes={15}
      />
    );
  }

  if (activeCalendar === 'week') {
    return (
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
        onTaskDropAt={(dropDate, minute) => handleDrop(dropDate, minute)}
        onCreateTaskAt={onCreateTaskAt}
        onDragHoverTarget={onDragHoverTarget}
        getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        resolveDisplayName={resolveDisplayName}
        slotStepMinutes={15}
      />
    );
  }

  if (activeCalendar !== 'team') return null;

  return (
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
      onTaskDropAt={handleDrop}
      onCreateTaskAt={onCreateTaskAt}
      onDragHoverTarget={onDragHoverTarget}
      getDropAvailabilityIntervals={getDropAvailabilityIntervals}
      resolveDisplayName={resolveDisplayName}
      slotStepMinutes={15}
    />
  );
};

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
  const normalizeId = useCallback((value?: string) => normalizeCalendarId(value), []);

  const toLocalClockFromUtcTime = (utcTime: string) =>
    utcClockTimeToPreferredTimeZoneClock(utcTime);

  const getDayKey = (date: Date) => getCalendarDayKey(date);

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
      return shouldAllowTaskAvailabilityBypass(
        authUserId,
        task,
        normalizeId,
        resolveAssigneeId,
        targetAssigneeId
      );
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

  const moveTask = useCallback(
    (date: Date, minuteOfDay: number, targetAssigneeId?: string) =>
      moveTaskToCalendarSlot(date, minuteOfDay, targetAssigneeId, {
        allTaskItems,
        draggedTaskId,
        canEditTask,
        setDragError,
        resolveAssigneeId,
        shouldEnforceAvailability,
        isMinuteAvailableForAssignee,
      }),
    [
      allTaskItems,
      canEditTask,
      draggedTaskId,
      isMinuteAvailableForAssignee,
      resolveAssigneeId,
      shouldEnforceAvailability,
    ]
  );

  const handleChangeStatusTask = useCallback(
    (task: Task) =>
      handleTaskStatusChangeAction(
        task,
        notify,
        setActiveTask,
        setChangeStatusPreferredStatus,
        setChangeStatusPopup
      ),
    [notify, setActiveTask, setChangeStatusPopup, setChangeStatusPreferredStatus]
  );

  const handleRescheduleTask = useCallback(
    (task: Task) => handleTaskRescheduleAction(task, notify, setActiveTask, setReschedulePopup),
    [notify, setActiveTask, setReschedulePopup]
  );

  useEffect(() => {
    if (!draggedTaskId) return;
    const edgeThreshold = 72;
    const scrollAmount = 28;
    const handleDragOver = (event: DragEvent) =>
      registerCalendarDragAutoScroll(event, edgeThreshold, scrollAmount);

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
      const dueAt = buildDateInPreferredTimeZone(date, clampCalendarMinutes(minuteOfDay));
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
      <TaskCalendarBody
        activeCalendar={activeCalendar}
        dayEvents={dayEvents}
        filteredList={filteredList}
        currentDate={currentDate}
        zoomMode={zoomMode}
        handleViewTask={handleViewTask}
        handleChangeStatusTask={handleChangeStatusTask}
        handleRescheduleTask={handleRescheduleTask}
        setCurrentDate={setCurrentDate}
        canEditTasks={canEditTasks}
        draggedTaskId={draggedTaskId}
        draggedTaskLabel={draggedTaskLabel}
        canDragTask={canDragTask}
        handleTaskDragStart={handleTaskDragStart}
        handleTaskDragEnd={handleTaskDragEnd}
        moveTask={moveTask}
        onCreateTaskAt={handleCreateTaskAt}
        onDragHoverTarget={handleDragHoverTarget}
        getDropAvailabilityIntervals={getDropAvailabilityIntervals}
        resolveDisplayName={resolveDisplayName}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
      />
    </div>
  );
};

export default memo(TaskCalendar);
