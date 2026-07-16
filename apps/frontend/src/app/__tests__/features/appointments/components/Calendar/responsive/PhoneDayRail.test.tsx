import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Appointment } from '@yosemite-crew/types';

import PhoneDayRail from '@/app/features/appointments/components/Calendar/responsive/PhoneDayRail';
import { DEFAULT_DAY_RAIL_WINDOW } from '@/app/features/appointments/components/Calendar/responsive/dayRailLayout';

jest.mock('react-icons/io5', () => ({
  IoAdd: () => <span data-testid="icon-add" />,
  IoSwapVerticalOutline: () => <span data-testid="icon-expand" />,
}));

const DAY = '2026-07-07';
const at = (time: string): Date => new Date(`${DAY}T${time}:00`);

let idCounter = 0;

const makeAppointment = (
  start: string,
  end: string,
  overrides: Partial<Appointment> = {}
): Appointment => {
  idCounter += 1;
  return {
    id: `appt-${idCounter}`,
    patient: {
      id: `pet-${idCounter}`,
      name: 'Poppy',
      species: 'Dog',
      parent: { id: `parent-${idCounter}`, name: 'Lena Hartmann' },
    },
    organisationId: 'org-1',
    appointmentDate: at('00:00'),
    startTime: at(start),
    endTime: at(end),
    timeSlot: `${start}-${end}`,
    durationMinutes: 60,
    status: 'UPCOMING',
    concern: 'annual check-up',
    room: { id: 'room-1', name: 'Rm 1' },
    ...overrides,
  };
};

/** The design's day: 08-12 booked, 12-14 folded, 14-16 booked. */
const designDay = (): Appointment[] => [
  makeAppointment('08:30', '09:30', { status: 'CHECKED_IN' }),
  makeAppointment('09:45', '10:30', { concern: 'ear recheck' }),
  makeAppointment('11:06', '11:54', { concern: 'senior wellness' }),
  makeAppointment('14:00', '14:45', { concern: 'vaccination' }),
  makeAppointment('15:00', '16:00', { concern: 'lameness exam' }),
];

