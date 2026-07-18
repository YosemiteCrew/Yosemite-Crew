import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Appointment } from '@yosemite-crew/types';

import PhoneWeekOverview from '@/app/features/appointments/components/Calendar/responsive/PhoneWeekOverview';
import { toDateKey } from '@/app/features/appointments/components/Calendar/responsive/phoneWeekLoad';

jest.mock('react-icons/io5', () => ({
  IoChevronBackOutline: () => <span data-testid="icon-back" />,
  IoChevronForwardOutline: () => <span data-testid="icon-forward" />,
  IoWarning: () => <span data-testid="icon-warning" />,
}));

/** Monday 6 July 2026 — the week the design renders. */
const WEEK_START = new Date(Date.UTC(2026, 6, 6, 12));

let idCounter = 0;

const dayOfWeek = (offset: number): Date => {
  const date = new Date(WEEK_START);
  date.setDate(WEEK_START.getDate() + offset);
  return date;
};

const MONDAY = dayOfWeek(0);
const TUESDAY = dayOfWeek(1);
const SUNDAY = dayOfWeek(6);

const makeAppointment = (
  date: Date,
  overrides: { status?: Appointment['status']; isEmergency?: boolean } = {}
): Appointment => {
  idCounter += 1;
  const { status = 'UPCOMING', isEmergency = false } = overrides;
  return {
    id: `appt-${idCounter}`,
    patient: {
      id: 'pet-1',
      name: 'Rex',
      species: 'Dog',
      parent: { id: 'parent-1', name: 'Ada' },
    },
    lead: { id: 'vet-1', name: 'Dr. Keller' },
    organisationId: 'org-1',
    appointmentDate: date,
    startTime: date,
    endTime: date,
    timeSlot: '09:00',
    durationMinutes: 30,
    status,
    isEmergency,
  };
};

const makeMany = (date: Date, count: number, overrides = {}) =>
  Array.from({ length: count }, () => makeAppointment(date, overrides));

const renderOverview = (props: Partial<React.ComponentProps<typeof PhoneWeekOverview>> = {}) =>
  render(<PhoneWeekOverview weekStart={WEEK_START} appointments={[]} {...props} />);

beforeEach(() => {
  idCounter = 0;
});

describe('PhoneWeekOverview — header', () => {
  it('renders the week title, range and clinic summary', () => {
    renderOverview({ appointments: makeMany(MONDAY, 3) });
    expect(screen.getByRole('heading', { name: 'Week 28' })).toBeInTheDocument();
    expect(screen.getByText('6 – 12 Jul')).toBeInTheDocument();
    expect(screen.getByText('3 appointments · 1 vet')).toBeInTheDocument();
  });

  it('names the region for screen readers', () => {
    renderOverview();
    expect(screen.getByRole('region', { name: 'Week 28, 6 – 12 Jul' })).toBeInTheDocument();
  });

  it('marks Week as the active view by default', () => {
    renderOverview();
    expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Day' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Month' })).not.toBeChecked();
  });

  it('honours an explicit active view', () => {
    renderOverview({ view: 'month' });
    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Week' })).not.toBeChecked();
  });

  it('reports the chosen view', async () => {
    const onViewChange = jest.fn();
    renderOverview({ onViewChange });
    await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
    expect(onViewChange).toHaveBeenCalledWith('day');
  });

  it('does not blow up when the view control has no handler', async () => {
    renderOverview();
    await userEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked();
  });
});

describe('PhoneWeekOverview — week navigation', () => {
  it('steps to the previous and next week', async () => {
    const onPreviousWeek = jest.fn();
    const onNextWeek = jest.fn();
    renderOverview({ onPreviousWeek, onNextWeek });

    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(onPreviousWeek).toHaveBeenCalledTimes(1);
    expect(onNextWeek).toHaveBeenCalledTimes(1);
  });

  it('disables the arrows when navigation is not wired up', () => {
    renderOverview();
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  });
});

