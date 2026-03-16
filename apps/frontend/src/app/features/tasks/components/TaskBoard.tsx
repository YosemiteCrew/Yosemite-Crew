import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBoardDragScroll } from '@/app/hooks/useBoardDragScroll';
import { buildDragPreview } from '@/app/lib/buildDragPreview';
import BoardScopeToggle from '@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle';
import Image from 'next/image';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { getStatusStyle } from '@/app/config/statusConfig';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import {
  isOnPreferredTimeZoneCalendarDay,
  formatDateInPreferredTimeZone,
} from '@/app/lib/timezone';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { IoAdd, IoEyeOutline } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { MdOutlineAutorenew } from 'react-icons/md';
import { IoIosCalendar } from 'react-icons/io';
import { useNotify } from '@/app/hooks/useNotify';
import {
  canRescheduleTask,
  canTransitionTaskStatus,
  canShowTaskStatusChangeAction,
  getInvalidTaskStatusTransitionMessage,
  getPreferredNextTaskStatus,
  getTaskQuickDetails,
} from '@/app/lib/tasks';

type BoardStatus = TaskStatus;

const BOARD_COLUMNS: Array<{ key: BoardStatus; label: string }> = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

type MemberIdentity = {
  name: string;
  imageUrl?: string;
};

type TaskCardProps = {
  task: Task;
  columnLabel: string;
  columnStyle: { backgroundColor: string; color: string };
  draggedTaskId: string | null;
  canEditTasks: boolean;
  updatingStatusId: string | null;
  assignedBy: MemberIdentity;
  assignedTo: MemberIdentity;
  onOpen: (task: Task) => void;
  onChangeStatus: (task: Task) => void;
  onReschedule: (task: Task) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>, task: Task) => void;
  onDragEnd: () => void;
};

const getInitialsStatic = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '--';

const TaskCard = ({
  task,
  columnLabel,
  columnStyle,
  draggedTaskId,
  canEditTasks,
  updatingStatusId,
  assignedBy,
  assignedTo,
  onOpen,
  onChangeStatus,
  onReschedule,
  onDragStart,
  onDragEnd,
}: TaskCardProps) => (
  <article
    aria-label={`Open task ${task.name || '-'}`}
    className={`relative w-full min-h-[112px] shrink-0 rounded-2xl! overflow-hidden border border-card-border bg-gradient-to-b from-white to-card-hover px-3 py-2.5 text-left transition-colors flex flex-col items-stretch justify-start ${
      draggedTaskId === (task._id ?? null)
        ? 'opacity-60 shadow-none'
        : 'hover:border-input-border-active! hover:bg-card-hover!'
    }`}
    draggable={canEditTasks && canShowTaskStatusChangeAction(task.status)}
    onDragStart={(event) => onDragStart(event, task)}
    onDragEnd={onDragEnd}
  >
    <button
      type="button"
      aria-label={`Open task ${task.name || '-'}`}
      className="absolute inset-0 rounded-2xl!"
      onClick={() => onOpen(task)}
    />
    <div className="relative z-10 flex items-start justify-between gap-2">
      <div className="truncate text-[12px] leading-4 font-semibold text-text-primary">
        {task.name || '-'}
      </div>
      <div
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ backgroundColor: columnStyle.backgroundColor, color: columnStyle.color }}
      >
        {columnLabel}
      </div>
    </div>

    <div className="relative z-10 mt-1.5 grid grid-cols-1 gap-1">
      {getTaskQuickDetails(task)
        .slice(0, 2)
        .map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-1.5 text-[10px] leading-4 text-text-secondary"
          >
            <span className="shrink-0 font-medium text-text-primary">{item.label}:</span>
            <span className="line-clamp-1 min-w-0">{item.value}</span>
          </div>
        ))}
      {[
        { label: 'From', value: assignedBy },
        { label: 'To', value: assignedTo },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.value.imageUrl ? (
            <Image
              src={item.value.imageUrl}
              alt={item.value.name}
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded-full border border-card-border object-cover"
            />
          ) : (
            <div className="h-[18px] w-[18px] rounded-full border border-card-border bg-white text-[8px] font-semibold text-text-secondary flex items-center justify-center">
              {getInitialsStatic(item.value.name)}
            </div>
          )}
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-[10px] text-text-secondary">{item.label}</span>
            <span className="truncate text-[10px] text-text-primary">{item.value.name}</span>
          </div>
        </div>
      ))}
    </div>

    <div className="relative z-10 mt-1.5 rounded-xl border border-card-border bg-white/80 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-secondary">Due</span>
        <span className="text-[10px] text-text-primary">
          {formatDateInPreferredTimeZone(new Date(task.dueAt), {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          {' \u2022 '}
          {formatDateInPreferredTimeZone(new Date(task.dueAt), {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
    <div className="relative z-10 mt-1.5 flex items-center gap-1.5 flex-wrap max-w-[168px]">
      <GlassTooltip content="View task" side="bottom">
        <button
          type="button"
          className="h-7 w-7 rounded-full! border border-black-text! bg-white flex items-center justify-center"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpen(task);
          }}
        >
          <IoEyeOutline size={14} color="#302F2E" />
        </button>
      </GlassTooltip>
      {canEditTasks && canShowTaskStatusChangeAction(task.status) && (
        <GlassTooltip content="Change status" side="bottom">
          <button
            type="button"
            className="h-7 w-7 rounded-full! border border-black-text! bg-white flex items-center justify-center"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChangeStatus(task);
            }}
          >
            <MdOutlineAutorenew size={13} color="#302F2E" />
          </button>
        </GlassTooltip>
      )}
      {canEditTasks && canRescheduleTask(task.status) && (
        <GlassTooltip content="Reschedule" side="bottom">
          <button
            type="button"
            className="h-7 w-7 rounded-full! border border-black-text! bg-white flex items-center justify-center"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onReschedule(task);
            }}
          >
            <IoIosCalendar size={13} color="#302F2E" />
          </button>
        </GlassTooltip>
      )}
    </div>

    {updatingStatusId === task._id && (
      <div className="relative z-10 mt-1 text-[10px] text-text-secondary">Updating...</div>
    )}
  </article>
);