describe('PhoneDayRail', () => {
  it('exports the design default window', () => {
    expect(DEFAULT_DAY_RAIL_WINDOW).toEqual({ startHour: 8, endHour: 16 });
  });

  it('renders hour labels, skipping hours swallowed by a fold', () => {
    render(<PhoneDayRail appointments={designDay()} />);

    ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.queryByText('13:00')).not.toBeInTheDocument();
  });

  it('positions the first label at the top and the fold band proportionally', () => {
    render(<PhoneDayRail appointments={designDay()} />);

    expect(screen.getByText('08:00')).toHaveStyle({ top: '0%' });
    // First and last labels are nudged off the rail's edges.
    expect(screen.getByText('08:00')).toHaveClass('yc-day-rail__label--first');
    expect(screen.getByText('16:00')).toHaveClass('yc-day-rail__label--last');
    expect(screen.getByText('12:00')).not.toHaveClass('yc-day-rail__label--first');

    const fold = screen.getByTestId('day-rail-fold');
    // 4 full hours precede the fold out of 6 + 0.55 units.
    expect(fold).toHaveStyle({ top: `${Math.round((4 / 6.55) * 100 * 1000) / 1000}%` });
    expect(fold).toHaveStyle({ height: `${Math.round((0.55 / 6.55) * 100 * 1000) / 1000}%` });
    expect(within(fold).getByText('12:00 to 14:00 free · folded')).toBeInTheDocument();
  });

  it('renders one card per in-window appointment with title and meta', () => {
    render(<PhoneDayRail appointments={designDay()} />);

    expect(screen.getAllByTestId('day-rail-block')).toHaveLength(5);
    expect(screen.getByText('Poppy · annual check-up')).toBeInTheDocument();
    expect(screen.getByText('08:30–09:30 · Rm 1 · Lena Hartmann')).toBeInTheDocument();
  });

  it('falls back to the appointment type when there is no concern', () => {
    const appointment = makeAppointment('09:00', '10:00', {
      concern: undefined,
      appointmentType: {
        id: 'type-1',
        name: 'Dental',
        speciality: { id: 'spec-1', name: 'Dentistry' },
      },
    });
    render(<PhoneDayRail appointments={[appointment]} />);
    expect(screen.getByText('Poppy · Dental')).toBeInTheDocument();
  });

  it('renders just the patient name when there is no concern or type', () => {
    render(
      <PhoneDayRail appointments={[makeAppointment('09:00', '10:00', { concern: undefined })]} />
    );
    expect(screen.getByText('Poppy')).toBeInTheDocument();
  });

  it('omits a missing room from the card meta', () => {
    render(
      <PhoneDayRail appointments={[makeAppointment('09:00', '10:00', { room: undefined })]} />
    );
    expect(screen.getByText('09:00–10:00 · Lena Hartmann')).toBeInTheDocument();
  });

  it('shows a plain-language status for everything except upcoming', () => {
    render(<PhoneDayRail appointments={designDay()} />);
    expect(screen.getByText('Checked in')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
  });

  it('applies the matching status tokens to a card', () => {
    render(
      <PhoneDayRail appointments={[makeAppointment('09:00', '10:00', { status: 'NO_SHOW' })]} />
    );
    const block = screen.getByTestId('day-rail-block');
    expect(block.style.getPropertyValue('--block-bg')).toBe('var(--status-no-show-bg)');
    expect(block.style.getPropertyValue('--block-border')).toBe('var(--status-no-show-border)');
    expect(block.style.getPropertyValue('--block-text')).toBe('var(--status-no-show-text)');
  });

  it('lays overlapping cards into side-by-side lanes', () => {
    render(
      <PhoneDayRail
        appointments={[makeAppointment('09:00', '10:30'), makeAppointment('09:30', '11:00')]}
      />
    );
    const [first, second] = screen.getAllByTestId('day-rail-block');
    expect(first).toHaveStyle({ left: 'calc(56px + (100% - 66px) * 0)' });
    expect(second).toHaveStyle({ left: 'calc(56px + (100% - 66px) * 0.5)' });
  });

  it('calls onSelectAppointment when a card is tapped', async () => {
    const onSelectAppointment = jest.fn();
    const appointments = designDay();
    render(<PhoneDayRail appointments={appointments} onSelectAppointment={onSelectAppointment} />);

    await userEvent.click(screen.getByRole('button', { name: 'Poppy · annual check-up' }));
    expect(onSelectAppointment).toHaveBeenCalledWith(appointments[0]);
  });

  it('disables the card button when no select handler is supplied', () => {
    render(<PhoneDayRail appointments={designDay()} />);
    expect(screen.getByRole('button', { name: 'Poppy · annual check-up' })).toBeDisabled();
  });

  it('renders Start visit only for checked-in appointments and only with a handler', async () => {
    const onStartVisit = jest.fn();
    const appointments = designDay();
    const { rerender } = render(<PhoneDayRail appointments={appointments} />);
    expect(screen.queryByRole('button', { name: 'Start visit' })).not.toBeInTheDocument();

    rerender(<PhoneDayRail appointments={appointments} onStartVisit={onStartVisit} />);
    const buttons = screen.getAllByRole('button', { name: 'Start visit' });
    expect(buttons).toHaveLength(1);

    await userEvent.click(buttons[0]);
    expect(onStartVisit).toHaveBeenCalledWith(appointments[0]);
  });

  it('renders the Book chip inside a fold only when a handler is supplied', async () => {
    const onBookFold = jest.fn();
    const { rerender } = render(<PhoneDayRail appointments={designDay()} />);
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument();

    rerender(<PhoneDayRail appointments={designDay()} onBookFold={onBookFold} />);
    await userEvent.click(screen.getByRole('button', { name: 'Book' }));
    expect(onBookFold).toHaveBeenCalledWith(
      expect.objectContaining({ rangeLabel: '12:00 to 14:00', startMinutes: 720 })
    );
  });

  it('makes the fold label tappable only when an expand handler is supplied', async () => {
    const onExpandFold = jest.fn();
    const { rerender } = render(<PhoneDayRail appointments={designDay()} />);
    expect(screen.getByRole('button', { name: /free · folded/ })).toBeDisabled();

    rerender(<PhoneDayRail appointments={designDay()} onExpandFold={onExpandFold} />);
    await userEvent.click(screen.getByRole('button', { name: /free · folded/ }));
    expect(onExpandFold).toHaveBeenCalledWith(
      expect.objectContaining({ rangeLabel: '12:00 to 14:00' })
    );
  });

  it('renders the now marker inside the window', () => {
    render(<PhoneDayRail appointments={designDay()} nowMinutes={10 * 60 + 20} />);

    expect(screen.getByText('10:20')).toBeInTheDocument();
    // 10:20 is 2 1/3 hours into a 6.55-unit rail.
    const expected = Math.round(((2 + 1 / 3) / 6.55) * 100 * 1000) / 1000;
    expect(screen.getByTestId('day-rail-now-line')).toHaveStyle({ top: `${expected}%` });
  });

  it.each([
    ['before the window', 7 * 60],
    ['after the window', 17 * 60],
    ['omitted', null],
  ])('hides the now marker when it is %s', (_name, nowMinutes) => {
    render(<PhoneDayRail appointments={designDay()} nowMinutes={nowMinutes} />);
    expect(screen.queryByTestId('day-rail-now-line')).not.toBeInTheDocument();
  });

  it('hides the now marker when the window is invalid', () => {
    render(
      <PhoneDayRail
        appointments={[]}
        dayWindow={{ startHour: 8, endHour: 8 }}
        nowMinutes={8 * 60}
      />
    );
    expect(screen.queryByTestId('day-rail-now-line')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing booked today.')).not.toBeInTheDocument();
  });

  it('folds the whole day and shows the empty state when nothing is booked', () => {
    render(<PhoneDayRail appointments={[]} />);

    expect(screen.queryAllByTestId('day-rail-block')).toHaveLength(0);
    expect(screen.getByText('08:00 to 16:00 free · folded')).toBeInTheDocument();
    expect(screen.getByText('Nothing booked today.')).toBeInTheDocument();
  });

  it('accepts a custom empty label, aria label, window and fold tuning', () => {
    render(
      <PhoneDayRail
        appointments={[makeAppointment('10:00', '11:00')]}
        dayWindow={{ startHour: 9, endHour: 12 }}
        foldUnits={1}
        minFoldHours={1}
        ariaLabel="Tuesday schedule"
        emptyLabel="Clear day"
        className="custom-rail"
      />
    );

    const rail = screen.getByRole('region', { name: 'Tuesday schedule' });
    expect(rail).toHaveClass('yc-day-rail', 'custom-rail');
    expect(screen.getAllByTestId('day-rail-fold')).toHaveLength(2);
    expect(screen.queryByText('Clear day')).not.toBeInTheDocument();
  });

  it('matches the design snapshot for the folded day', () => {
    const { container } = render(
      <PhoneDayRail
        appointments={designDay()}
        nowMinutes={10 * 60 + 20}
        onSelectAppointment={jest.fn()}
        onStartVisit={jest.fn()}
        onBookFold={jest.fn()}
        onExpandFold={jest.fn()}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
