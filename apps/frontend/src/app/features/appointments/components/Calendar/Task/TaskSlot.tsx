import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { usePopoverManager } from '@/app/hooks/usePopoverManager';
import { Task } from '@/app/features/tasks/types/task';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { createPortal } from 'react-dom';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import {
  autoScrollCalendarHorizontally,
  autoScrollCalendarVertically,
} from '@/app/features/appointments/components/Calendar/helpers';
import { formatDateInPreferredTimeZone, getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import TaskSlotGridLines from '@/app/features/appointments/components/Calendar/Task/TaskSlotGridLines';
import TaskDropOverlays from '@/app/features/appointments/components/Calendar/Task/TaskDropOverlays';
import TaskMarker from '@/app/features/appointments/components/Calendar/Task/TaskMarker';
import TaskDetailsPopover from '@/app/features/appointments/components/Calendar/Task/TaskDetailsPopover';
import { TASK_BLOCK_DURATION_MINUTES } from '@/app/features/appointments/components/Calendar/Task/taskMarkerStyles';

const DEFAULT_DROP_AVAILABILITY_INTERVALS: DropAvailabilityInterval[] = [];
const DEFAULT_SLOT_OFFSET_MINUTES: number[] = [];

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
