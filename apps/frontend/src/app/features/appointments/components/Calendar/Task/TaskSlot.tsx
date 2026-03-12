import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoEyeOutline } from 'react-icons/io5';
import { FaCheckCircle } from 'react-icons/fa';
import { getStatusStyle } from '@/app/ui/tables/Tasks';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { autoScrollCalendarHorizontally } from '@/app/features/appointments/components/Calendar/helpers';
import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { createPortal } from 'react-dom';

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type TaskSlotProps = {
  slotEvents: Task[];
  handleViewTask: (task: Task) => void;
  onQuickStatusChange?: (task: Task, status: TaskStatus) => void;
  canEditTasks?: boolean;
  index?: number;
  dayIndex?: number;
  length?: number;
  height: number;
  hour?: number;
  dropDate?: Date;
  dropAssigneeId?: string;
  draggedTaskId?: string | null;
  draggedTaskLabel?: string | null;
  canDragTask?: (task: Task) => boolean;
  onTaskDragStart?: (task: Task) => void;
  onTaskDragEnd?: () => void;
  onTaskDropAt?: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget?: (date: Date, targetAssigneeId?: string) => void;
  dropAvailabilityIntervals?: DropAvailabilityInterval[];
  draggedTaskDurationMinutes?: number;
  zoomMode?: CalendarZoomMode;
  showGridLines?: boolean;
  slotOffsetMinutes?: number[];
  isLastVisibleHour?: boolean;
};