describe('PhoneWeekOverview — day rows', () => {
  it('renders one row per weekday with its date', () => {
    renderOverview();
    expect(screen.getByText('MON')).toBeInTheDocument();
    expect(screen.getByText('SUN')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('renders the derived summary line for a loaded day', () => {
    renderOverview({
      appointments: makeMany(TUESDAY, 14),
      dayMeta: { [toDateKey(TUESDAY)]: { note: 'OR block am' } },
    });
    expect(screen.getByText(/14 appts · OR block am/)).toBeInTheDocument();
  });

  it('shows a proportional load bar whose segments are token-coloured', () => {
    renderOverview({
      appointments: makeMany(MONDAY, 5, { status: 'COMPLETED' }),
      defaultCapacity: 10,
    });
    const segment = screen.getByTestId('load-segment-2026-07-06-completed');
    expect(segment).toHaveStyle({ width: '50%' });
    expect(segment).toHaveStyle({ background: 'var(--status-completed-border)' });
  });

  it('renders every band of a mixed day in order', () => {
    renderOverview({
      appointments: [
        ...makeMany(MONDAY, 2, { status: 'COMPLETED' }),
        ...makeMany(MONDAY, 1, { status: 'IN_PROGRESS' }),
        ...makeMany(MONDAY, 1, { isEmergency: true }),
        ...makeMany(MONDAY, 2, { status: 'UPCOMING' }),
      ],
      defaultCapacity: 12,
    });
    const bar = screen.getByTestId('load-bar-2026-07-06');
    expect(bar.children).toHaveLength(4);
  });

  it('renders the emergency flag only on the day that has one', () => {
    renderOverview({
      appointments: [...makeMany(TUESDAY, 13), makeAppointment(TUESDAY, { isEmergency: true })],
    });
    expect(screen.getByText('1 EMERGENCY')).toBeInTheDocument();
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
  });

  it('renders no flag when nothing is urgent', () => {
    renderOverview({ appointments: makeMany(MONDAY, 4) });
    expect(screen.queryByTestId('icon-warning')).not.toBeInTheDocument();
  });

  it('selects a day when its row is pressed', async () => {
    const onSelectDay = jest.fn();
    renderOverview({ appointments: makeMany(MONDAY, 2), onSelectDay });

    const rows = screen.getAllByRole('button');
    const mondayRow = rows.find((row) => within(row).queryByText('MON'));
    await userEvent.click(mondayRow as HTMLElement);

    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(toDateKey(onSelectDay.mock.calls[0][0])).toBe('2026-07-06');
  });

  it('does not blow up when a row is pressed with no handler', async () => {
    renderOverview({ appointments: makeMany(MONDAY, 2) });
    const rows = screen.getAllByRole('button');
    const mondayRow = rows.find((row) => within(row).queryByText('MON'));
    await userEvent.click(mondayRow as HTMLElement);
    expect(screen.getByText('MON')).toBeInTheDocument();
  });

  it('marks the selected day as current', () => {
    renderOverview({ appointments: makeMany(TUESDAY, 2), selectedDate: TUESDAY });
    const selected = screen.getByRole('button', { current: 'date' });
    expect(within(selected).getByText('TUE')).toBeInTheDocument();
    expect(selected).toHaveClass('yc-pwo-row--selected');
  });

  it('marks no day as current when nothing is selected', () => {
    renderOverview({ appointments: makeMany(TUESDAY, 2) });
    expect(screen.queryByRole('button', { current: 'date' })).not.toBeInTheDocument();
  });

  it('tones down a day whose work is all done', () => {
    renderOverview({ appointments: makeMany(MONDAY, 8, { status: 'COMPLETED' }) });
    const rows = screen.getAllByRole('button');
    const mondayRow = rows.find((row) => within(row).queryByText('MON'));
    expect(mondayRow).toHaveClass('yc-pwo-row--done');
    expect(screen.getByText('8 appointments · all done')).toBeInTheDocument();
  });

  it('renders a closed day as a plain, non-interactive row without a bar', () => {
    renderOverview({ dayMeta: { [toDateKey(SUNDAY)]: { isClosed: true } } });

    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.queryByTestId('load-bar-2026-07-12')).not.toBeInTheDocument();

    const rows = screen.getAllByRole('button');
    expect(rows.some((row) => within(row).queryByText('SUN'))).toBe(false);
  });
});

describe('PhoneWeekOverview — legend', () => {
  it('explains every band of the bar, including free time', () => {
    renderOverview();
    ['Done', 'In progress', 'Upcoming', 'Free'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
