import { Task } from '@/app/features/tasks/types/task';

/**
 * Visual variant for a task card on the week-agenda and board surfaces. Pet-parent
 * tasks always render pink (the design reserves pink for pet-parent work); every
 * other task takes its colour from status, and a pending task dated after today
 * reads as "upcoming" (blue) rather than the neutral "requested" grey the design
 * uses for pending work due today or earlier.
 */
export type TaskCardVariant =
  'completed' | 'cancelled' | 'in_progress' | 'upcoming' | 'requested' | 'parent';

export const getTaskCardVariant = (task: Task, isFutureDay = false): TaskCardVariant => {
  if (task.audience === 'PARENT_TASK') return 'parent';
  switch (task.status) {
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'IN_PROGRESS':
      return 'in_progress';
    default:
      return isFutureDay ? 'upcoming' : 'requested';
  }
};

type AgendaCardStyle = {
  background: string;
  borderColor: string;
  textColor: string;
  /** Softer colour for the meta line under the title. */
  metaColor: string;
  /** Extra card shadow (only the pink parent card carries a glow). */
  boxShadow?: string;
};

const STATUS_TOKEN: Record<Exclude<TaskCardVariant, 'parent'>, string> = {
  completed: 'completed',
  cancelled: 'cancelled',
  in_progress: 'in-progress',
  upcoming: 'upcoming',
  requested: 'requested',
};

/**
 * Token-driven fill/border/text for an agenda card. Tinted variants use the
 * matching `--status-*` family; the pet-parent variant sits on `--screen` with a
 * `--pink` hairline and the soft pink glow, matching the design's parent card.
 */
export const getAgendaCardStyle = (variant: TaskCardVariant): AgendaCardStyle => {
  if (variant === 'parent') {
    return {
      background: 'var(--screen)',
      borderColor: 'var(--pink)',
      textColor: 'var(--ink)',
      metaColor: 'var(--ink-faint)',
      boxShadow: '0 4px 12px var(--glow-p12)',
    };
  }
  const token = STATUS_TOKEN[variant];
  return {
    background: `var(--status-${token}-bg)`,
    borderColor: `var(--status-${token}-border)`,
    textColor: `var(--status-${token}-text)`,
    metaColor: `var(--status-${token}-text)`,
  };
};
