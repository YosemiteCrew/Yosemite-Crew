import { Task } from '@/app/features/tasks/types/task';
import { IoEyeOutline } from 'react-icons/io5';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import {
  getTaskMarkerStyle,
  TASK_BLOCK_DURATION_MINUTES,
} from '@/app/features/appointments/components/Calendar/Task/taskMarkerStyles';

type TaskMarkerLayout = { top: number; laneIndex: number; laneCount: number };

/** One task block in the hour column, with its hover-revealed view shortcut. */
/**
 * Geometry and classes for one task chip. Pure, and driven only by the two mode
 * flags, so it lives outside TaskMarker rather than adding four more branches
 * to a component that is mostly wiring.
 *
 * The radius is deliberately set in BOTH the `!` utility here and the inline
 * style on the button: they compete, so changing one alone does nothing.
 * cursor-grab because these chips are draggable and used to show a plain arrow,
 * so they did not read as movable; the appointment blocks already do this.
 */
const getTaskMarkerLayout = ({
  isZoomOutMode,
  laneCount,
  canDrag,
  height,
}: {
  isZoomOutMode: boolean;
  laneCount: number;
  canDrag: boolean;
  height: number;
}) => {
  const markerHeight = isZoomOutMode
    ? Math.max(8, Math.min(12, (TASK_BLOCK_DURATION_MINUTES / 60) * height))
    : Math.max(44, (TASK_BLOCK_DURATION_MINUTES / 60) * height - 2);
  const isCompact = !isZoomOutMode && laneCount > 1;
  const cursorClass = canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';
  const paddingClass = isCompact ? 'px-1.5 py-1' : 'px-2 py-1.5';
  const markerClassName = isZoomOutMode
    ? `size-full text-left rounded-full! overflow-hidden p-0 border border-transparent ${cursorClass}`
    : `size-full text-left rounded-xl! overflow-hidden ${paddingClass} flex flex-col justify-between ${cursorClass}`;

  return { markerHeight, isCompact, markerClassName };
};

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
  const { markerHeight, isCompact, markerClassName } = getTaskMarkerLayout({
    isZoomOutMode,
    laneCount,
    canDrag,
    height,
  });
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

export default TaskMarker;
