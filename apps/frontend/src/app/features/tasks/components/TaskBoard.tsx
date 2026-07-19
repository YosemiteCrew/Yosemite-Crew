import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import './TaskBoard.css';
import { useBoardDragScroll } from '@/app/hooks/useBoardDragScroll';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { buildDragPreview } from '@/app/lib/buildDragPreview';
import { attachBoardColumnDnDListeners } from '@/app/ui/board/boardShared';
import BoardScopeToggle from '@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle';
import Image from 'next/image';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { getStatusStyle } from '@/app/config/statusConfig';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { useTaskStore } from '@/app/stores/taskStore';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { IoAdd } from 'react-icons/io5';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useNotify } from '@/app/hooks/useNotify';
import {
  canTransitionTaskStatus,
  canShowTaskStatusChangeAction,
  getInvalidTaskStatusTransitionMessage,
} from '@/app/lib/tasks';
import {
  getTaskCategoryLabel,
  getTaskPriorityRank,
} from '@/app/features/tasks/constants/taskTaxonomy';

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
  /** Card label for the assignee — "you" for the signed-in user, per the design. */
  label?: string;
};

/**
 * Statuses whose columns collapse to the first few cards behind a "+N more"
 * link, as the design's Completed column does.
 */
const COLLAPSING_COLUMNS: ReadonlySet<BoardStatus> = new Set(['COMPLETED', 'CANCELLED']);
const COLLAPSED_CARD_COUNT = 2;

const getInitialsStatic = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '--';

const getColumnDotColor = (status: BoardStatus): string => getStatusStyle(status).borderColor;

/**
 * The companion a task is about. Tasks loaded from the PMS carry the link on
 * `patientId` after the patient rename; records created before it still carry
 * `companionId`, so both have to be read or backend tasks lose their thumbnail.
 */
const getTaskCompanionId = (task: Task): string | undefined => task.companionId ?? task.patientId;

