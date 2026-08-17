import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Appointment } from '@yosemite-crew/types';
import type { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import PhoneMonthOverview from '@/app/features/appointments/components/Calendar/responsive/PhoneMonthOverview';

jest.mock('react-icons/io5', () => ({
  IoArrowForward: () => <span data-testid="icon-arrow-forward" />,
  IoChevronBackOutline: () => <span data-testid="icon-chevron-back" />,
  IoChevronForwardOutline: () => <span data-testid="icon-chevron-forward" />,
  IoWarning: () => <span data-testid="icon-warning" />,
}));

beforeEach(() => {
  window.localStorage.clear();
});

let sequence = 0;

const makeAppointment = ({
  startTime,
  ...overrides
}: Partial<Appointment> & { startTime: Date }): Appointment => {
  sequence += 1;
  return {
    id: `appt-${sequence}`,
    patient: {
      id: `pet-${sequence}`,
      name: 'Poppy',
      species: 'Dog',
      parent: { id: 'parent-1', name: 'Lena Hartmann' },
    },
    organisationId: 'org-1',
    appointmentDate: startTime,
    startTime,
    endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    timeSlot: '08:30',
    durationMinutes: 30,
    status: 'UPCOMING' as AppointmentStatus,
    ...overrides,
  };
};

const appointmentsOn = (day: number, count: number, overrides: Partial<Appointment> = {}) =>
  Array.from({ length: count }, (_, index) =>
    makeAppointment({ startTime: new Date(Date.UTC(2026, 6, day, 8, index)), ...overrides })
  );

const MONTH = new Date(Date.UTC(2026, 6, 15, 12)); // July 2026
const TODAY = new Date(Date.UTC(2026, 6, 7, 8)); // Tue 7 Jul, 10:00 Berlin
const SELECTED = new Date(Date.UTC(2026, 6, 7, 8));

const renderOverview = (props: Partial<React.ComponentProps<typeof PhoneMonthOverview>> = {}) =>
  render(<PhoneMonthOverview monthDate={MONTH} today={TODAY} appointments={[]} {...props} />);

const dayButton = (dateKey: string, count: number) =>
  screen.getByRole('button', { name: `${dateKey} · ${count} appointments` });

describe('PhoneMonthOverview — header', () => {
  it('renders the month, summary and navigator', () => {
    renderOverview({ appointments: [...appointmentsOn(7, 14), ...appointmentsOn(1, 3)] });

    expect(screen.getByRole('heading', { name: 'July' })).toBeInTheDocument();
    expect(screen.getByText('July 2026')).toBeInTheDocument();
    expect(screen.getByText('17 appointments · busiest week: 28')).toBeInTheDocument();
  });

  it('renders an empty month', () => {
    renderOverview();
    expect(screen.getByText('No appointments')).toBeInTheDocument();
  });

  it('steps to the previous and next month', async () => {
    const onMonthChange = jest.fn();
    renderOverview({ onMonthChange });

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(new Date(Date.UTC(2026, 5, 15, 12)));

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(new Date(Date.UTC(2026, 7, 15, 12)));
  });

  it('survives month navigation without a handler', async () => {
    renderOverview();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('renders the Day/Week/Month control with Month active', () => {
    renderOverview();
    const group = screen.getByRole('group', { name: 'Calendar view' });

    expect(within(group).getByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(within(group).getByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('reports a view change', async () => {
    const onViewChange = jest.fn();
    renderOverview({ onViewChange });

    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onViewChange).toHaveBeenCalledWith('week');
  });

  it('honours a non-default view', () => {
    renderOverview({ view: 'day' });
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('survives a view change without a handler', async () => {
    renderOverview();
    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PhoneMonthOverview — dot map', () => {
  it('renders a Monday-first weekday header', () => {
    renderOverview();
    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('renders the full padded grid including adjacent-month days', () => {
    renderOverview();
    const grid = screen.getByRole('button', { name: '2026-06-29 · 0 appointments' });

    expect(grid).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026-08-02 · 0 appointments' })).toBeInTheDocument();
    // 35 day cells + 2 nav + 3 segmented = 40 buttons.
    expect(screen.getAllByRole('button')).toHaveLength(40);
  });

  it('separates padding and quiet days by ink, not by fading them', () => {
    renderOverview({ appointments: appointmentsOn(1, 2) });

    const padding = dayButton('2026-06-29', 0);
    const quiet = dayButton('2026-07-05', 0);
    const busy = dayButton('2026-07-01', 2);

    // No alpha anywhere - that is what made the padding days unreadable.
    for (const cell of [padding, quiet, busy]) {
      expect(cell.className).not.toContain('opacity-');
    }

    // And the three really are distinguishable. Asserting only the absence of
    // opacity let padding and quiet days collapse onto the same ink while this
    // test still passed, which is exactly what happened.
    const ink = (cell: HTMLElement) =>
      cell.querySelector('span')?.className.match(/text-\[var\(--[a-z-]+\)\]/)?.[0];

    expect(ink(padding)).toBe('text-[var(--ink-faint)]');
    expect(ink(quiet)).toBe('text-[var(--ink-muted)]');
    expect(ink(padding)).not.toBe(ink(quiet));
    // `busy` is deliberately not compared: it is a PAST day here, so it takes
    // the past branch and legitimately shares --ink-muted with a quiet day.
  });

  it('renders dots rather than event chips, capped at three', () => {
    renderOverview({
      appointments: [...appointmentsOn(1, 8), ...appointmentsOn(2, 80), ...appointmentsOn(3, 1)],
    });

    expect(screen.getByTestId('dots-2026-07-01').children).toHaveLength(2);
    expect(screen.getByTestId('dots-2026-07-02').children).toHaveLength(3);
    expect(screen.getByTestId('dots-2026-07-03').children).toHaveLength(1);
    expect(screen.getByTestId('dots-2026-07-05').children).toHaveLength(0);
  });

  it('colours past load as done and live load as blue', () => {
    renderOverview({ appointments: [...appointmentsOn(1, 1), ...appointmentsOn(20, 1)] });

    expect(screen.getByTestId('dots-2026-07-01').children[0]).toHaveStyle({
      background: 'var(--status-completed-border)',
    });
    expect(screen.getByTestId('dots-2026-07-20').children[0]).toHaveStyle({
      background: 'var(--blue)',
    });
  });

  it('bleeds the last dot red on an emergency day', () => {
    renderOverview({
      appointments: [...appointmentsOn(9, 2), ...appointmentsOn(9, 1, { isEmergency: true })],
    });

    const dots = screen.getByTestId('dots-2026-07-09').children;
    expect(dots).toHaveLength(1);
    expect(dots[0]).toHaveStyle({ background: 'var(--danger)' });
  });

  it('marks today', () => {
    renderOverview();
    expect(dayButton('2026-07-07', 0)).toHaveAttribute('aria-current', 'date');
    expect(dayButton('2026-07-08', 0)).not.toHaveAttribute('aria-current');
  });

  it('indicates the selected day with a filled circle and aria-pressed', () => {
    renderOverview({ selectedDate: SELECTED, appointments: appointmentsOn(7, 14) });

    const selected = dayButton('2026-07-07', 14);
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(within(selected).getByText('7').className).toContain('bg-[var(--blue-strong)]');
    expect(dayButton('2026-07-08', 0)).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports a day selection', async () => {
    const onSelectDay = jest.fn();
    renderOverview({ onSelectDay, appointments: appointmentsOn(9, 4) });

    await userEvent.click(dayButton('2026-07-09', 4));
    expect(onSelectDay).toHaveBeenCalledWith(
      expect.objectContaining({ dateKey: '2026-07-09', appointmentCount: 4, dotCount: 1 })
    );
  });

  it('survives a day tap without a handler', async () => {
    renderOverview();
    await userEvent.click(dayButton('2026-07-09', 0));
    expect(screen.getByRole('heading', { name: 'July' })).toBeInTheDocument();
  });
});

describe('PhoneMonthOverview — day peek', () => {
  const peekAppointments = [
    makeAppointment({
      startTime: new Date(Date.UTC(2026, 6, 7, 6, 30)),
      status: 'CHECKED_IN',
      lead: { id: 'v1', name: 'Dr. Weber' },
      room: { id: 'r1', name: 'Rm 1' },
      appointmentType: {
        id: 't1',
        name: 'annual check-up',
        speciality: { id: 's1', name: 'General' },
      },
    }),
    makeAppointment({
      startTime: new Date(Date.UTC(2026, 6, 7, 7, 0)),
      status: 'IN_PROGRESS',
      lead: { id: 'v2', name: 'Dr. Brunner' },
      room: { id: 'r2', name: 'OR' },
      concern: 'mass removal',
    }),
    makeAppointment({
      startTime: new Date(Date.UTC(2026, 6, 7, 8, 48)),
      isEmergency: true,
      lead: { id: 'v2', name: 'Dr. Brunner' },
      concern: 'suspected toxicity',
    }),
    // Filler that sits later in the day, so the three above stay at the top.
    ...Array.from({ length: 11 }, (_, index) =>
      makeAppointment({ startTime: new Date(Date.UTC(2026, 6, 7, 11, index)) })
    ),
  ];

  it('shows no peek until a day is picked', () => {
    renderOverview({ appointments: peekAppointments });
    expect(screen.queryByRole('button', { name: /Open day/ })).not.toBeInTheDocument();
  });

  it('heads the peek with the day and its load', () => {
    renderOverview({ selectedDate: SELECTED, appointments: peekAppointments });
    expect(screen.getByText('Tue 7 · 14 appointments')).toBeInTheDocument();
  });

  it('lists the first three appointments and counts the rest', () => {
    renderOverview({ selectedDate: SELECTED, appointments: peekAppointments });

    expect(screen.getByText('Poppy · annual check-up')).toBeInTheDocument();
    expect(screen.getByText('Dr. Weber · Rm 1')).toBeInTheDocument();
    expect(screen.getByText('CHECKED IN')).toBeInTheDocument();
    expect(screen.getByText('Poppy · mass removal')).toBeInTheDocument();
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('08:30')).toBeInTheDocument();
    expect(screen.getByText('+11 more · swipe up')).toBeInTheDocument();
  });

  it('badges an emergency row', () => {
    renderOverview({ selectedDate: SELECTED, appointments: peekAppointments });

    expect(screen.getByText('Poppy · suspected toxicity')).toBeInTheDocument();
    expect(screen.getByText('EMERGENCY')).toBeInTheDocument();
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
    expect(screen.getByText('10:48').className).toContain('text-[var(--danger-text)]');
  });

  it('never shows a raw status enum', () => {
    renderOverview({ selectedDate: SELECTED, appointments: peekAppointments });
    expect(screen.queryByText(/CHECKED_IN|IN_PROGRESS|NO_SHOW/)).not.toBeInTheDocument();
  });

  it('omits the remainder line when the day fits', () => {
    renderOverview({ selectedDate: SELECTED, appointments: appointmentsOn(7, 2) });

    expect(screen.getByText('Tue 7 · 2 appointments')).toBeInTheDocument();
    expect(screen.queryByText(/swipe up/)).not.toBeInTheDocument();
  });

  it('renders an empty selected day', () => {
    renderOverview({ selectedDate: new Date(Date.UTC(2026, 6, 5, 8)) });
    expect(screen.getByText('Sun 5 · 0 appointments')).toBeInTheDocument();
  });

  it('opens the selected day', async () => {
    const onOpenDay = jest.fn();
    renderOverview({ selectedDate: SELECTED, appointments: peekAppointments, onOpenDay });

    await userEvent.click(screen.getByRole('button', { name: /Open day/ }));
    expect(onOpenDay).toHaveBeenCalledWith('2026-07-07');
  });

  it('survives Open day without a handler', async () => {
    renderOverview({ selectedDate: SELECTED, appointments: peekAppointments });
    await userEvent.click(screen.getByRole('button', { name: /Open day/ }));
    expect(screen.getByText('Tue 7 · 14 appointments')).toBeInTheDocument();
  });
});

describe('PhoneMonthOverview — misc', () => {
  it('applies a caller className', () => {
    const { container } = renderOverview({ className: 'custom-shell' });
    expect(container.querySelector('section')).toHaveClass('custom-shell');
  });

  it('defaults today to now', () => {
    jest.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 6, 7, 8)));
    render(<PhoneMonthOverview monthDate={MONTH} appointments={[]} />);

    expect(dayButton('2026-07-07', 0)).toHaveAttribute('aria-current', 'date');
    jest.useRealTimers();
  });

  it('matches the month overview layout', () => {
    const { container } = renderOverview({
      selectedDate: SELECTED,
      appointments: appointmentsOn(7, 4),
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
