import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';

export type StatusStyle = {
  color: string;
  backgroundColor: string;
  borderColor: string;
};

export type StatusLabel = {
  name: string;
  key: string;
  bg: string;
  text: string;
  border: string;
};

const statusStyles: Record<string, StatusStyle> = {
  no_payment: {
    color: 'var(--status-cancelled-text)',
    backgroundColor: 'var(--status-cancelled-bg)',
    borderColor: 'var(--status-cancelled-border)',
  },
  in_progress: {
    color: 'var(--status-in-progress-text)',
    backgroundColor: 'var(--status-in-progress-bg)',
    borderColor: 'var(--status-in-progress-border)',
  },
  completed: {
    color: 'var(--status-completed-text)',
    backgroundColor: 'var(--status-completed-bg)',
    borderColor: 'var(--status-completed-border)',
  },
  checked_in: {
    color: 'var(--status-checked-in-text)',
    backgroundColor: 'var(--status-checked-in-bg)',
    borderColor: 'var(--status-checked-in-border)',
  },
  requested: {
    color: 'var(--status-requested-text)',
    backgroundColor: 'var(--status-requested-bg)',
    borderColor: 'var(--status-requested-border)',
  },
  cancelled: {
    color: 'var(--status-cancelled-text)',
    backgroundColor: 'var(--status-cancelled-bg)',
    borderColor: 'var(--status-cancelled-border)',
  },
  no_show: {
    color: 'var(--status-no-show-text)',
    backgroundColor: 'var(--status-no-show-bg)',
    borderColor: 'var(--status-no-show-border)',
  },
  pending: {
    color: 'var(--status-requested-text)',
    backgroundColor: 'var(--status-requested-bg)',
    borderColor: 'var(--status-requested-border)',
  },
  upcoming: {
    color: 'var(--status-upcoming-text)',
    backgroundColor: 'var(--status-upcoming-bg)',
    borderColor: 'var(--status-upcoming-border)',
  },
};

const defaultStatusStyle: StatusStyle = {
  color: 'var(--status-requested-text)',
  backgroundColor: 'var(--status-requested-bg)',
  borderColor: 'var(--status-requested-border)',
};

export const getStatusStyle = (status: string): StatusStyle => {
  return statusStyles[status?.toLowerCase()] ?? defaultStatusStyle;
};

export const getAppointmentStatusTone = (status?: string | null): StatusTone => {
  const key = String(status ?? '')
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, '_');
  switch (key) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'progress';
    case 'checked_in':
      return 'accent';
    case 'upcoming':
      return 'info';
    case 'cancelled':
    case 'no_show':
    case 'no_payment':
      return 'warning';
    case 'pending':
    case 'requested':
    default:
      return 'neutral';
  }
};

/**
 * Builds a StatusLabel whose colour tokens all derive from one CSS variable
 * prefix (`--<prefix>-bg` / `--<prefix>-text` / `--<prefix>-border`).
 *
 * There is deliberately no per-token override. The one entry that used it - the
 * "All" filter option - borrowed a prefix whose `bg`/`text` it never meant to
 * use and replaced the odd one out at each point of use, which is how a 3.61:1
 * pair stayed in the data with nothing rendering it (#2814). An entry that
 * needs different colours gets its own prefix.
 */
export const statusLabel = (name: string, key: string, cssPrefix: string): StatusLabel => ({
  name,
  key,
  bg: `var(--${cssPrefix}-bg)`,
  text: `var(--${cssPrefix}-text)`,
  border: `var(--${cssPrefix}-border)`,
});

/**
 * The neutral "All" row shared by the status-filter dropdown panels.
 *
 * One construction site rather than three copies of the same literal, so the
 * contrast guard measures the object the panels actually render.
 */
export const AllFilterOption: StatusLabel = statusLabel('All', 'ALL', 'color-pill-all');

export const AppointmentLabels: StatusLabel[] = [
  statusLabel('Requested', 'requested', 'status-requested'),
  statusLabel('Upcoming', 'upcoming', 'status-upcoming'),
  statusLabel('Checked in', 'checked_in', 'status-checked-in'),
  statusLabel('In progress', 'in_progress', 'status-in-progress'),
  statusLabel('Completed', 'completed', 'status-completed'),
  statusLabel('Cancelled', 'cancelled', 'status-cancelled'),
];

export const TaskLabels: StatusLabel[] = [
  statusLabel('Pending', 'pending', 'status-requested'),
  statusLabel('In progress', 'in_progress', 'status-in-progress'),
  statusLabel('Completed', 'completed', 'status-completed'),
  statusLabel('Cancelled', 'cancelled', 'status-cancelled'),
];
