import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { IoEyeOutline, IoSyncOutline } from 'react-icons/io5';
import { IoIosCalendar } from 'react-icons/io';
import TaskCard from '@/app/ui/cards/TaskCard';
import { getFormattedDate } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getPreferredNextTaskStatus,
} from '@/app/lib/tasks';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

import { getTaskStatusTone } from '@/app/ui/tables/tableUtils';

import './DataTable.css';
import { toTitleCase } from '@/app/lib/validators';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import PaginatedCardList from '@/app/ui/tables/PaginatedCardList';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type TaskTableProps = {
  filteredList: Task[];
  setActiveTask?: (inventory: Task) => void;
  setViewPopup?: (open: boolean) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
  setReschedulePopup?: (open: boolean) => void;
  canEditTasks?: boolean;
  small?: boolean;
};

const Tasks = ({
  filteredList,
  setActiveTask,
  setViewPopup,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setReschedulePopup,
  canEditTasks = true,
  small = false,
}: TaskTableProps) => {
  const { resolveMemberName } = useMemberMap();
  const getMemberNameById = (id?: string) => {
    if (!id) return '-';
    const resolved = resolveMemberName(id);
    return resolved === '-' ? id : resolved;
  };

  const handleViewTask = (task: Task) => {
    setActiveTask?.(task);
    setViewPopup?.(true);
  };

  const handleChangeStatusTask = (task: Task) => {
    setActiveTask?.(task);
    setChangeStatusPreferredStatus?.(getPreferredNextTaskStatus(task.status));
    setChangeStatusPopup?.(true);
  };

  const handleRescheduleTask = (task: Task) => {
    setActiveTask?.(task);
    setReschedulePopup?.(true);
  };

  const columns: Column<Task>[] = [
    {
      label: 'Task',
      key: 'task',
      width: '160px',
      render: (item: Task) => <div className="appointment-profile-title">{item.name}</div>,
    },
    {
      label: 'Description',
      key: 'description',
      width: '200px',
      // Free text in a 200px column: clamped to two lines so a long description
      // cannot outgrow the rows beside it.
      render: (item: Task) => (
        <div
          className="appointment-profile-title cell-clamp-2"
          title={item.description || undefined}
        >
          {item.description}
        </div>
      ),
    },
    {
      label: 'Category',
      key: 'category',
      width: '110px',
      render: (item: Task) => (
        <div className="appointment-profile-title">{toTitleCase(item.category)}</div>
      ),
    },
    {
      label: 'From',
      key: 'from',
      width: '120px',
      render: (item: Task) => (
        <div className="appointment-profile-title">{getMemberNameById(item.assignedBy)}</div>
      ),
    },
    {
      label: 'To',
      key: 'to',
      width: '120px',
      render: (item: Task) => (
        <div className="appointment-profile-title">{getMemberNameById(item.assignedTo)}</div>
      ),
    },
    {
      label: 'Due date',
      key: 'due',
      width: '110px',
      render: (item: Task) => (
        <div className="appointment-profile-title">{getFormattedDate(item.dueAt)}</div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '130px',
      render: (item: Task) => (
        <StatusPill tone={getTaskStatusTone(item.status)} label={toTitleCase(item.status)} />
      ),
    },
    {
      /* Sized by the control rail, not the label. `.action-btn-grid` is a
         flex-wrap row of 40px buttons with an 8px gap, so a three-action row needs
         3*40 + 2*8 = 136px. Measured on deployed dev, a 160px column left a 129px
         content box: it does not clip, it WRAPS the third button to a second line
         and grows that row taller than its neighbours - the same implicit-row
         failure as the calendar overlays earlier in this branch, just in a table.
         176px leaves 145px of content box, 9px clear of the rail. */
      label: 'Actions',
      key: 'actions',
      width: '176px',
      render: (item: Task) => (
        <div className="action-btn-col">
          <div className="action-btn-grid">
            <GlassTooltip content="View task" side="bottom" className="table-action-tooltip">
              <button
                type="button"
                onClick={() => handleViewTask(item)}
                aria-label={`View task ${item.name}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-[var(--divider)] flex items-center justify-center cursor-pointer"
                title="View task"
              >
                <IoEyeOutline size={18} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
            {canEditTasks && canShowTaskStatusChangeAction(item.status) && (
              <GlassTooltip content="Change status" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() => handleChangeStatusTask(item)}
                  aria-label={`Change status for ${item.name}`}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-[var(--divider)] flex items-center justify-center cursor-pointer"
                  title="Change status"
                >
                  <IoSyncOutline size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
            )}
            {canEditTasks && canRescheduleTask(item.status) && (
              <GlassTooltip content="Reschedule" side="bottom" className="table-action-tooltip">
                <button
                  type="button"
                  onClick={() => handleRescheduleTask(item)}
                  aria-label={`Reschedule ${item.name}`}
                  className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-[var(--divider)] flex items-center justify-center cursor-pointer"
                  title="Reschedule"
                >
                  <IoIosCalendar size={18} color="var(--color-neutral-900)" />
                </button>
              </GlassTooltip>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper tasks-scroll-x h-full min-h-0 overflow-hidden" style={{ gap: 8 }}>
      <div className="table-list h-full min-h-0 overflow-y-auto pr-1 pb-1">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination={true}
          pageSize={small ? 5 : 10}
          itemNoun="tasks"
          tableClassName="tasks-table-fixed"
        />
      </div>
      <PaginatedCardList
        items={filteredList}
        pageSize={small ? 5 : 10}
        className="xl:hidden"
        listClassName="pb-2"
        itemNoun="tasks"
        renderCard={(item: Task, i) => (
          <TaskCard
            key={item.name + i}
            item={item}
            assignedByLabel={getMemberNameById(item.assignedBy)}
            assignedToLabel={getMemberNameById(item.assignedTo)}
            handleViewTask={handleViewTask}
            handleChangeStatusTask={handleChangeStatusTask}
            handleRescheduleTask={handleRescheduleTask}
            canEditTasks={canEditTasks}
          />
        )}
      />
    </div>
  );
};

export default Tasks;