const TaskSlot = ({
  slotEvents,
  handleViewTask,
  onQuickStatusChange,
  canEditTasks = false,
  index,
  dayIndex = 0,
  length = 0,
  height = 240,
  hour = 0,
  dropDate = new Date(),
  dropAssigneeId,
  draggedTaskId,
  draggedTaskLabel,
  canDragTask,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDropAt,
  onDragHoverTarget,
  dropAvailabilityIntervals = [],
  draggedTaskDurationMinutes = 30,
  zoomMode = 'in',
  showGridLines = false,
  slotOffsetMinutes = [],
  isLastVisibleHour = false,
}: TaskSlotProps) => {
  const { resolveMemberName } = useMemberMap();
  const team = useTeamForPrimaryOrg();
  const isZoomOutMode = zoomMode === 'out';
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [activeCursor, setActiveCursor] = useState<{ x: number; y: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedDayIndex = dayIndex ?? index ?? 0;
  const hourStartMinute = hour * 60;
  const hourEndMinute = hourStartMinute + 60;
  const TASK_BLOCK_DURATION_MINUTES = 30;
  const normalizeId = (value?: string | null) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';

  const teamNameById = useMemo(() => {
    const map: Record<string, string> = {};
    team.forEach((member) => {
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
  }, [team]);

  const resolveDisplayName = useCallback(
    (memberId?: string) => {
      const raw = String(memberId ?? '').trim();
      if (!raw) return '-';
      const resolved = resolveMemberName(raw);
      if (resolved && resolved !== '-') return resolved;
      return teamNameById[normalizeId(raw)] || raw;
    },
    [resolveMemberName, teamNameById]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!activePopoverKey) return;
    const closePopover = () => setActivePopoverKey(null);
    globalThis.addEventListener('scroll', closePopover, true);
    globalThis.addEventListener('resize', closePopover);
    return () => {
      globalThis.removeEventListener('scroll', closePopover, true);
      globalThis.removeEventListener('resize', closePopover);
    };
  }, [activePopoverKey]);

  useEffect(() => {
    if (!draggedTaskId) return;
    setActivePopoverKey(null);
  }, [draggedTaskId]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const schedulePopoverClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActivePopoverKey(null);
    }, 120);
  }, [clearCloseTimer]);

  useEffect(() => {
    const dialogEl = popoverDialogRef.current;
    if (!dialogEl || !activePopoverKey) return;

    const onMouseEnter = () => clearCloseTimer();
    const onMouseLeave = () => schedulePopoverClose();
    const onFocusIn = () => clearCloseTimer();
    const onFocusOut = (event: FocusEvent) => {
      const nextFocused = event.relatedTarget as Node | null;
      if (!nextFocused || !dialogEl.contains(nextFocused)) {
        schedulePopoverClose();
      }
    };
    const onTouchStart = () => clearCloseTimer();
    const onTouchEnd = () => schedulePopoverClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePopoverKey(null);
      }
    };

    dialogEl.addEventListener('mouseenter', onMouseEnter);
    dialogEl.addEventListener('mouseleave', onMouseLeave);
    dialogEl.addEventListener('focusin', onFocusIn);
    dialogEl.addEventListener('focusout', onFocusOut);
    dialogEl.addEventListener('touchstart', onTouchStart, { passive: true });
    dialogEl.addEventListener('touchend', onTouchEnd, { passive: true });
    dialogEl.addEventListener('keydown', onKeyDown);

    return () => {
      dialogEl.removeEventListener('mouseenter', onMouseEnter);
      dialogEl.removeEventListener('mouseleave', onMouseLeave);
      dialogEl.removeEventListener('focusin', onFocusIn);
      dialogEl.removeEventListener('focusout', onFocusOut);
      dialogEl.removeEventListener('touchstart', onTouchStart);
      dialogEl.removeEventListener('touchend', onTouchEnd);
      dialogEl.removeEventListener('keydown', onKeyDown);
    };
  }, [activePopoverKey, clearCloseTimer, schedulePopoverClose]);

  const getPopoverStyle = () => {
    if (!activeRect) return { top: 0, left: 0 };
    const popoverWidth = 320;
    const popoverHeight = 220;
    const margin = 8;
    const viewportWidth = globalThis.innerWidth;
    const viewportHeight = globalThis.innerHeight;
    const anchorX = activeCursor?.x ?? activeRect.left + activeRect.width / 2;
    const anchorY = activeCursor?.y ?? activeRect.top;
    const availableRight = viewportWidth - anchorX - margin;
    const availableLeft = anchorX - margin;
    const shouldPlaceRight = availableRight >= popoverWidth || availableRight >= availableLeft;
    const preferredLeft = shouldPlaceRight ? anchorX + margin : anchorX - popoverWidth - margin;
    const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - popoverWidth - margin));
    const placeAbove = anchorY + popoverHeight + margin > viewportHeight;
    const top = placeAbove
      ? Math.max(margin, anchorY - popoverHeight - margin)
      : Math.max(margin, anchorY);
    return {
      top,
      left,
      width: popoverWidth,
    };
  };

  const openPopover = (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ) => {
    if (draggedTaskId) return;
    clearCloseTimer();
    setActiveRect(target.getBoundingClientRect());
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      setActiveCursor({ x: clientX, y: clientY });
    } else {
      setActiveCursor(null);
    }
    setActivePopoverKey(key);
  };

  const availabilitySegments = useMemo(() => {
    const duration = Math.max(5, draggedTaskDurationMinutes);
    return dropAvailabilityIntervals
      .map((interval) => {
        const segmentStart = Math.max(hourStartMinute, interval.startMinute);
        const segmentEnd = Math.min(hourEndMinute, interval.endMinute + duration);
        if (segmentEnd <= segmentStart) return null;
        const top = ((segmentStart - hourStartMinute) / 60) * height;
        const segmentHeight = Math.max(6, ((segmentEnd - segmentStart) / 60) * height);
        return { top, height: segmentHeight };
      })
      .filter(Boolean) as Array<{ top: number; height: number }>;
  }, [
    draggedTaskDurationMinutes,
    dropAvailabilityIntervals,
    height,
    hourEndMinute,
    hourStartMinute,
  ]);

  const laidOutEvents = useMemo(() => {
    const sorted = [...slotEvents].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
    const laneEnds: number[] = [];
    const laidOut = sorted.map((task) => {
      const dueAt = new Date(task.dueAt);
      const taskMinute = getDatePartsInPreferredTimeZone(dueAt).minute;
      const taskStartMinute = hourStartMinute + taskMinute;
      let laneIndex = 0;
      while (laneIndex < laneEnds.length && laneEnds[laneIndex] > taskStartMinute) {
        laneIndex += 1;
      }
      const blockEnd = taskStartMinute + TASK_BLOCK_DURATION_MINUTES;
      laneEnds[laneIndex] = blockEnd;
      return {
        task,
        laneIndex,
        top: (taskMinute / 60) * height,
      };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return laidOut.map((item) => ({ ...item, laneCount }));
  }, [height, hourStartMinute, slotEvents]);

  const activeTask = useMemo(
    () =>
      laidOutEvents.find(({ task }, eventIndex) => {
        const key = task._id || `${task.name}-${String(task.dueAt)}-${eventIndex}`;
        return key === activePopoverKey;
      })?.task ?? null,
    [activePopoverKey, laidOutEvents]
  );

  const getMinuteFromPointer = (clientY: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const ratio = rect.height > 0 ? y / rect.height : 0;
    const rawMinute = hourStartMinute + ratio * 60;
    return Math.max(0, Math.min(24 * 60 - 5, Math.round(rawMinute / 5) * 5));
  };

  const getNearestAvailableMinute = (minute: number) => {
    const DROP_TOLERANCE_MINUTES = 12;
    const snapped = Math.round(minute / 5) * 5;
    let bestMatch: { minute: number; distance: number } | null = null;
    for (const interval of dropAvailabilityIntervals) {
      const candidateMinute = Math.max(interval.startMinute, Math.min(interval.endMinute, snapped));
      const distance = Math.abs(minute - candidateMinute);
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { minute: candidateMinute, distance };
      }
    }
    if (!bestMatch || bestMatch.distance > DROP_TOLERANCE_MINUTES) return null;
    return bestMatch.minute;
  };

  return (
    <>
      <div
        role="application"
        tabIndex={-1}
        className={`relative bg-white border-l border-grey-light ${
          resolvedDayIndex === length ? 'border-r' : ''
        }`}
        style={{ height: `${height}px` }}
        onDragOver={(event) => {
          if (!draggedTaskId) return;
          event.preventDefault();
          autoScrollCalendarHorizontally(event.clientX, event.currentTarget as HTMLDivElement);
          onDragHoverTarget?.(dropDate, dropAssigneeId);
          const minute = getMinuteFromPointer(event.clientY, event.currentTarget as HTMLDivElement);
          setDropPreviewMinute(getNearestAvailableMinute(minute));
        }}
        onDragLeave={(event) => {
          if (!draggedTaskId) return;
          const nextTarget = event.relatedTarget as Node | null;
          if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
            setDropPreviewMinute(null);
          }
        }}
        onDrop={(event) => {
          if (!draggedTaskId || !onTaskDropAt) return;
          event.preventDefault();
          const minute = getMinuteFromPointer(event.clientY, event.currentTarget as HTMLDivElement);
          const nearest = getNearestAvailableMinute(minute);
          setDropPreviewMinute(null);
          if (nearest == null) return;
          onTaskDropAt(dropDate, nearest, dropAssigneeId);
        }}
      >
        {showGridLines && (
          <div className="pointer-events-none absolute inset-0 z-[5]">
            <div className="absolute inset-x-0 top-0 border-t border-[#C3CEDC]" />
            {slotOffsetMinutes.map((minute) => (
              <div
                key={`task-slot-grid-${hour}-${minute}`}
                className="absolute inset-x-0 border-t border-[#E9EDF3]"
                style={{ top: `${(minute / 60) * 100}%` }}
              />
            ))}
            {isLastVisibleHour && (
              <div className="absolute inset-x-0 top-full border-t border-[#C3CEDC]" />
            )}
          </div>
        )}
        {draggedTaskId &&
          availabilitySegments.map((segment, index) => (
            <div
              key={`task-drop-availability-${index}-${segment.top}`}
              className="pointer-events-none absolute left-1 right-1 z-10 rounded-xl border border-grey-light bg-[rgba(42,168,121,0.12)]"
              style={{
                top: segment.top,
                height: segment.height,
              }}
            />
          ))}
        {draggedTaskId && dropPreviewMinute != null && (
          <div
            className="pointer-events-none absolute left-1 right-1 z-[15]"
            style={{
              top: ((dropPreviewMinute - hourStartMinute) / 60) * height,
            }}
          >
            <div
              className="rounded-xl border-2 border-dashed border-grey-light bg-[rgba(36,122,237,0.18)]"
              style={{
                height: Math.max(12, (Math.max(5, draggedTaskDurationMinutes) / 60) * height),
              }}
            >
              <div className="h-full w-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
                {draggedTaskLabel || 'Task'}
              </div>
            </div>
          </div>
        )}

        {laidOutEvents.map(({ task, top, laneIndex, laneCount }, eventIndex) => {
          const widthPercent = 100 / laneCount;
          const leftPercent = laneIndex * widthPercent;
          const markerHeight = isZoomOutMode
            ? Math.max(8, Math.min(12, (TASK_BLOCK_DURATION_MINUTES / 60) * height))
            : Math.max(44, (TASK_BLOCK_DURATION_MINUTES / 60) * height - 2);
          const isCompact = !isZoomOutMode && laneCount > 1;
          const taskKey = task._id || `${task.name}-${String(task.dueAt)}-${eventIndex}`;

          return (
            <div
              key={taskKey}
              className="group absolute px-1.5 z-20"
              style={{
                top,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: markerHeight,
              }}
            >
              <button
                type="button"
                className={`h-full w-full text-left ${
                  isZoomOutMode
                    ? 'rounded-full! overflow-hidden px-0 py-0 border border-transparent'
                    : `rounded-2xl! overflow-hidden ${isCompact ? 'px-1.5 py-1' : 'px-2 py-1.5'} flex flex-col justify-between`
                }`}
                style={{
                  ...getStatusStyle(task.status),
                  borderColor: isZoomOutMode ? 'rgba(0,0,0,0.08)' : undefined,
                  borderRadius: isZoomOutMode ? 9999 : 16,
                }}
                onClick={() => handleViewTask(task)}
                draggable={!!canDragTask?.(task)}
                onMouseEnter={(event) =>
                  openPopover(taskKey, event.currentTarget, event.clientX, event.clientY)
                }
                onMouseMove={(event) =>
                  openPopover(taskKey, event.currentTarget, event.clientX, event.clientY)
                }
                onMouseLeave={schedulePopoverClose}
                onFocus={(event) => openPopover(taskKey, event.currentTarget)}
                onBlur={schedulePopoverClose}
                onDragStart={() => onTaskDragStart?.(task)}
                onDragEnd={() => {
                  setDropPreviewMinute(null);
                  onTaskDragEnd?.();
                }}
              >
                {!isZoomOutMode ? (
                  <>
                    <div
                      className={`text-caption-1 text-white truncate ${isCompact ? 'text-center' : ''}`}
                    >
                      {task.name || '-'}
                    </div>
                    {!isCompact && (
                      <>
                        <div className="text-[10px] text-white/90 truncate">
                          From: {resolveDisplayName(task.assignedBy)}
                        </div>
                        <div className="text-[10px] text-white/90 truncate">
                          To: {resolveDisplayName(task.assignedTo)}
                        </div>
                      </>
                    )}
                    <div
                      className={`text-[10px] text-white/90 truncate ${isCompact ? 'text-center' : ''}`}
                    >
                      Due:{' '}
                      {formatDateInPreferredTimeZone(new Date(task.dueAt), {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </>
                ) : null}
              </button>

              {!isZoomOutMode && (
                <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="View task"
                    className="h-6 w-6 rounded-full bg-white/95 border border-card-border flex items-center justify-center cursor-pointer"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleViewTask(task);
                    }}
                  >
                    <IoEyeOutline size={12} color="#302F2E" />
                  </button>
                  {canEditTasks && onQuickStatusChange && task.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      title="Mark completed"
                      className="h-6 w-6 rounded-full bg-white/95 border border-card-border flex items-center justify-center cursor-pointer"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onQuickStatusChange(task, 'COMPLETED');
                      }}
                    >
                      <FaCheckCircle size={11} color="#2AA879" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isMounted && activeTask && activePopoverKey
        ? createPortal(
            <dialog
              ref={popoverDialogRef}
              open
              className="fixed z-[1000] m-0 rounded-2xl border border-card-border bg-white p-4 shadow-[0_8px_30px_0_rgba(0,0,0,0.2)] outline-none"
              style={getPopoverStyle()}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={schedulePopoverClose}
              onFocus={clearCloseTimer}
              onBlur={schedulePopoverClose}
            >
              <div className="flex flex-col gap-2 min-w-[280px]">
                <div className="text-body-4-emphasis text-text-primary">
                  {activeTask.name || '-'}
                </div>
                <div className="text-caption-2 text-text-secondary">
                  Status: {String(activeTask.status || '').replace('_', ' ')}
                </div>
                <div className="text-caption-2 text-text-secondary">
                  From: {resolveDisplayName(activeTask.assignedBy)}
                </div>
                <div className="text-caption-2 text-text-secondary">
                  To: {resolveDisplayName(activeTask.assignedTo)}
                </div>
                <div className="text-caption-2 text-text-secondary">
                  Due date:{' '}
                  {formatDateInPreferredTimeZone(new Date(activeTask.dueAt), {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-caption-2 text-text-secondary">
                  Due time:{' '}
                  {formatDateInPreferredTimeZone(new Date(activeTask.dueAt), {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </dialog>,
            document.body
          )
        : null}
    </>
  );
};

export default TaskSlot;
