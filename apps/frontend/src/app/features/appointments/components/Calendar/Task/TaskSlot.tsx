import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoEyeOutline } from 'react-icons/io5';
import { getStatusStyle } from '@/app/ui/tables/Tasks';
import { Task } from '@/app/features/tasks/types/task';
import { autoScrollCalendarHorizontally } from '@/app/features/appointments/components/Calendar/helpers';
import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { createPortal } from 'react-dom';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { MdOutlineAutorenew } from 'react-icons/md';
import { IoIosCalendar } from 'react-icons/io';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getTaskQuickDetails,
  getTaskStatusLabel,
} from '@/app/lib/tasks';

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type TaskSlotProps = {
  slotEvents: Task[];
  handleViewTask: (task: Task) => void;
  handleChangeStatusTask?: (task: Task) => void;
  handleRescheduleTask?: (task: Task) => void;
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
  onCreateTaskAt?: (date: Date, minuteOfDay: number, targetAssigneeId?: string) => void;
  onDragHoverTarget?: (date: Date, targetAssigneeId?: string) => void;
  dropAvailabilityIntervals?: DropAvailabilityInterval[];
  draggedTaskDurationMinutes?: number;
  zoomMode?: CalendarZoomMode;
  showGridLines?: boolean;
  slotOffsetMinutes?: number[];
  isLastVisibleHour?: boolean;
  resolveDisplayName?: (memberId?: string) => string;
};