type TaskBoardProps = {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks: boolean;
  setActiveTask?: (task: Task) => void;
  setViewPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
  setReschedulePopup?: React.Dispatch<React.SetStateAction<boolean>>;
  onAddTask?: () => void;
};

const TaskBoard = ({
  tasks,
  currentDate,
  setCurrentDate,
  canEditTasks,
  setActiveTask,
  setViewPopup,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setReschedulePopup,
  onAddTask,
}: TaskBoardProps) => {
  const { notify } = useNotify();
  const team = useTeamForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const columnDropRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});
  const columnScrollRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});

  const normalizeId = (value?: string | null) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';

  const currentUserAssigneeId = useMemo(() => {
    const normalizedCurrentUser = normalizeId(authUserId);
    if (!normalizedCurrentUser) return '';
    const member = team.find(
      (item) =>
        normalizeId(item.practionerId) === normalizedCurrentUser ||
        normalizeId(item._id) === normalizedCurrentUser ||
        normalizeId((item as any).userId) === normalizedCurrentUser ||
        normalizeId((item as any).id) === normalizedCurrentUser ||
        normalizeId((item as any).userOrganisation?.userId) === normalizedCurrentUser
    );
    return normalizeId(
      member?.practionerId ||
        (member as any)?.userId ||
        (member as any)?.id ||
        member?._id ||
        (member as any)?.userOrganisation?.userId
    );
  }, [authUserId, team]);

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

  const teamIdentityById = useMemo(() => {
    const map: Record<string, MemberIdentity> = {};
    team.forEach((member) => {
      const name = member.name || (member as any).displayName || '-';
      const imageUrl = String(member.image || (member as any).profileUrl || '').trim() || undefined;
      const ids = [
        member.practionerId,
        member._id,
        (member as any).userId,
        (member as any).id,
        (member as any).userOrganisation?.userId,
      ];
      ids.forEach((id) => {
        const normalized = normalizeId(id);
        if (normalized) {
          map[normalized] = { name, imageUrl };
        }
      });
    });
    return map;
  }, [team]);

  const resolveMemberIdentity = (memberId?: string): MemberIdentity => {
    const raw = String(memberId ?? '').trim();
    if (!raw) return { name: '-' };
    const resolved = resolveMemberName(raw);
    const identity = teamIdentityById[normalizeId(raw)];
    if (identity) {
      return {
        name: resolved && resolved !== '-' ? resolved : identity.name,
        imageUrl: identity.imageUrl,
      };
    }
    return {
      name: resolved && resolved !== '-' ? resolved : teamNameById[normalizeId(raw)] || raw,
    };
  };

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((task) => isOnPreferredTimeZoneCalendarDay(new Date(task.dueAt), currentDate))
        .filter((task) =>
          showMineOnly ? normalizeId(task.assignedTo) === currentUserAssigneeId : true
        )
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [tasks, currentDate, showMineOnly, currentUserAssigneeId]
  );

  const groupedTasks = useMemo(() => {
    const grouped: Record<BoardStatus, Task[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    todayTasks.forEach((task) => {
      if (!grouped[task.status]) return;
      grouped[task.status].push(task);
    });
    return grouped;
  }, [todayTasks]);

  const openTask = (task: Task) => {
    setActiveTask?.(task);
    setViewPopup?.(true);
  };

  const openChangeStatus = (task: Task) => {
    setActiveTask?.(task);
    setChangeStatusPreferredStatus?.(getPreferredNextTaskStatus(task.status));
    setChangeStatusPopup?.(true);
  };

  const openReschedule = (task: Task) => {
    setActiveTask?.(task);
    setReschedulePopup?.(true);
  };

  const { autoScrollBoardOnDrag } = useBoardDragScroll();

  const moveToStatus = useCallback(
    async (taskId: string, nextStatus: BoardStatus) => {
      const task = todayTasks.find((item) => item._id === taskId);
      if (!task?._id) return;
      if (task.status === nextStatus) return;
      if (!canEditTasks) return;
      if (!canTransitionTaskStatus(task.status, nextStatus)) {
        notify('warning', {
          title: 'Status change blocked',
          text: getInvalidTaskStatusTransitionMessage(task.status, nextStatus),
        });
        return;
      }

      try {
        setUpdatingStatusId(task._id);
        await changeTaskStatus({
          ...task,
          status: nextStatus,
        });
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [canEditTasks, notify, todayTasks]
  );

  const handleTaskCardDragStart = useCallback((event: React.DragEvent<HTMLElement>, task: Task) => {
    setDraggedTaskId(task._id ?? null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task._id ?? '');
    const preview = buildDragPreview(event.currentTarget);
    event.dataTransfer.setDragImage(preview, 24, 24);
    requestAnimationFrame(() => {
      preview.remove();
    });
  }, []);

  useEffect(() => {
    const boardRoot = boardRootRef.current;
    if (!boardRoot) return;

    const handleBoardDragOver = (event: DragEvent) => {
      if (!draggedTaskId || !canEditTasks) return;
      autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
    };

    boardRoot.addEventListener('dragover', handleBoardDragOver);
    return () => boardRoot.removeEventListener('dragover', handleBoardDragOver);
  }, [autoScrollBoardOnDrag, canEditTasks, draggedTaskId]);

  useEffect(() => {
    const cleanups = BOARD_COLUMNS.flatMap((column) => {
      const dropElement = columnDropRefs.current[column.key];
      const scrollElement = columnScrollRefs.current[column.key];
      if (!dropElement || !scrollElement) return [];

      const handleColumnDragOver = (event: DragEvent) => {
        if (!draggedTaskId || !canEditTasks) return;
        event.preventDefault();
        autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
      };

      const handleColumnDrop = (event: DragEvent) => {
        if (!draggedTaskId || !canEditTasks) return;
        event.preventDefault();
        void moveToStatus(draggedTaskId, column.key);
        setDraggedTaskId(null);
      };

      const handleScrollDragOver = (event: DragEvent) => {
        if (!draggedTaskId || !canEditTasks) return;
        event.preventDefault();
        autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>, scrollElement);
      };

      dropElement.addEventListener('dragover', handleColumnDragOver);
      dropElement.addEventListener('drop', handleColumnDrop);
      scrollElement.addEventListener('dragover', handleScrollDragOver);

      return [
        () => dropElement.removeEventListener('dragover', handleColumnDragOver),
        () => dropElement.removeEventListener('drop', handleColumnDrop),
        () => scrollElement.removeEventListener('dragover', handleScrollDragOver),
      ];
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [autoScrollBoardOnDrag, canEditTasks, draggedTaskId, moveToStatus]);

  return (
    <div className="h-full min-h-0 rounded-2xl border border-grey-light bg-white overflow-hidden flex flex-col">
      <div className="border-b border-card-border bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-body-4-emphasis text-text-primary flex-1 min-w-[220px]">
            <Back
              onClick={() =>
                setCurrentDate((prev) => {
                  const next = new Date(prev);
                  next.setDate(next.getDate() - 1);
                  return next;
                })
              }
            />
            <div>
              {formatDateInPreferredTimeZone(currentDate, {
                weekday: 'long',
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })}
            </div>
            <Next
              onClick={() =>
                setCurrentDate((prev) => {
                  const next = new Date(prev);
                  next.setDate(next.getDate() + 1);
                  return next;
                })
              }
            />
          </div>
          <div className="relative z-20 flex items-center justify-end gap-2 flex-1 min-w-[420px]">
            {canEditTasks && (
              <GlassTooltip content="Add task" side="bottom">
                <button
                  type="button"
                  title="Add task"
                  aria-label="Add task"
                  onClick={onAddTask}
                  className="rounded-2xl! border! border-input-border-default! px-[13px] py-[13px] transition-all duration-300 ease-in-out hover:bg-card-bg"
                >
                  <IoAdd size={20} color="#302f2e" />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip content="Select date" side="bottom">
              <Datepicker
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                placeholder="Select Date"
              />
            </GlassTooltip>
            <BoardScopeToggle
              showMineOnly={showMineOnly}
              onChange={setShowMineOnly}
              allLabel="All tasks"
              mineLabel="My tasks"
            />
          </div>
        </div>
      </div>

      <div
        ref={boardRootRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
      >
        <div className="h-full min-w-max flex items-stretch gap-3">
          {BOARD_COLUMNS.map((column) => {
            const columnTasks = groupedTasks[column.key];
            const hasTasks = columnTasks.length > 0;
            const style = getStatusStyle(column.key);
            return (
              <div
                key={column.key}
                ref={(element) => {
                  columnDropRefs.current[column.key] = element;
                }}
                className="w-[320px] min-w-[320px] max-w-[320px] h-full rounded-2xl border border-card-border bg-white overflow-hidden flex flex-col min-h-0"
              >
                <div
                  className="rounded-t-2xl border-b border-card-border px-3 py-2"
                  style={{ backgroundColor: style.backgroundColor }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-body-4-emphasis text-text-primary">{column.label}</div>
                    <div className="text-caption-1 rounded-full px-2 py-0.5 bg-white text-black-text">
                      {columnTasks.length}
                    </div>
                  </div>
                </div>
                <div
                  ref={(element) => {
                    columnScrollRefs.current[column.key] = element;
                  }}
                  className="flex-1 min-h-0 h-0 flex flex-col gap-2 p-3 pb-4 bg-white overflow-y-auto"
                  data-calendar-scroll="true"
                >
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      columnLabel={column.label}
                      columnStyle={style}
                      draggedTaskId={draggedTaskId}
                      canEditTasks={canEditTasks}
                      updatingStatusId={updatingStatusId}
                      assignedBy={resolveMemberIdentity(task.assignedBy)}
                      assignedTo={resolveMemberIdentity(task.assignedTo)}
                      onOpen={openTask}
                      onChangeStatus={openChangeStatus}
                      onReschedule={openReschedule}
                      onDragStart={handleTaskCardDragStart}
                      onDragEnd={() => setDraggedTaskId(null)}
                    />
                  ))}
                  {!hasTasks && (
                    <div className="rounded-2xl border border-dashed border-card-border bg-white px-3 py-4 text-center text-caption-1 text-text-secondary">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
