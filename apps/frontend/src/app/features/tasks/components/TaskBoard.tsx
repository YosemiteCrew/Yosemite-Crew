import React, { useMemo, useState } from 'react';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { getStatusStyle } from '@/app/config/statusConfig';
import { updateTask } from '@/app/features/tasks/services/taskService';
import {
  isOnPreferredTimeZoneCalendarDay,
  formatDateInPreferredTimeZone,
} from '@/app/lib/timezone';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { IoAdd } from 'react-icons/io5';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useMemberMap } from '@/app/hooks/useMemberMap';

type BoardStatus = TaskStatus;

const BoardScopeToggle = ({
  showMineOnly,
  disabled,
  onChange,
}: {
  showMineOnly: boolean;
  disabled?: boolean;
  onChange: (nextShowMineOnly: boolean) => void;
}) => {
  const isAllTasks = !showMineOnly;
  const sliderClass = isAllTasks
    ? 'translate-x-0 bg-[#247AED] border-[#247AED]'
    : 'translate-x-full bg-[#D28F9A] border-[#D28F9A]';
  const allTextClass = isAllTasks ? 'text-neutral-0' : 'text-text-secondary';
  const mineTextClass = isAllTasks ? 'text-text-secondary' : 'text-neutral-0';

  return (
    <div
      className={`relative inline-flex items-center h-9 w-[320px] max-w-full rounded-[999px]! border border-card-border bg-white overflow-hidden ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-1/2 rounded-[999px]! border-0 transition-all duration-300 ease-in-out ${sliderClass}`}
      />
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${allTextClass}`}
      >
        All tasks
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${mineTextClass}`}
      >
        My tasks
      </button>
    </div>
  );
};

const BOARD_COLUMNS: Array<{ key: BoardStatus; label: string }> = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

type TaskBoardProps = {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditTasks: boolean;
  setActiveTask?: (task: Task) => void;
  setViewPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  onAddTask?: () => void;
};

