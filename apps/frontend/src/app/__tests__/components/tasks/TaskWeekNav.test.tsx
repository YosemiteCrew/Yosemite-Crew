import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskWeekNav from '@/app/features/tasks/components/TaskWeekNav';

// Deterministic Monday-aligned week starting at whatever currentDate we pass.
jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getStartOfWeek: (d: Date) => d,
  getWeekDays: (start: Date) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      return day;
    }),
}));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

jest.mock('@/app/lib/timezone', () => ({
  formatDateInPreferredTimeZone: (date: Date, opts: any = {}) => {
    const d = new Date(date);
    if (opts.month === 'short' && opts.day == null) return MONTHS[d.getMonth()];
    return String(d.getDate());
  },
}));

describe('TaskWeekNav', () => {
  const setCurrentDate = jest.fn();
  const setWeekStart = jest.fn();

  // Week: Mon Jul 6 2026 .. Sun Jul 12 2026.
  const monday = new Date(2026, 6, 6);

  const renderNav = (overrides: Partial<React.ComponentProps<typeof TaskWeekNav>> = {}) =>
    render(
      <TaskWeekNav
        currentDate={monday}
        setCurrentDate={setCurrentDate}
        setWeekStart={setWeekStart}
        {...overrides}
      />
    );

  beforeEach(() => jest.clearAllMocks());

  it('labels the visible week range within a single month', () => {
    renderNav();
    expect(screen.getByText('6 – 12 Jul')).toBeInTheDocument();
  });

  it('formats a week range that spans two months', () => {
    renderNav({ currentDate: new Date(2026, 6, 29) }); // Wed Jul 29 → Jul 29 .. Aug 4
    expect(screen.getByText('29 Jul – 4 Aug')).toBeInTheDocument();
  });

  it('steps the week back and forward through both date setters', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(setCurrentDate).toHaveBeenCalledTimes(2);
    expect(setWeekStart).toHaveBeenCalledTimes(2);

    const prevCurrent = setCurrentDate.mock.calls[0][0] as (d: Date) => Date;
    const nextCurrent = setCurrentDate.mock.calls[1][0] as (d: Date) => Date;
    expect(prevCurrent(new Date(2026, 6, 8)).getDate()).toBe(1);
    expect(nextCurrent(new Date(2026, 6, 8)).getDate()).toBe(15);

    const prevWeekStart = setWeekStart.mock.calls[0][0] as (d: Date) => Date;
    const nextWeekStart = setWeekStart.mock.calls[1][0] as (d: Date) => Date;
    expect(prevWeekStart(new Date(2026, 6, 8)).getDate()).toBe(1);
    expect(nextWeekStart(new Date(2026, 6, 8)).getDate()).toBe(15);
  });
});
