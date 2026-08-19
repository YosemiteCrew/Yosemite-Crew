import {
  AppointmentLabels,
  TaskLabels,
  getAppointmentStatusTone,
  getStatusStyle,
  statusLabel,
} from '@/app/constants/status';

describe('statusLabel', () => {
  it('derives all colour tokens from the css prefix', () => {
    expect(statusLabel('Upcoming', 'upcoming', 'status-upcoming')).toEqual({
      name: 'Upcoming',
      key: 'upcoming',
      bg: 'var(--status-upcoming-bg)',
      text: 'var(--status-upcoming-text)',
      border: 'var(--status-upcoming-border)',
    });
  });

  it('honours a border override', () => {
    expect(statusLabel('All', 'ALL', 'color-badge-blue', 'var(--color-primary-500)')).toEqual({
      name: 'All',
      key: 'ALL',
      bg: 'var(--color-badge-blue-bg)',
      text: 'var(--color-badge-blue-text)',
      border: 'var(--color-primary-500)',
    });
  });
});

describe('status label tables', () => {
  it('keeps the appointment labels identical to the original token values', () => {
    expect(AppointmentLabels).toEqual([
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
        name: 'Checked in',
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
    ]);
  });

  it('keeps the task labels identical to the original token values', () => {
    expect(TaskLabels).toEqual([
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
    ]);
  });
});

describe('getStatusStyle', () => {
  it('matches statuses case-insensitively', () => {
    expect(getStatusStyle('Completed')).toEqual({
      color: 'var(--status-completed-text)',
      backgroundColor: 'var(--status-completed-bg)',
      borderColor: 'var(--status-completed-border)',
    });
  });

  it('falls back to the requested tokens for unknown statuses', () => {
    expect(getStatusStyle('mystery')).toEqual({
      color: 'var(--status-requested-text)',
      backgroundColor: 'var(--status-requested-bg)',
      borderColor: 'var(--status-requested-border)',
    });
  });
});

describe('getAppointmentStatusTone', () => {
  it.each([
    ['completed', 'success'],
    ['In Progress', 'progress'],
    ['checked-in', 'accent'],
    ['upcoming', 'info'],
    ['cancelled', 'warning'],
    ['no show', 'warning'],
    ['NO_PAYMENT', 'warning'],
    ['pending', 'neutral'],
    ['requested', 'neutral'],
    ['anything else', 'neutral'],
  ])('maps %s to %s', (status, tone) => {
    expect(getAppointmentStatusTone(status)).toBe(tone);
  });

  it('treats missing statuses as neutral', () => {
    expect(getAppointmentStatusTone(null)).toBe('neutral');
    expect(getAppointmentStatusTone(undefined)).toBe('neutral');
  });
});