const TaskBoard = ({
  tasks,
  currentDate,
  setCurrentDate,
  canEditTasks,
  setActiveTask,
  setViewPopup,
  onAddTask,
}: TaskBoardProps) => {
  const team = useTeamForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);

  const buildDragPreview = (source: HTMLElement): HTMLElement => {
    const preview = source.cloneNode(true) as HTMLElement;
    preview.style.position = 'fixed';
    preview.style.top = '-10000px';
    preview.style.left = '-10000px';
    preview.style.width = `${source.offsetWidth}px`;
    preview.style.maxWidth = `${source.offsetWidth}px`;
    preview.style.pointerEvents = 'none';
    preview.style.borderRadius = '16px';
    preview.style.overflow = 'hidden';
    preview.style.boxShadow = 'none';
    preview.style.background = '#fff';
    preview.style.transform = 'scale(1)';
    preview.style.opacity = '1';
    preview.style.zIndex = '99999';
    document.body.appendChild(preview);
    return preview;
  };

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

  const resolveDisplayName = (memberId?: string) => {
    const raw = String(memberId ?? '').trim();
    if (!raw) return '-';
    const resolved = resolveMemberName(raw);
    if (resolved && resolved !== '-') return resolved;
    return teamNameById[normalizeId(raw)] || raw;
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

  const getEdgeScrollDelta = (clientPosition: number, start: number, end: number) => {
    const EDGE_PX = 56;
    const SPEED_PX = 24;
    if (clientPosition - start < EDGE_PX) return -SPEED_PX;
    if (end - clientPosition < EDGE_PX) return SPEED_PX;
    return 0;
  };

  const canScrollVertically = (el: HTMLElement, delta: number) => {
    if (delta < 0) return el.scrollTop > 0;
    if (delta > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    return false;
  };

  const canScrollHorizontally = (el: HTMLElement, delta: number) => {
    if (delta < 0) return el.scrollLeft > 0;
    if (delta > 0) return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    return false;
  };

  const autoScrollBoardOnDrag = (
    event: React.DragEvent<HTMLElement>,
    innerScrollable?: HTMLElement | null
  ) => {
    const innerRect = innerScrollable?.getBoundingClientRect();
    const deltaInnerY = innerRect
      ? getEdgeScrollDelta(event.clientY, innerRect.top, innerRect.bottom)
      : 0;
    if (innerScrollable && deltaInnerY !== 0 && canScrollVertically(innerScrollable, deltaInnerY)) {
      innerScrollable.scrollBy({ top: deltaInnerY });
      return;
    }

    const boardRoot = (event.currentTarget.closest('[data-board-scroll-root="true"]') ||
      event.currentTarget) as HTMLElement;
    const boardRect = boardRoot.getBoundingClientRect();
    const deltaBoardX = getEdgeScrollDelta(event.clientX, boardRect.left, boardRect.right);
    if (deltaBoardX !== 0 && canScrollHorizontally(boardRoot, deltaBoardX)) {
      boardRoot.scrollBy({ left: deltaBoardX });
    }
  };

  const moveToStatus = async (taskId: string, nextStatus: BoardStatus) => {
    const task = todayTasks.find((item) => item._id === taskId);
    if (!task?._id) return;
    if (task.status === nextStatus) return;
    if (!canEditTasks) return;

    try {
      setUpdatingStatusId(task._id);
      await updateTask({
        ...task,
        status: nextStatus,
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

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
            <BoardScopeToggle showMineOnly={showMineOnly} onChange={setShowMineOnly} />
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
        onDragOver={(event) => {
          if (!draggedTaskId || !canEditTasks) return;
          autoScrollBoardOnDrag(event);
        }}
      >
        <div className="h-full min-w-max flex items-stretch gap-3">
          {BOARD_COLUMNS.map((column) => {
            const columnTasks = groupedTasks[column.key];
            const hasTasks = columnTasks.length > 0;
            const style = getStatusStyle(column.key);
            return (
              <div
                key={column.key}
                className="w-[320px] min-w-[320px] max-w-[320px] h-full rounded-2xl border border-card-border bg-white overflow-hidden flex flex-col min-h-0"
                onDragOver={(event) => {
                  if (!draggedTaskId || !canEditTasks) return;
                  event.preventDefault();
                  autoScrollBoardOnDrag(event);
                }}
                onDrop={(event) => {
                  if (!draggedTaskId || !canEditTasks) return;
                  event.preventDefault();
                  void moveToStatus(draggedTaskId, column.key);
                  setDraggedTaskId(null);
                }}
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
                  className="flex-1 min-h-0 h-0 flex flex-col gap-2 p-3 pb-4 bg-white overflow-y-auto"
                  data-calendar-scroll="true"
                  onDragOver={(event) => {
                    if (!draggedTaskId || !canEditTasks) return;
                    event.preventDefault();
                    autoScrollBoardOnDrag(event, event.currentTarget);
                  }}
                >
                  {columnTasks.map((task) => (
                    <button
                      key={task._id}
                      type="button"
                      className={`w-full min-h-[142px] shrink-0 rounded-2xl! overflow-hidden border border-card-border bg-white px-4 py-3 text-left transition-colors flex flex-col items-stretch justify-start ${
                        draggedTaskId === (task._id ?? null)
                          ? 'opacity-60 shadow-none'
                          : 'hover:border-input-border-active! hover:bg-card-hover!'
                      }`}
                      onClick={() => openTask(task)}
                      draggable={canEditTasks}
                      onDragStart={(event) => {
                        setDraggedTaskId(task._id ?? null);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', task._id ?? '');
                        const preview = buildDragPreview(event.currentTarget);
                        event.dataTransfer.setDragImage(preview, 24, 24);
                        requestAnimationFrame(() => {
                          preview.remove();
                        });
                      }}
                      onDragEnd={() => setDraggedTaskId(null)}
                    >
                      <div className="truncate text-caption-1 font-semibold text-text-primary">
                        {task.name || '-'}
                      </div>
                      <div className="mt-1 truncate text-[10px] text-text-secondary">From</div>
                      <div className="truncate text-[10px] text-text-primary">
                        {resolveDisplayName(task.assignedBy)}
                      </div>
                      <div className="mt-1 truncate text-[10px] text-text-secondary">To</div>
                      <div className="truncate text-[10px] text-text-primary">
                        {resolveDisplayName(task.assignedTo)}
                      </div>
                      <div className="mt-1 truncate text-[10px] text-text-secondary">Due date</div>
                      <div className="truncate text-[10px] text-text-primary">
                        {formatDateInPreferredTimeZone(new Date(task.dueAt), {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="mt-1 truncate text-[10px] text-text-secondary">Due time</div>
                      <div className="truncate text-[10px] text-text-primary">
                        {formatDateInPreferredTimeZone(new Date(task.dueAt), {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                      {updatingStatusId === task._id && (
                        <div className="mt-1 text-[10px] text-text-secondary">Updating...</div>
                      )}
                    </button>
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
