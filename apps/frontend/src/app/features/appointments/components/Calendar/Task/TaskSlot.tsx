import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { IoEyeOutline, IoSyncOutline } from 'react-icons/io5';
import { Task } from '@/app/features/tasks/types/task';
import {
  autoScrollCalendarHorizontally,
  autoScrollCalendarVertically,
} from '@/app/features/appointments/components/Calendar/helpers';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { createPortal } from 'react-dom';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoIosCalendar } from 'react-icons/io';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getTaskQuickDetails,
  getTaskStatusLabel,
} from '@/app/lib/tasks';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';

const DEFAULT_DROP_AVAILABILITY_INTERVALS: DropAvailabilityInterval[] = [];
const DEFAULT_SLOT_OFFSET_MINUTES: number[] = [];
const TASK_BLOCK_DURATION_MINUTES = 30;

type MarkerStyle = { backgroundColor: string; borderColor: string; color: string };

// Warm-bone status tokens — the week calendar markers read as soft status pills,
// matching the board and the design handoff (no saturated solid blocks).
const TASK_STATUS_MARKER_STYLES: Record<string, MarkerStyle> = {
  PENDING: {
    backgroundColor: 'var(--status-requested-bg)',
    borderColor: 'var(--status-requested-border)',
    color: 'var(--status-requested-text)',
  },
  IN_PROGRESS: {
    backgroundColor: 'var(--status-in-progress-bg)',
    borderColor: 'var(--status-in-progress-border)',
    color: 'var(--status-in-progress-text)',
  },
  COMPLETED: {
    backgroundColor: 'var(--status-completed-bg)',
    borderColor: 'var(--status-completed-border)',
    color: 'var(--status-completed-text)',
  },
  CANCELLED: {
    backgroundColor: 'var(--status-cancelled-bg)',
    borderColor: 'var(--status-cancelled-border)',
    color: 'var(--status-cancelled-text)',
  },
};

// Pink is reserved on this screen for pet-parent tasks only.
const PARENT_MARKER_STYLE: MarkerStyle = {
  backgroundColor: 'var(--screen)',
  borderColor: 'var(--pink)',
  color: 'var(--ink)',
};

const getTaskStatusColors = (status: string): MarkerStyle =>
  TASK_STATUS_MARKER_STYLES[status.toUpperCase()] ?? TASK_STATUS_MARKER_STYLES.PENDING;

const getTaskMarkerStyle = (task: Pick<Task, 'status' | 'audience'>): MarkerStyle =>
  task.audience === 'PARENT_TASK' ? PARENT_MARKER_STYLE : getTaskStatusColors(task.status);

