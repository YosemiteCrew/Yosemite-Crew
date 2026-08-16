import {
  AppointmentFilters,
  AppointmentStatusFilters,
  AppointmentStatusFiltersUI,
  AppointmentStatusOptions,
} from '@/app/features/appointments/types/appointments';

describe('appointments types', () => {
  it('keeps the appointment status dropdown options', () => {
    expect(AppointmentStatusOptions).toEqual([
      { value: 'REQUESTED', label: 'Requested' },
      { value: 'UPCOMING', label: 'Upcoming' },
      { value: 'CHECKED_IN', label: 'Checked in' },
      { value: 'IN_PROGRESS', label: 'In progress' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'CANCELLED', label: 'Cancelled' },
      { value: 'NO_SHOW', label: 'No show' },
    ]);
  });

  it('keeps the exact status filter pills with their per-status CSS tokens', () => {
    expect(AppointmentStatusFilters).toEqual([
      {
        name: 'All',
        key: 'all',
        bg: 'var(--status-requested-bg)',
        text: 'var(--status-requested-text)',
        border: 'var(--status-requested-border)',
        dropdownText: undefined,
      },
      {
        name: 'Requested',
        key: 'requested',
        bg: 'var(--status-requested-bg)',
        text: 'var(--status-requested-text)',
        border: 'var(--status-requested-border)',
        dropdownText: undefined,
      },
      {
        name: 'Upcoming',
        key: 'upcoming',
        bg: 'var(--status-upcoming-bg)',
        text: 'var(--status-upcoming-text)',
        border: 'var(--status-upcoming-border)',
        dropdownText: undefined,
      },
      {
        name: 'Checked in',
        key: 'checked_in',
        bg: 'var(--status-checked-in-bg)',
        text: 'var(--status-checked-in-text)',
        border: 'var(--status-checked-in-border)',
        dropdownText: undefined,
      },
      {
        name: 'In progress',
        key: 'in_progress',
        bg: 'var(--status-in-progress-bg)',
        text: 'var(--status-in-progress-text)',
        border: 'var(--status-in-progress-border)',
        dropdownText: undefined,
      },
      {
        name: 'Completed',
        key: 'completed',
        bg: 'var(--status-completed-bg)',
        text: 'var(--status-completed-text)',
        border: 'var(--status-completed-border)',
        dropdownText: undefined,
      },
      {
        name: 'Cancelled',
        key: 'cancelled',
        bg: 'var(--status-cancelled-bg)',
        text: 'var(--status-cancelled-text)',
        border: 'var(--status-cancelled-border)',
        dropdownText: undefined,
      },
      {
        name: 'No show',
        key: 'no_show',
        bg: 'var(--status-no-show-bg)',
        text: 'var(--status-no-show-text)',
        border: 'var(--status-no-show-border)',
        dropdownText: undefined,
      },
    ]);
  });

  it('reuses the same array for the UI filter list', () => {
    expect(AppointmentStatusFiltersUI).toBe(AppointmentStatusFilters);
  });

  it('keeps the emergencies quick filter', () => {
    expect(AppointmentFilters).toEqual([{ name: 'Emergencies', key: 'emergencies' }]);
  });
});
