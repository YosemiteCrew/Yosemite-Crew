import React from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { IoIosCalendar } from 'react-icons/io';
import { IoEyeOutline, IoSyncOutline } from 'react-icons/io5';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getTaskQuickDetails,
  getTaskStatusLabel,
} from '@/app/lib/tasks';
import TaskPopoverActionButton from '@/app/features/appointments/components/Calendar/Task/TaskPopoverActionButton';
import { getTaskStatusColors } from '@/app/features/appointments/components/Calendar/Task/taskMarkerStyles';

/** Hover/focus detail card for one task: header, from/to/category grid, and actions. */
/* Exported for Storybook. It is a `<dialog open>` positioned by absolute px and only
   mounted while a chip is hovered or focused, so nothing had ever drawn it - which is
   how its From/To/Category block shipped with `grid-cols-[auto,minmax(0,1fr)]`, a comma
   where CSS grid needs a track separator, and stacked all six children in one column. */
export const TaskDetailsPopover = ({
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
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl border border-card-border bg-card-hover px-2.5 py-2">
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

export default TaskDetailsPopover;