/** One grey meta line under the card title, matching the design's density. */
const buildBoardMeta = (task: Task, assigneeName: string): string => {
  if (task.audience === 'PARENT_TASK') {
    return ['Parent task', assigneeName].filter(Boolean).join(' · ');
  }
  const category = getTaskCategoryLabel(task.category) || 'Task';
  const time = formatDateInPreferredTimeZone(new Date(task.dueAt), {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (task.status === 'CANCELLED') {
    return ['Cancelled', assigneeName].filter(Boolean).join(' · ');
  }
  const when = task.status === 'COMPLETED' ? 'done' : `due ${time}`;
  return [category, when, assigneeName].filter(Boolean).join(' · ');
};

/**
 * Fraction (0-1) of the run-up to the due time an in-progress task has burned
 * through, driving the design's slim progress track. Returns null when the task
 * carries no usable timestamps, so the track is only drawn where it means
 * something.
 */
const getTaskElapsedFraction = (task: Task): number | null => {
  if (task.status !== 'IN_PROGRESS') return null;
  const startedAt = task.updatedAt ?? task.createdAt;
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const due = new Date(task.dueAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return null;
  const elapsed = (Date.now() - start) / (due - start);
  return Math.min(1, Math.max(0, elapsed));
};

const getTaskTitleColorClass = (isDone: boolean, isCancelled: boolean): string => {
  if (isDone) return 'text-text-tertiary line-through';
  if (isCancelled) return 'text-text-tertiary';
  return 'text-[var(--ink)]';
};

type TaskCardProps = {
  task: Task;
  draggedTaskId: string | null;
  canEditTasks: boolean;
  updatingStatusId: string | null;
  assignedTo: MemberIdentity;
  /** The companion the task is linked to, shown as a thumbnail per the design. */
  companion?: StoredCompanion;
  onOpen: (task: Task) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>, task: Task) => void;
  onDragEnd: () => void;
};

const TaskCard = ({
  task,
  draggedTaskId,
  canEditTasks,
  updatingStatusId,
  assignedTo,
  companion,
  onOpen,
  onDragStart,
  onDragEnd,
}: TaskCardProps) => {
  // Pink is reserved on this screen for pet-parent tasks only.
  const isParentTask = task.audience === 'PARENT_TASK';
  const isDone = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';
  const isMuted = isDone || isCancelled;
  const isDragging = draggedTaskId === (task._id ?? null);
  const assigneeLabel = assignedTo.label ?? assignedTo.name;
  const meta = buildBoardMeta(
    task,
    assignedTo.name && assignedTo.name !== '-' ? assigneeLabel : ''
  );
  const hasFooterRow = !isMuted && !isParentTask;
  const showAvatar = hasFooterRow && Boolean(assignedTo.name) && assignedTo.name !== '-';
  const showCompanion = hasFooterRow && Boolean(companion);
  const elapsedFraction = getTaskElapsedFraction(task);
  // A stored photo can be a legacy relative key, an http:// URL or an
  // 'undefined' placeholder, none of which next/image accepts — it throws and
  // takes the whole board down. Resolve it through the same guard every other
  // companion avatar uses so a rejected value degrades to the species fallback.
  const companionPhotoUrl = companion?.photoUrl
    ? getSafeImageUrl(companion.photoUrl, companion.type?.toLowerCase() as ImageType)
    : '';

  return (
    <article
      aria-label={`Open task ${task.name || '-'}`}
      className={clsx(
        'group/card relative w-full shrink-0 overflow-hidden rounded-[13px]! bg-neutral-0 px-3.5 py-3 text-left transition-colors flex flex-col items-stretch justify-start border',
        isParentTask
          ? 'border-[var(--pink)] shadow-[0_4px_12px_var(--glow-p12)]'
          : 'border-card-border',
        !isParentTask && !isMuted && 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]',
        isDone && 'opacity-70',
        isCancelled && 'opacity-60',
        isDragging
          ? 'opacity-60 shadow-none'
          : !isParentTask && 'hover:border-input-border-active! hover:bg-card-hover!'
      )}
      draggable={canEditTasks && canShowTaskStatusChangeAction(task.status)}
      onDragStart={(event) => onDragStart(event, task)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        aria-label={`Open task ${task.name || '-'}`}
        className="absolute inset-0 rounded-[13px]!"
        onClick={() => onOpen(task)}
      />
      <div
        className={clsx(
          'relative z-10 flex items-center gap-1.5 text-[13px] font-bold leading-4',
          getTaskTitleColorClass(isDone, isCancelled)
        )}
      >
        {isParentTask && (
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--pink)]" />
        )}
        <span className="min-w-0 break-words">{task.name || '-'}</span>
      </div>

      <div className="relative z-10 mt-[3px] text-[11px] leading-4 text-text-tertiary">{meta}</div>

      {elapsedFraction !== null && (
        <progress
          className="yc-task-progress relative z-10 mt-[9px]"
          aria-label={`Time elapsed toward due for ${task.name || '-'}`}
          max={100}
          value={Math.round(elapsedFraction * 100)}
        />
      )}

      {(showAvatar || showCompanion) && (
        <div className="relative z-10 mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {showAvatar &&
              (assignedTo.imageUrl ? (
                <Image
                  src={getSafeImageUrl(assignedTo.imageUrl, 'person')}
                  alt={assignedTo.name}
                  width={22}
                  height={22}
                  className="size-[22px] rounded-full border border-card-border object-cover"
                />
              ) : (
                <span className="size-[22px] shrink-0 rounded-full bg-[var(--avatar-violet-bg)] text-[9px] font-bold text-[var(--avatar-violet-ink)] flex items-center justify-center">
                  {getInitialsStatic(assignedTo.name)}
                </span>
              ))}
            {showAvatar && (
              <span className="truncate text-[11px] text-text-secondary">{assigneeLabel}</span>
            )}
          </span>
          {showCompanion && (
            <span
              className="size-[22px] shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--avatar-amber-bg)' }}
            >
              {companionPhotoUrl ? (
                <Image
                  src={companionPhotoUrl}
                  alt={companion?.name ?? ''}
                  width={22}
                  height={22}
                  className="size-full object-cover"
                />
              ) : (
                <span
                  className="flex size-full items-center justify-center text-[9px] font-bold"
                  style={{ color: 'var(--avatar-amber-ink)' }}
                >
                  {getInitialsStatic(companion?.name ?? '').charAt(0)}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {updatingStatusId === task._id && (
        <div className="relative z-10 mt-1 text-[10px] text-text-secondary">Updating...</div>
      )}
    </article>
  );
};

type TaskBoardProps = {
  tasks: Task[];
  canEditTasks: boolean;
  setActiveTask?: (task: Task) => void;
  setViewPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  onAddTask?: () => void;
};

const normalizeId = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

type BoardToolbarProps = {
  showMineOnly: boolean;
  setShowMineOnly: (value: boolean) => void;
};

/**
 * The design's board has no toolbar band — the columns sit directly on the page
 * and "New task" lives in the page header. Only the scope toggle survives here,
 * as a bare control row, because the board is the one view with no filter bar.
 */
const BoardToolbar = ({ showMineOnly, setShowMineOnly }: BoardToolbarProps) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <BoardScopeToggle
      showMineOnly={showMineOnly}
      onChange={setShowMineOnly}
      allLabel="All tasks"
      mineLabel="My tasks"
    />
  </div>
);

type BoardColumnProps = {
  column: { key: BoardStatus; label: string };
  columnTasks: Task[];
  draggedTaskId: string | null;
  canEditTasks: boolean;
  updatingStatusId: string | null;
  resolveMemberIdentity: (memberId?: string) => MemberIdentity;
  resolveCompanion: (companionId?: string) => StoredCompanion | undefined;
  onOpen: (task: Task) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>, task: Task) => void;
  onDragEnd: () => void;
  onAddTask?: () => void;
  onWheelBoundary: (event: React.WheelEvent<HTMLElement>) => void;
  setDropElement: (element: HTMLDivElement | null) => void;
  setScrollElement: (element: HTMLDivElement | null) => void;
};

const BoardColumn = ({
  column,
  columnTasks,
  draggedTaskId,
  canEditTasks,
  updatingStatusId,
  resolveMemberIdentity,
  resolveCompanion,
  onOpen,
  onDragStart,
  onDragEnd,
  onAddTask,
  onWheelBoundary,
  setDropElement,
  setScrollElement,
}: BoardColumnProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasTasks = columnTasks.length > 0;
  // The design truncates the settled columns and offers a "+N more" link.
  const collapses = COLLAPSING_COLUMNS.has(column.key) && columnTasks.length > COLLAPSED_CARD_COUNT;
  const isCollapsed = collapses && !isExpanded;
  const visibleTasks = isCollapsed ? columnTasks.slice(0, COLLAPSED_CARD_COUNT) : columnTasks;
  const hiddenCount = columnTasks.length - visibleTasks.length;
  return (
    <div
      ref={setDropElement}
      // Fluid quarter-width columns on desktop (the design's 4-up grid); the
      // fixed 320px track keeps the board usable as a scroller below that.
      className="w-[320px] min-w-[320px] max-w-[320px] lg:w-auto lg:min-w-0 lg:max-w-none h-full rounded-2xl bg-[var(--inset)] overflow-hidden flex flex-col min-h-0"
    >
      <div className="px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: getColumnDotColor(column.key) }}
            />
            <div className="text-[12px] font-bold uppercase text-[var(--ink-muted)]">
              {column.label}
            </div>
          </div>
          <div className="text-[11.5px] font-bold text-text-tertiary">{columnTasks.length}</div>
        </div>
      </div>
      <div
        ref={setScrollElement}
        className="flex-1 min-h-0 h-0 flex flex-col gap-2.5 px-2.5 pb-3 overflow-y-auto"
        onWheel={onWheelBoundary}
        data-calendar-scroll="true"
      >
        {visibleTasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            draggedTaskId={draggedTaskId}
            canEditTasks={canEditTasks}
            updatingStatusId={updatingStatusId}
            assignedTo={resolveMemberIdentity(task.assignedTo)}
            companion={resolveCompanion(getTaskCompanionId(task))}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {collapses && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-center text-[11.5px] font-semibold"
            style={{ color: 'var(--blue-text)' }}
          >
            {isCollapsed ? `+ ${hiddenCount} more` : 'Show less'}
          </button>
        )}
        {!hasTasks && (
          <div className="rounded-[13px] border border-dashed border-card-border bg-neutral-0 px-3 py-4 text-center text-caption-1 text-text-secondary">
            No tasks
          </div>
        )}
        {canEditTasks && column.key === 'PENDING' && (
          <button
            type="button"
            aria-label="Add task to Pending"
            onClick={onAddTask}
            className="mt-auto flex items-center justify-center gap-1.5 rounded-[11px] border border-dashed border-[var(--divider)] px-3 py-2.5 text-[12px] font-semibold text-text-tertiary transition-colors hover:border-input-border-active hover:text-text-primary"
          >
            <IoAdd size={14} aria-hidden="true" />
            Add
          </button>
        )}
      </div>
    </div>
  );
};

const TaskBoard = ({
  tasks,
  canEditTasks,
  setActiveTask,
  setViewPopup,
  onAddTask,
}: TaskBoardProps) => {
  const { notify } = useNotify();
  const team = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
  const authUserId = useAuthStore((s) => s.attributes?.sub || s.attributes?.email || '');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const columnDropRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});
  const columnScrollRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});

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

  const companionById = useMemo(() => {
    const map: Record<string, StoredCompanion> = {};
    companions?.forEach((companion) => {
      const normalized = normalizeId(companion.id);
      if (normalized) map[normalized] = companion;
    });
    return map;
  }, [companions]);

  const resolveCompanion = (companionId?: string): StoredCompanion | undefined => {
    const normalized = normalizeId(companionId);
    return normalized ? companionById[normalized] : undefined;
  };

  const resolveMemberIdentity = (memberId?: string): MemberIdentity => {
    const raw = String(memberId ?? '').trim();
    if (!raw) return { name: '-' };
    const resolved = resolveMemberName(raw);
    const identity = teamIdentityById[normalizeId(raw)];
    // The design labels the signed-in user "you" rather than by name.
    const label =
      currentUserAssigneeId && normalizeId(raw) === currentUserAssigneeId ? 'you' : undefined;
    if (identity) {
      return {
        name: resolved && resolved !== '-' ? resolved : identity.name,
        imageUrl: identity.imageUrl,
        label,
      };
    }
    return {
      name: resolved && resolved !== '-' ? resolved : teamNameById[normalizeId(raw)] || raw,
      label,
    };
  };

  // The design board shows the whole backlog (not one day). Scope narrows only to
  // "My tasks" when the toggle is on; ordering keeps the most urgent first.
  const visibleTasks = useMemo(
    () =>
      tasks
        .filter((task) => !showMineOnly || normalizeId(task.assignedTo) === currentUserAssigneeId)
        .sort((a, b) => {
          const priorityDelta = getTaskPriorityRank(b.priority) - getTaskPriorityRank(a.priority);
          if (priorityDelta !== 0) return priorityDelta;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        }),
    [tasks, showMineOnly, currentUserAssigneeId]
  );

  const groupedTasks = useMemo(() => {
    const grouped: Record<BoardStatus, Task[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    visibleTasks.forEach((task) => {
      if (!grouped[task.status]) return;
      grouped[task.status].push(task);
    });
    return grouped;
  }, [visibleTasks]);

  const openTask = (task: Task) => {
    setActiveTask?.(task);
    setViewPopup?.(true);
  };

  const { autoScrollBoardOnDrag } = useBoardDragScroll();
  const onWheelBoundary = useScrollBoundaryWheel();
  const onWheelHorizontal = useWheelToHorizontalScroll();

  const moveToStatus = useCallback(
    async (taskId: string, nextStatus: BoardStatus) => {
      const task = visibleTasks.find((item) => item._id === taskId);
      /* v8 ignore next */
      if (!task?._id) return;
      if (task.status === nextStatus) return;
      /* v8 ignore next */
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
      } catch {
        // changeTaskStatus applies the new status optimistically before calling the API.
        // Restoring the pre-drag task keeps the card out of a column the server rejected.
        useTaskStore.getState().upsertTask(task);
        notify('error', {
          title: 'Status change failed',
          text: 'Unable to update the task status. Please try again.',
        });
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [canEditTasks, notify, visibleTasks]
  );

  const moveToStatusRef = useRef(moveToStatus);
  moveToStatusRef.current = moveToStatus;

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
    /* v8 ignore next */
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
      /* v8 ignore next */
      if (!dropElement || !scrollElement) return [];

      return attachBoardColumnDnDListeners({
        dropElement,
        scrollElement,
        isDragActive: () => !!draggedTaskId && canEditTasks,
        onDrop: () => {
          if (!draggedTaskId) return;
          void moveToStatusRef.current(draggedTaskId, column.key);
          setDraggedTaskId(null);
        },
        autoScrollBoardOnDrag,
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [autoScrollBoardOnDrag, canEditTasks, draggedTaskId]);

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col gap-3">
      <BoardToolbar showMineOnly={showMineOnly} setShowMineOnly={setShowMineOnly} />

      <div
        ref={boardRootRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden lg:overflow-x-hidden scrollbar-x-float"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
        onWheel={onWheelHorizontal}
      >
        <div className="h-full min-w-max flex items-stretch gap-3 lg:grid lg:grid-cols-4 lg:min-w-0">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.key}
              column={column}
              columnTasks={groupedTasks[column.key]}
              draggedTaskId={draggedTaskId}
              canEditTasks={canEditTasks}
              updatingStatusId={updatingStatusId}
              resolveMemberIdentity={resolveMemberIdentity}
              resolveCompanion={resolveCompanion}
              onOpen={openTask}
              onDragStart={handleTaskCardDragStart}
              onDragEnd={() => setDraggedTaskId(null)}
              onAddTask={onAddTask}
              onWheelBoundary={onWheelBoundary}
              setDropElement={(element) => {
                columnDropRefs.current[column.key] = element;
              }}
              setScrollElement={(element) => {
                columnScrollRefs.current[column.key] = element;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