const TaskSlot = ({
  slotEvents,
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
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
  onCreateTaskAt,
  onDragHoverTarget,
  dropAvailabilityIntervals = [],
  draggedTaskDurationMinutes = 30,
  zoomMode = 'in',
  showGridLines = false,
  slotOffsetMinutes = [],
  isLastVisibleHour = false,
  resolveDisplayName,
}: TaskSlotProps) => {
  const isZoomOutMode = zoomMode === 'out';
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [activeCursor, setActiveCursor] = useState<{ x: number; y: number } | null>(null);
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedDayIndex = dayIndex ?? index ?? 0;
  const hourStartMinute = hour * 60;
  const hourEndMinute = hourStartMinute + 60;
  const TASK_BLOCK_DURATION_MINUTES = 30;

  const getDisplayName = useCallback(
    (memberId?: string) => {
      const raw = String(memberId ?? '').trim();
      if (!raw) return '-';
      const resolved = resolveDisplayName?.(raw);
      return resolved && resolved !== '-' ? resolved : raw;
    },
    [resolveDisplayName]
  );

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
    const popoverWidth = 304;
    const popoverHeight = 248;
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

  const createTaskAtMinute = (clientY: number, container: HTMLDivElement) => {
    if (!onCreateTaskAt || draggedTaskId) return;
    const minute = getMinuteFromPointer(clientY, container);
    onCreateTaskAt(dropDate, Math.round(minute / 5) * 5, dropAssigneeId);
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
        {onCreateTaskAt && !draggedTaskId ? (
          <button
            type="button"
            aria-label="Create task in this calendar slot"
            className="absolute inset-0 z-[1] rounded-none!"
            onClick={(event) => {
              createTaskAtMinute(
                event.clientY,
                event.currentTarget.parentElement as HTMLDivElement
              );
            }}
            onDoubleClick={(event) => {
              createTaskAtMinute(
                event.clientY,
                event.currentTarget.parentElement as HTMLDivElement
              );
            }}
          />
        ) : null}
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
          const compactPaddingClass = isCompact ? 'px-1.5 py-1' : 'px-2 py-1.5';
          const markerClassName = isZoomOutMode
            ? 'h-full w-full text-left rounded-full! overflow-hidden px-0 py-0 border border-transparent'
            : `h-full w-full text-left rounded-2xl! overflow-hidden ${compactPaddingClass} flex flex-col justify-between`;
          const taskKey = task._id || `${task.name}-${String(task.dueAt)}-${eventIndex}`;
          const dueTimeLabel = formatDateInPreferredTimeZone(new Date(task.dueAt), {
            hour: 'numeric',
            minute: '2-digit',
          });
          const markerTitle = `${task.name || 'Task'} • Due ${dueTimeLabel}`;

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
                className={markerClassName}
                style={{
                  ...getStatusStyle(task.status),
                  borderColor: isZoomOutMode ? 'rgba(0,0,0,0.08)' : undefined,
                  borderRadius: isZoomOutMode ? 9999 : 16,
                }}
                title={markerTitle}
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
                {isZoomOutMode ? null : (
                  <>
                    <div
                      className={`text-caption-1 text-white truncate ${isCompact ? 'text-center' : ''}`}
                    >
                      {task.name || '-'}
                    </div>
                    <div
                      className={`text-[10px] text-white/90 truncate ${isCompact ? 'text-center' : ''}`}
                    >
                      Due: {dueTimeLabel}
                    </div>
                  </>
                )}
              </button>

              <div
                className={`absolute flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                  isZoomOutMode ? '-top-1 right-0' : 'top-1 right-1'
                }`}
              >
                <button
                  type="button"
                  title="View task"
                  className="h-6 w-6 rounded-full bg-white/95 border border-card-border flex items-center justify-center cursor-pointer shadow-sm"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleViewTask(task);
                  }}
                >
                  <IoEyeOutline size={12} color="#302F2E" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeTask && activePopoverKey && typeof document !== 'undefined'
        ? createPortal(
            <dialog
              ref={popoverDialogRef}
              open
              className="fixed z-[1000] m-0 box-border w-[304px] max-w-[calc(100vw-16px)] rounded-2xl border border-card-border bg-white p-3 shadow-[0_8px_24px_0_rgba(0,0,0,0.16)] outline-none"
              style={getPopoverStyle()}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={schedulePopoverClose}
              onFocus={clearCloseTimer}
              onBlur={schedulePopoverClose}
            >
              <div className="flex min-w-0 w-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-4-emphasis text-text-primary">
                      {activeTask.name || '-'}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-4 text-text-secondary">
                      Due{' '}
                      {formatDateInPreferredTimeZone(new Date(activeTask.dueAt), {
                        month: 'short',
                        day: '2-digit',
                      })}
                      {' • '}
                      {formatDateInPreferredTimeZone(new Date(activeTask.dueAt), {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] leading-4 font-medium text-white whitespace-nowrap"
                    style={{
                      backgroundColor:
                        getStatusStyle(activeTask.status).backgroundColor || '#1a73e8',
                    }}
                  >
                    {getTaskStatusLabel(activeTask.status)}
                  </span>
                </div>
                <div className="grid min-w-0 grid-cols-[auto,minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl border border-card-border bg-card-hover px-2.5 py-2">
                  <div className="text-[11px] leading-4 text-text-secondary">From</div>
                  <div className="min-w-0 text-[11px] leading-4 text-right text-text-primary truncate">
                    {getDisplayName(activeTask.assignedBy)}
                  </div>
                  <div className="text-[11px] leading-4 text-text-secondary">To</div>
                  <div className="min-w-0 text-[11px] leading-4 text-right text-text-primary truncate">
                    {getDisplayName(activeTask.assignedTo)}
                  </div>
                  <div className="text-[11px] leading-4 text-text-secondary">Category</div>
                  <div className="min-w-0 text-[11px] leading-4 text-right text-text-primary truncate">
                    {activeTask.category || '-'}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {getTaskQuickDetails(activeTask)
                    .slice(0, 2)
                    .map((detail) => (
                      <div key={detail.label} className="flex min-w-0 items-start gap-2">
                        <div className="w-16 shrink-0 text-[11px] leading-4 text-text-secondary">
                          {detail.label}
                        </div>
                        <div className="min-w-0 flex-1 text-[11px] leading-4 text-text-primary line-clamp-2">
                          {detail.value}
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center justify-end gap-1.5 border-t border-card-border pt-2">
                  <GlassTooltip content="View task" side="top">
                    <button
                      type="button"
                      title="View task"
                      className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                      onClick={() => {
                        handleViewTask(activeTask);
                        setActivePopoverKey(null);
                      }}
                    >
                      <IoEyeOutline size={16} />
                    </button>
                  </GlassTooltip>
                  {canEditTasks && canShowTaskStatusChangeAction(activeTask.status) && (
                    <GlassTooltip content="Change status" side="top">
                      <button
                        type="button"
                        title="Change status"
                        className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                        onClick={() => {
                          handleChangeStatusTask?.(activeTask);
                          setActivePopoverKey(null);
                        }}
                      >
                        <MdOutlineAutorenew size={16} />
                      </button>
                    </GlassTooltip>
                  )}
                  {canEditTasks && canRescheduleTask(activeTask.status) && (
                    <GlassTooltip content="Reschedule" side="top">
                      <button
                        type="button"
                        title="Reschedule"
                        className="h-8 w-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                        onClick={() => {
                          handleRescheduleTask?.(activeTask);
                          setActivePopoverKey(null);
                        }}
                      >
                        <IoIosCalendar size={16} />
                      </button>
                    </GlassTooltip>
                  )}
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
