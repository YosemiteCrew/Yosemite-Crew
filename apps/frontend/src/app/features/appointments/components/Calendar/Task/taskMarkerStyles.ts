import { Task } from '@/app/features/tasks/types/task';

export const TASK_BLOCK_DURATION_MINUTES = 30;

export type MarkerStyle = { backgroundColor: string; borderColor: string; color: string };

// Warm-bone status tokens — the week calendar markers read as soft status pills,
// matching the board and the design handoff (no saturated solid blocks).
export const TASK_STATUS_MARKER_STYLES: Record<string, MarkerStyle> = {
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
export const PARENT_MARKER_STYLE: MarkerStyle = {
  backgroundColor: 'var(--screen)',
  borderColor: 'var(--pink)',
  color: 'var(--ink)',
};

/**
 * A partial task, a legacy record or a malformed API response can arrive with no
 * status. Calling toUpperCase on it threw while rendering the marker and the
 * popover badge, taking the whole calendar down over one bad row, so an absent
 * status falls back to PENDING like any unrecognised one.
 */
export const getTaskStatusColors = (status: string | null | undefined): MarkerStyle =>
  TASK_STATUS_MARKER_STYLES[String(status ?? '').toUpperCase()] ??
  TASK_STATUS_MARKER_STYLES.PENDING;

export const getTaskMarkerStyle = (task: Pick<Task, 'status' | 'audience'>): MarkerStyle =>
  task.audience === 'PARENT_TASK' ? PARENT_MARKER_STYLE : getTaskStatusColors(task.status);
