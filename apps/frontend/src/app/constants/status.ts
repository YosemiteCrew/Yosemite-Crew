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

export const AppointmentLabels: StatusLabel[] = [
  {
    name: 'Requested',
    key: 'requested',
    bg: 'var(--status-requested-bg)',
    text: 'var(--status-requested-text)',
    border: 'var(--status-requested-border)',
  },
  {
    name: 'Upcoming',
    key: 'upcoming',
    bg: 'var(--status-upcoming-bg)',
    text: 'var(--status-upcoming-text)',
    border: 'var(--status-upcoming-border)',
  },
  {
    name: 'Checked-in',
    key: 'checked_in',
    bg: 'var(--status-checked-in-bg)',
    text: 'var(--status-checked-in-text)',
    border: 'var(--status-checked-in-border)',
  },
  {
    name: 'In progress',
    key: 'in_progress',
    bg: 'var(--status-in-progress-bg)',
    text: 'var(--status-in-progress-text)',
    border: 'var(--status-in-progress-border)',
  },
  {
    name: 'Completed',
    key: 'completed',
    bg: 'var(--status-completed-bg)',
    text: 'var(--status-completed-text)',
    border: 'var(--status-completed-border)',
  },
  {
    name: 'Cancelled',
    key: 'cancelled',
    bg: 'var(--status-cancelled-bg)',
    text: 'var(--status-cancelled-text)',
    border: 'var(--status-cancelled-border)',
  },
];

export const TaskLabels: StatusLabel[] = [
  {
    name: 'Pending',
    key: 'pending',
    bg: 'var(--status-requested-bg)',
    text: 'var(--status-requested-text)',
    border: 'var(--status-requested-border)',
  },
  {
    name: 'In progress',
    key: 'in_progress',
    bg: 'var(--status-in-progress-bg)',
    text: 'var(--status-in-progress-text)',
    border: 'var(--status-in-progress-border)',
  },
  {
    name: 'Completed',
    key: 'completed',
    bg: 'var(--status-completed-bg)',
    text: 'var(--status-completed-text)',
    border: 'var(--status-completed-border)',
  },
  {
    name: 'Cancelled',
    key: 'cancelled',
    bg: 'var(--status-cancelled-bg)',
    text: 'var(--status-cancelled-text)',
    border: 'var(--status-cancelled-border)',
  },
];
