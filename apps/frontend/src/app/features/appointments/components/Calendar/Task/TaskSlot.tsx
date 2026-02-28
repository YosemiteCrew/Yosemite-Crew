import React, { useMemo, useState } from "react";
import { IoEyeOutline } from "react-icons/io5";
import { FaCheckCircle } from "react-icons/fa";
import { getStatusStyle } from "@/app/ui/tables/Tasks";
import { Task, TaskStatus } from "@/app/features/tasks/types/task";
import { useMemberMap } from "@/app/hooks/useMemberMap";

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
}: TaskSlotProps) => {
  const { resolveMemberName } = useMemberMap();
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const resolvedDayIndex = dayIndex ?? index ?? 0;
  const hourStartMinute = hour * 60;
  const hourEndMinute = hourStartMinute + 60;
  const TASK_BLOCK_DURATION_MINUTES = 30;

  const availabilitySegments = useMemo(() => {
    const duration = Math.max(5, draggedTaskDurationMinutes);
    return dropAvailabilityIntervals
      .map((interval) => {
        const segmentStart = Math.max(hourStartMinute, interval.startMinute);
        const segmentEnd = Math.min(hourEndMinute, interval.endMinute + duration);
        if (segmentEnd <= segmentStart) return null;
        const top = ((segmentStart - hourStartMinute) / 60) * height;
        const segmentHeight = Math.max(
          6,
          ((segmentEnd - segmentStart) / 60) * height
        );
        return { top, height: segmentHeight };
      })
      .filter(Boolean) as Array<{ top: number; height: number }>;
  }, [draggedTaskDurationMinutes, dropAvailabilityIntervals, height, hourEndMinute, hourStartMinute]);

  const laidOutEvents = useMemo(() => {
    const sorted = [...slotEvents].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
    const laneEnds: number[] = [];
    const laidOut = sorted.map((task) => {
      const dueAt = new Date(task.dueAt);
      const taskStartMinute = hourStartMinute + dueAt.getMinutes();
      let laneIndex = 0;
      while (
        laneIndex < laneEnds.length &&
        laneEnds[laneIndex] > taskStartMinute
      ) {
        laneIndex += 1;
      }
      const blockEnd = taskStartMinute + TASK_BLOCK_DURATION_MINUTES;
      laneEnds[laneIndex] = blockEnd;
      return {
        task,
        laneIndex,
        top: ((dueAt.getMinutes() / 60) * height),
      };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return laidOut.map((item) => ({ ...item, laneCount }));
  }, [height, hourStartMinute, slotEvents]);

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
      const candidateMinute = Math.max(
        interval.startMinute,
        Math.min(interval.endMinute, snapped)
      );
      const distance = Math.abs(minute - candidateMinute);
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { minute: candidateMinute, distance };
      }
    }
    if (!bestMatch || bestMatch.distance > DROP_TOLERANCE_MINUTES) return null;
    return bestMatch.minute;
  };

  return (
    <div
      className={`relative bg-white border-l border-grey-light ${resolvedDayIndex === length ? "border-r" : ""}`}
      style={{ height: `${height}px` }}
      onDragOver={(event) => {
        if (!draggedTaskId) return;
        event.preventDefault();
        onDragHoverTarget?.(dropDate, dropAssigneeId);
        const minute = getMinuteFromPointer(
          event.clientY,
          event.currentTarget as HTMLDivElement
        );
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
        const minute = getMinuteFromPointer(
          event.clientY,
          event.currentTarget as HTMLDivElement
        );
        const nearest = getNearestAvailableMinute(minute);
        setDropPreviewMinute(null);
        if (nearest == null) return;
        onTaskDropAt(dropDate, nearest, dropAssigneeId);
      }}
    >
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
              height: Math.max(
                12,
                ((Math.max(5, draggedTaskDurationMinutes) / 60) * height)
              ),
            }}
          >
            <div className="h-full w-full flex items-center justify-center px-2 text-caption-1 text-text-brand truncate">
              {draggedTaskLabel || "Task"}
            </div>
          </div>
        </div>
      )}

      {laidOutEvents.map(({ task, top, laneIndex, laneCount }, eventIndex) => {
        const widthPercent = 100 / laneCount;
        const leftPercent = laneIndex * widthPercent;
        return (
          <div
            key={task._id || `${task.name}-${String(task.dueAt)}-${eventIndex}`}
            className="group absolute px-1.5 z-20"
            style={{
              top,
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              height: Math.max(44, (TASK_BLOCK_DURATION_MINUTES / 60) * height - 2),
            }}
          >
            <button
              type="button"
              className="h-full w-full rounded-xl px-2 py-1.5 text-left flex flex-col justify-between"
              style={getStatusStyle(task.status)}
              onClick={() => handleViewTask(task)}
              draggable={!!canDragTask?.(task)}
              onDragStart={() => onTaskDragStart?.(task)}
              onDragEnd={() => {
                setDropPreviewMinute(null);
                onTaskDragEnd?.();
              }}
            >
              <div className="text-caption-1 text-white truncate">{task.name}</div>
              <div className="text-caption-2 text-white/90 truncate">
                {resolveMemberName(task.assignedTo)}
              </div>
            </button>

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
              {canEditTasks &&
                onQuickStatusChange &&
                task.status !== "COMPLETED" && (
                  <button
                    type="button"
                    title="Mark completed"
                    className="h-6 w-6 rounded-full bg-white/95 border border-card-border flex items-center justify-center cursor-pointer"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onQuickStatusChange(task, "COMPLETED");
                    }}
                  >
                    <FaCheckCircle size={11} color="#2AA879" />
                  </button>
                )}
            </div>
          </div>
        );
      })}
      {!laidOutEvents.length && !draggedTaskId && (
        <div
          className="absolute inset-0 flex items-center justify-center text-caption-1 text-text-primary"
          style={{ height: `${height}px` }}
        >
          No tasks available
        </div>
      )}
    </div>
  );
};

export default TaskSlot;
