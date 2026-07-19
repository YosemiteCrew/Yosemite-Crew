import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Appointment } from '@yosemite-crew/types';

import PhoneDayStrip, {
  buildPhoneDayStrip,
} from '@/app/features/appointments/components/Calendar/responsive/PhoneDayStrip';

const WEEK_START = new Date(2026, 6, 6);
const TODAY = new Date(2026, 6, 7, 10, 20);

const at = (day: number, hours = 9): Date => new Date(2026, 6, day, hours);

const makeAppointment = (day: number, overrides: Partial<Appointment> = {}): Appointment => ({
  id: `appt-${day}-${overrides.id ?? '1'}`,
  patient: {
    id: 'pet-1',
    name: 'Poppy',
    species: 'dog',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: 'org-1',
  appointmentDate: at(day),
  startTime: at(day),
  timeSlot: '09:00',
  durationMinutes: 30,
  endTime: at(day, 10),
  status: 'UPCOMING',
  ...overrides,
});

describe('buildPhoneDayStrip', () => {
  it('returns seven Monday-first cells starting at the week start', () => {
    const cells = buildPhoneDayStrip({
      weekStart: WEEK_START,
      appointments: [],
      selectedDate: TODAY,
      today: TODAY,
    });

    expect(cells).toHaveLength(7);
    expect(cells.map((cell) => cell.weekdayLabel)).toEqual([
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
      'SAT',
      'SUN',
    ]);
    expect(cells.map((cell) => cell.dayOfMonth)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('buckets appointments onto their own day and bands them into dots', () => {
    const cells = buildPhoneDayStrip({
      weekStart: WEEK_START,
      appointments: [
        makeAppointment(6, { id: 'a' }),
        makeAppointment(8, { id: 'b' }),
        ...Array.from({ length: 11 }, (_, index) => makeAppointment(9, { id: `c${index}` })),
      ],
      selectedDate: TODAY,
      today: TODAY,
    });

    expect(cells[0].appointmentCount).toBe(1);
    expect(cells[0].dotCount).toBe(1);
    expect(cells[1].appointmentCount).toBe(0);
    expect(cells[1].dotCount).toBe(0);
    // 11 appointments saturates the three-dot band.
    expect(cells[3].appointmentCount).toBe(11);
    expect(cells[3].dotCount).toBe(3);
  });

  it('marks today, past days and the selected day independently', () => {
    const cells = buildPhoneDayStrip({
      weekStart: WEEK_START,
      appointments: [],
      selectedDate: new Date(2026, 6, 9),
      today: TODAY,
    });

    expect(cells[0].isPast).toBe(true);
    expect(cells[0].isToday).toBe(false);
    expect(cells[1].isToday).toBe(true);
    expect(cells[1].isPast).toBe(false);
    expect(cells[1].isSelected).toBe(false);
    expect(cells[3].isSelected).toBe(true);
  });
});

describe('PhoneDayStrip', () => {
  const renderStrip = (onSelectDay?: (date: Date) => void) =>
    render(
      <PhoneDayStrip
        weekStart={WEEK_START}
        appointments={[makeAppointment(7, { id: 'a' })]}
        selectedDate={TODAY}
        today={TODAY}
        onSelectDay={onSelectDay}
      />
    );

  it('renders one labelled button per day with its load in the accessible name', () => {
    renderStrip();

    expect(screen.getByRole('group', { name: 'Select a day' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'TUE 7 · 1 appointments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MON 6 · 0 appointments' })).toBeInTheDocument();
  });

  it('marks the selected day pressed and today as the current date', () => {
    renderStrip();
    const tuesday = screen.getByRole('button', { name: 'TUE 7 · 1 appointments' });

    expect(tuesday).toHaveAttribute('aria-pressed', 'true');
    expect(tuesday).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: 'MON 6 · 0 appointments' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('renders one dot per load band and none for an empty day', () => {
    renderStrip();

    expect(screen.getByTestId('day-strip-dots-2026-07-07').children).toHaveLength(1);
    expect(screen.getByTestId('day-strip-dots-2026-07-06').children).toHaveLength(0);
  });

  it('reports the tapped day to the caller', () => {
    const onSelectDay = jest.fn();
    renderStrip(onSelectDay);

    fireEvent.click(screen.getByRole('button', { name: 'THU 9 · 0 appointments' }));

    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(onSelectDay.mock.calls[0][0].getDate()).toBe(9);
  });

  it('does not throw when no handler is supplied', () => {
    renderStrip();

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'THU 9 · 0 appointments' }))
    ).not.toThrow();
  });
});
