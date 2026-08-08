import React from 'react';
import { getTaskStatusTone } from '@/app/ui/tables/tableUtils';
import { getFormattedDate } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { Task } from '@/app/features/tasks/types/task';
import { toTitleCase } from '@/app/lib/validators';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { IoEyeOutline, IoSyncOutline } from 'react-icons/io5';
import { IoIosCalendar } from 'react-icons/io';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getTaskQuickDetails,
} from '@/app/lib/tasks';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

type TaskCardProps = {
  item: Task;
  assignedByLabel?: string;
  assignedToLabel?: string;
  handleViewTask: (task: Task) => void;
  handleChangeStatusTask?: (task: Task) => void;
  handleRescheduleTask?: (task: Task) => void;
  canEditTasks?: boolean;
};

const TaskCard = ({
  item,
  assignedByLabel,
  assignedToLabel,
  handleViewTask,
  handleChangeStatusTask,
  handleRescheduleTask,
  canEditTasks = false,
}: TaskCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <div className="text-body-3-emphasis text-text-primary">{item.name}</div>
        <StatusPill tone={getTaskStatusTone(item.status)} label={toTitleCase(item.status)} />
      </div>
      {getTaskQuickDetails(item).map((detail) => (
        <div className="flex gap-1" key={detail.label}>
          <div className="text-caption-1 text-text-extra">{detail.label}:</div>
          <div className="text-caption-1 text-text-primary line-clamp-1">{detail.value}</div>
        </div>
      ))}
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">From:</div>
        <div className="text-caption-1 text-text-primary">{assignedByLabel || item.assignedBy}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">To:</div>
        <div className="text-caption-1 text-text-primary">{assignedToLabel || item.assignedTo}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Due date:</div>
        <div className="text-caption-1 text-text-primary">
          {getFormattedDate(item.dueAt)} •{' '}
          {formatDateInPreferredTimeZone(new Date(item.dueAt), {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>
      <div className="flex gap-2 w-full flex-wrap max-w-[184px]">
        <GlassTooltip content="View task" side="bottom">
          <button
            type="button"
            onClick={() => handleViewTask(item)}
            aria-label={`View task ${item.name}`}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            title="View task"
          >
            <IoEyeOutline size={18} color="var(--color-neutral-900)" />
          </button>
        </GlassTooltip>
        {canEditTasks && canShowTaskStatusChangeAction(item.status) && (
          <GlassTooltip content="Change status" side="bottom">
            <button
              type="button"
              onClick={() => handleChangeStatusTask?.(item)}
              aria-label={`Change status for ${item.name}`}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              title="Change status"
            >
              <IoSyncOutline size={18} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        )}
        {canEditTasks && canRescheduleTask(item.status) && (
          <GlassTooltip content="Reschedule" side="bottom">
            <button
              type="button"
              onClick={() => handleRescheduleTask?.(item)}
              aria-label={`Reschedule ${item.name}`}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              title="Reschedule"
            >
              <IoIosCalendar size={18} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