const buildTaskSlotLabels = (dropDate: Date, hour: number) => {
  const dayLabel = formatDateInPreferredTimeZone(dropDate, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = formatDateInPreferredTimeZone(
    new Date(dropDate.getTime() + hour * 60 * 60 * 1000),
    { hour: 'numeric', minute: '2-digit' }
  );
  return {
    createTaskLabel: `Create task on ${dayLabel} at ${timeLabel}`,
    taskSlotLabel: `Tasks slot for ${dayLabel} at ${timeLabel}`,
  };
};

/** Hour rules behind the markers: the hour boundary, each slot step, and the closing rule. */
const TaskSlotGridLines = ({
  hour,
  slotOffsetMinutes,
  isLastVisibleHour,
}: {
  hour: number;
  slotOffsetMinutes: number[];
  isLastVisibleHour: boolean;
}) => (
  // The same rules as common/SlotGridLines.tsx:14-15, which this file's own Week
  // and Team views already render. This private copy was still on the pre-redesign
  // cool ramp: --color-calendar-line-soft is #e9edf3, a COOL grey on the warm bone
  // ground in light, and #302820 in dark - 1.01:1 on the slot surface, so the
  // sub-hour rules simply were not there.
  <div className="pointer-events-none absolute inset-0 z-[5]">
    <div className="absolute inset-x-0 top-0 border-t border-[var(--hairline)]" />
    {slotOffsetMinutes.map((minute) => (
      <div
        key={`task-slot-grid-${hour}-${minute}`}
        className="absolute inset-x-0 border-t"
        style={{
          top: `${(minute / 60) * 100}%`,
          borderTopColor: 'color-mix(in srgb, var(--hairline) 55%, transparent)',
        }}
      />
    ))}
    {isLastVisibleHour && (
      <div className="absolute inset-x-0 top-full border-t border-[var(--hairline)]" />
    )}
  </div>
);

/** Drag affordances: the droppable bands, plus the dashed preview at the landing minute. */
const TaskDropOverlays = ({
  availabilitySegments,
  dropPreviewMinute,
  draggedTaskLabel,
  draggedTaskDurationMinutes,
  hourStartMinute,
  height,
}: {
  availabilitySegments: Array<{ top: number; height: number }>;
  dropPreviewMinute: number | null;
  draggedTaskLabel?: string | null;
  draggedTaskDurationMinutes: number;
  hourStartMinute: number;
  height: number;
}) => (
  <>
    {availabilitySegments.map((segment, index) => (
      <div
        key={`task-drop-availability-${index}-${segment.top}`}
        className="pointer-events-none absolute left-1 right-1 z-10 rounded-xl border border-card-border bg-[var(--color-calendar-availability-overlay)]"
        style={{
          top: segment.top,
          height: segment.height,
        }}
      />
    ))}
    {dropPreviewMinute != null && (
      <div
        className="pointer-events-none absolute left-1 right-1 z-[15]"
        style={{
          top: ((dropPreviewMinute - hourStartMinute) / 60) * height,
        }}
      >
        <div
          className="rounded-xl border-2 border-dashed border-card-border bg-[var(--color-calendar-preview-overlay)]"
          style={{
            height: Math.max(12, (Math.max(5, draggedTaskDurationMinutes) / 60) * height),
          }}
        >
          <div className="size-full flex items-center justify-center px-2 text-caption-1 text-blue-text truncate">
            {draggedTaskLabel || 'Task'}
          </div>
        </div>
      </div>
    )}
  </>
);

type TaskMarkerLayout = { top: number; laneIndex: number; laneCount: number };

/** One task block in the hour column, with its hover-revealed view shortcut. */
/**
 * Exported for its story. The task chip is the calendar's most-repeated object
 * and had drifted a long way from the appointment block it sits beside, so it is
 * worth being able to see it on its own in both themes.
 */
export const TaskMarker = ({
  task,
  layout,
  height,
  isZoomOutMode,
  isActive,
  popoverId,
  canDrag,
  onView,
  onOpenPopover,
  onFocusPopover,
  onClosePopover,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  layout: TaskMarkerLayout;
  height: number;
  isZoomOutMode: boolean;
  isActive: boolean;
  popoverId: string;
  canDrag: boolean;
  onView: () => void;
  onOpenPopover: (target: HTMLButtonElement, clientX: number, clientY: number) => void;
  onFocusPopover: (target: HTMLButtonElement) => void;
  onClosePopover: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) => {
  const { top, laneIndex, laneCount } = layout;
  const widthPercent = 100 / laneCount;
  const leftPercent = laneIndex * widthPercent;
  const markerHeight = isZoomOutMode
    ? Math.max(8, Math.min(12, (TASK_BLOCK_DURATION_MINUTES / 60) * height))
    : Math.max(44, (TASK_BLOCK_DURATION_MINUTES / 60) * height - 2);
  const isCompact = !isZoomOutMode && laneCount > 1;
  const compactPaddingClass = isCompact ? 'px-1.5 py-1' : 'px-2 py-1.5';
  // 12px, matching common/ZoomInMarker.tsx:111. The radius is set in TWO places -
  // this `!` utility and the inline style on the button below - so changing one
  // alone does nothing. The zoomed-out lozenge keeps its pill shape.
  // cursor-grab: these cards are draggable and showed a plain arrow, so they did
  // not read as movable at all; the appointment blocks already do this.
  const cursorClass = canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';
  const markerClassName = isZoomOutMode
    ? `size-full text-left rounded-full! overflow-hidden p-0 border border-transparent ${cursorClass}`
    : `size-full text-left rounded-xl! overflow-hidden ${compactPaddingClass} flex flex-col justify-between ${cursorClass}`;
  const dueTimeLabel = formatDateInPreferredTimeZone(new Date(task.dueAt), {
    hour: 'numeric',
    minute: '2-digit',
  });
  const markerTitle = `${task.name || 'Task'} • Due ${dueTimeLabel}`;
  const markerStyle = getTaskMarkerStyle(task);
  const isParentTask = task.audience === 'PARENT_TASK';
  const isCompletedTask = task.status.toUpperCase() === 'COMPLETED';

  return (
    <div
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
        aria-haspopup="dialog"
        aria-expanded={isActive}
        aria-controls={popoverId}
        style={{
          backgroundColor: markerStyle.backgroundColor,
          border: `1px solid ${markerStyle.borderColor}`,
          color: markerStyle.color,
          borderRadius: isZoomOutMode ? 9999 : 12,
          // The appointment block is FLAT over a 1px status outline thickened to a
          // 3px spine on the leading edge; this carried a drop shadow and a plain
          // 1px border all round, which is most of why the two calendars' events
          // read as different objects. The parent-task glow stays: that is a
          // semantic signal (pet-parent task), not chrome.
          borderLeftWidth: isZoomOutMode ? undefined : '3px',
          boxShadow: isParentTask ? '0 4px 12px var(--glow-p12)' : undefined,
        }}
        title={markerTitle}
        onClick={onView}
        draggable={canDrag}
        onMouseEnter={(event) => onOpenPopover(event.currentTarget, event.clientX, event.clientY)}
        onMouseMove={(event) => onOpenPopover(event.currentTarget, event.clientX, event.clientY)}
        onMouseLeave={onClosePopover}
        onFocus={(event) => onFocusPopover(event.currentTarget)}
        onBlur={onClosePopover}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {isZoomOutMode ? null : (
          <>
            <div
              className={`truncate text-[12.5px] font-bold leading-[1.2] tracking-[-0.25px] ${
                isCompact ? 'text-center' : ''
              } ${isCompletedTask ? 'line-through' : ''}`}
              style={{ color: markerStyle.color }}
            >
              {isParentTask && (
                <span
                  aria-hidden="true"
                  className="mr-1 inline-block size-1.5 rounded-full align-middle"
                  style={{ backgroundColor: 'var(--pink)' }}
                />
              )}
              {task.name || '-'}
            </div>
            <div
              // 11px, matching the appointment block's subtitle recipe
              // (common/ZoomInMarker.tsx:63). font-normal against the title's new
              // 700 is what separates them now, rather than a size drop to 10px.
              className={`truncate font-satoshi text-[11px] font-normal leading-[1.2] tracking-[-0.22px] ${
                isCompact ? 'text-center' : ''
              }`}
              // No alpha: markerStyle.color is a status token measured against
              // its own fill, and 0.8 took this 10px line to 3.98:1. The line is
              // already quieter than the task name by size alone.
              style={{ color: markerStyle.color }}
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
          aria-label="View task"
          className="size-6 rounded-full bg-neutral-0/95 border border-card-border flex items-center justify-center cursor-pointer shadow-sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onView();
          }}
        >
          <IoEyeOutline size={12} color="var(--color-neutral-900)" />
        </button>
      </div>
    </div>
  );
};

/** Tooltip + round button — the shape every popover footer action shares. */
const TaskPopoverActionButton = ({
  tooltip,
  label,
  onPress,
  children,
}: {
  tooltip: string;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <GlassTooltip content={tooltip} side="top">
    <button
      type="button"
      title={tooltip}
      aria-label={label}
      className="size-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
      onClick={onPress}
    >
      {children}
    </button>
  </GlassTooltip>
);

/** Hover/focus detail card for one task: header, from/to/category grid, and actions. */
const TaskDetailsPopover = ({
  task,
  popoverId,
  titleId,
  dialogRef,
  style,
  canEditTasks,
  getDisplayName,
  onView,
  onChangeStatus,
  onReschedule,
  onDismiss,
  clearCloseTimer,
  schedulePopoverClose,
}: {
  task: Task;
  popoverId: string;
  titleId: string;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  style: React.CSSProperties;
  canEditTasks: boolean;
  getDisplayName: (memberId?: string) => string;
  onView: () => void;
  onChangeStatus: () => void;
  onReschedule: () => void;
  onDismiss: () => void;
  clearCloseTimer: () => void;
  schedulePopoverClose: () => void;
}) => (
  <dialog
    id={popoverId}
    ref={dialogRef}
    open
    className="fixed z-[1000] m-0 box-border w-[304px] max-w-[calc(100vw-16px)] rounded-2xl border border-card-border bg-neutral-0 p-3 shadow-[0_8px_24px_0_rgba(0,0,0,0.16)] outline-none"
    style={style}
    aria-labelledby={titleId}
    aria-modal="false"
    data-popover-panel="true"
    tabIndex={-1}
    onMouseEnter={clearCloseTimer}
    onMouseLeave={schedulePopoverClose}
    onFocus={clearCloseTimer}
    onBlur={schedulePopoverClose}
    onCancel={(event) => {
      event.preventDefault();
      onDismiss();
    }}
  >
    <div className="flex min-w-0 w-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div id={titleId} className="truncate text-body-4-emphasis text-text-primary">
            {task.name || '-'}
          </div>
          <div className="mt-0.5 text-[11px] leading-4 text-text-secondary">
            Due{' '}
            {formatDateInPreferredTimeZone(new Date(task.dueAt), {
              month: 'short',
              day: '2-digit',
            })}
            {' • '}
            {formatDateInPreferredTimeZone(new Date(task.dueAt), {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] leading-4 font-semibold whitespace-nowrap"
          style={{
            backgroundColor: getTaskStatusColors(task.status).backgroundColor,
            border: `1px solid ${getTaskStatusColors(task.status).borderColor}`,
            color: getTaskStatusColors(task.status).color,
          }}
        >
          {getTaskStatusLabel(task.status)}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-[auto,minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl border border-card-border bg-card-hover px-2.5 py-2">
        <div className="text-[11px] leading-4 text-text-secondary">From</div>
        <div className="min-w-0 text-[11px] leading-4 text-right text-text-primary truncate">
          {getDisplayName(task.assignedBy)}
        </div>
        <div className="text-[11px] leading-4 text-text-secondary">To</div>
        <div className="min-w-0 text-[11px] leading-4 text-right text-text-primary truncate">
          {getDisplayName(task.assignedTo)}
        </div>
        <div className="text-[11px] leading-4 text-text-secondary">Category</div>
        <div className="min-w-0 text-[11px] leading-4 text-right text-text-primary truncate">
          {task.category || '-'}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {getTaskQuickDetails(task)
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
        <TaskPopoverActionButton tooltip="View task" label="View task" onPress={onView}>
          <IoEyeOutline size={16} aria-hidden="true" />
        </TaskPopoverActionButton>
        {canEditTasks && canShowTaskStatusChangeAction(task.status) && (
          <TaskPopoverActionButton
            tooltip="Change status"
            label="Change task status"
            onPress={onChangeStatus}
          >
            <IoSyncOutline size={16} aria-hidden="true" />
          </TaskPopoverActionButton>
        )}
        {canEditTasks && canRescheduleTask(task.status) && (
          <TaskPopoverActionButton
            tooltip="Reschedule"
            label="Reschedule task"
            onPress={onReschedule}
          >
            <IoIosCalendar size={16} aria-hidden="true" />
          </TaskPopoverActionButton>
        )}
      </div>
    </div>
  </dialog>
);

type TaskSlotProps = {
  slotEvents: Task[];
  handleViewTask: (task: Task) => void;
  handleChangeStatusTask?: (task: Task) => void;
  handleRescheduleTask?: (task: Task) => void;
  permissions?: {
    canEditTasks?: boolean;
  };
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
  layout?: {
    showGridLines?: boolean;
    slotOffsetMinutes?: number[];
    isLastVisibleHour?: boolean;
  };
  resolveDisplayName?: (memberId?: string) => string;
};

const TaskSlot = ({
  slotEvents,
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
  permissions,
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
  dropAvailabilityIntervals = DEFAULT_DROP_AVAILABILITY_INTERVALS,
  draggedTaskDurationMinutes = 30,
  zoomMode = 'in',
  layout,
  resolveDisplayName,
}: TaskSlotProps) => {
  const canEditTasks = permissions?.canEditTasks ?? false;
  const showGridLines = layout?.showGridLines ?? false;
  const slotOffsetMinutes = layout?.slotOffsetMinutes ?? DEFAULT_SLOT_OFFSET_MINUTES;
  const isLastVisibleHour = layout?.isLastVisibleHour ?? false;
  const isZoomOutMode = zoomMode === 'out';
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const {
    activePopoverKey,
    setActivePopoverKey,
    popoverDialogRef,
    clearCloseTimer,
    schedulePopoverClose,
    openPopover,
    getPopoverStyle,
  } = usePopoverManager();
  const resolvedDayIndex = dayIndex ?? index ?? 0;
  const taskPopoverTitleId = useId();
  const taskPopoverId = useId();
  const hourStartMinute = hour * 60;
  const hourEndMinute = hourStartMinute + 60;

  const getDisplayName = useCallback(
    (memberId?: string) => {
      const raw = String(memberId ?? '').trim();
      if (!raw) return '-';
      const resolved = resolveDisplayName?.(raw);
      return resolved && resolved !== '-' ? resolved : raw;
    },
    [resolveDisplayName]
  );

  const { createTaskLabel, taskSlotLabel } = buildTaskSlotLabels(dropDate, hour);

  useEffect(() => {
    if (!draggedTaskId) return;
    setActivePopoverKey(null);
  }, [draggedTaskId, setActivePopoverKey]);

  const handleOpenPopover = (
    key: string,
    target: HTMLButtonElement,
    clientX?: number,
    clientY?: number
  ): void => openPopover(key, target, draggedTaskId, clientX, clientY);

  const popoverStyle = getPopoverStyle(304, 248);

  const availabilitySegments = useMemo(() => {
    const duration = Math.max(5, draggedTaskDurationMinutes);
    return dropAvailabilityIntervals.flatMap((interval) => {
      const segmentStart = Math.max(hourStartMinute, interval.startMinute);
      const segmentEnd = Math.min(hourEndMinute, interval.endMinute + duration);
      if (segmentEnd <= segmentStart) return [];
      const top = ((segmentStart - hourStartMinute) / 60) * height;
      const segmentHeight = Math.max(6, ((segmentEnd - segmentStart) / 60) * height);
      return [{ top, height: segmentHeight }];
    });
  }, [
    draggedTaskDurationMinutes,
    dropAvailabilityIntervals,
    height,
    hourEndMinute,
    hourStartMinute,
  ]);

  const laidOutEvents = useMemo(() => {
    const sorted = slotEvents.toSorted(
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

  const getNearestAvailableMinute = (minute: number) =>
    calcNearestAvailableMinute(minute, dropAvailabilityIntervals);

  const createTaskAtMinute = (clientY: number, container: HTMLDivElement) => {
    if (!onCreateTaskAt || draggedTaskId) return;
    const minute = getMinuteFromPointer(clientY, container);
    onCreateTaskAt(dropDate, Math.round(minute / 5) * 5, dropAssigneeId);
  };

  return (
    <>
      <section
        aria-label={taskSlotLabel}
        className={`relative bg-neutral-0 border-l border-card-border ${
          resolvedDayIndex === length ? 'border-r' : ''
        }`}
        style={{ height: `${height}px` }}
        onDragOver={(event) => {
          if (!draggedTaskId) return;
          event.preventDefault();
          autoScrollCalendarHorizontally(event.clientX, event.currentTarget);
          autoScrollCalendarVertically(event.clientY, event.currentTarget);
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
            aria-label={createTaskLabel}
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
          <TaskSlotGridLines
            hour={hour}
            slotOffsetMinutes={slotOffsetMinutes}
            isLastVisibleHour={isLastVisibleHour}
          />
        )}
        {draggedTaskId && (
          <TaskDropOverlays
            availabilitySegments={availabilitySegments}
            dropPreviewMinute={dropPreviewMinute}
            draggedTaskLabel={draggedTaskLabel}
            draggedTaskDurationMinutes={draggedTaskDurationMinutes}
            hourStartMinute={hourStartMinute}
            height={height}
          />
        )}

        {laidOutEvents.map(({ task, top, laneIndex, laneCount }, eventIndex) => {
          const taskKey = task._id || `${task.name}-${String(task.dueAt)}-${eventIndex}`;
          return (
            <TaskMarker
              key={taskKey}
              task={task}
              layout={{ top, laneIndex, laneCount }}
              height={height}
              isZoomOutMode={isZoomOutMode}
              isActive={activePopoverKey === taskKey}
              popoverId={taskPopoverId}
              canDrag={!!canDragTask?.(task)}
              onView={() => handleViewTask(task)}
              onOpenPopover={(target, clientX, clientY) =>
                handleOpenPopover(taskKey, target, clientX, clientY)
              }
              onFocusPopover={(target) =>
                openPopover(taskKey, target, draggedTaskId, undefined, undefined, 'focus')
              }
              onClosePopover={schedulePopoverClose}
              onDragStart={() => onTaskDragStart?.(task)}
              onDragEnd={() => {
                setDropPreviewMinute(null);
                onTaskDragEnd?.();
              }}
            />
          );
        })}
      </section>

      {activeTask && activePopoverKey && typeof document !== 'undefined'
        ? createPortal(
            <TaskDetailsPopover
              task={activeTask}
              popoverId={taskPopoverId}
              titleId={taskPopoverTitleId}
              dialogRef={popoverDialogRef}
              style={popoverStyle}
              canEditTasks={canEditTasks}
              getDisplayName={getDisplayName}
              onView={() => {
                handleViewTask(activeTask);
                setActivePopoverKey(null);
              }}
              onChangeStatus={() => {
                handleChangeStatusTask?.(activeTask);
                setActivePopoverKey(null);
              }}
              onReschedule={() => {
                handleRescheduleTask?.(activeTask);
                setActivePopoverKey(null);
              }}
              onDismiss={() => setActivePopoverKey(null)}
              clearCloseTimer={clearCloseTimer}
              schedulePopoverClose={schedulePopoverClose}
            />,
            document.body
          )
        : null}
    </>
  );
};

export default TaskSlot;
