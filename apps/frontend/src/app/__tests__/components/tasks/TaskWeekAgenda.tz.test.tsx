import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskWeekAgenda from '@/app/features/tasks/components/TaskWeekAgenda';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  buildDateInPreferredTimeZone,
  getDatePartsInPreferredTimeZone,
  setPreferredTimeZone,
} from '@/app/lib/timezone';

// Real weekHelpers and @/app/lib/timezone (unlike TaskWeekAgenda.test.tsx) - this
// suite exists specifically to exercise the preferred-timezone day comparison
// those mocks would otherwise paper over.

jest.mock('@/app/hooks/useMemberMap', () => ({
  useMemberMap: () => ({ resolveMemberName: () => '-' }),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: { sub: 'me' } }),
}));

/** Monday 6 July 2026 at browser-local midnight - the week the desktop grid renders. */
const WEEK_START = new Date(2026, 6, 6);

/** Minutes `timeZone` sits ahead of UTC at `instant`. */
const zoneOffsetMinutes = (timeZone: string, instant: Date): number => {
  const utc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(instant.toLocaleString('en-US', { timeZone }));
  return Math.round((zoned.getTime() - utc.getTime()) / 60_000);
};

const CANDIDATE_ZONES = [
  'Pacific/Pago_Pago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
];

/** A zone at least six hours west of the test host. */
const pickZoneWestOfHost = (reference: Date): string => {
  const hostOffset = -reference.getTimezoneOffset();
  const zone = CANDIDATE_ZONES.find(
    (candidate) => zoneOffsetMinutes(candidate, reference) <= hostOffset - 360
  );
  if (!zone) throw new Error('No candidate timezone is far enough west of the test host.');
  return zone;
};

afterEach(() => {
  window.localStorage.clear();
  jest.useRealTimers();
});

describe('TaskWeekAgenda future-day tinting in a preferred timezone west of the host', () => {
  it("does not classify today's own column as a future day", () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    // "Now" is exactly the Monday column's own noon anchor - the instant a
    // day.getTime() > browser-midnight-of-now comparison would most reliably
    // misclassify as "future", since a noon anchor is virtually never also
    // browser-local midnight.
    jest.useFakeTimers().setSystemTime(days[0]);

    const monday = {
      _id: 'mon',
      name: 'Monday pending',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'me',
      dueAt: buildDateInPreferredTimeZone(days[0], 9 * 60),
    };
    const tuesday = {
      _id: 'tue',
      name: 'Tuesday pending',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'me',
      dueAt: buildDateInPreferredTimeZone(days[1], 9 * 60),
    };

    render(
      <TaskWeekAgenda
        filteredList={[monday, tuesday] as any}
        currentDate={WEEK_START}
        weekStart={WEEK_START}
        canEditTasks={false}
      />
    );

    // Today (Monday, clinic-timezone) reads as due today-or-earlier ("requested"),
    // not upcoming - the exact distinction isFutureDay exists to draw.
    expect(
      screen.getByRole('button', { name: 'Open task Monday pending' }).getAttribute('style')
    ).toContain('var(--status-requested-bg)');
    // Tuesday, one clinic day later, is genuinely upcoming.
    expect(
      screen.getByRole('button', { name: 'Open task Tuesday pending' }).getAttribute('style')
    ).toContain('var(--status-upcoming-bg)');
  });

  it('creates a new task at 9am on the clinic day of the clicked column, not the browser day', () => {
    const zone = pickZoneWestOfHost(WEEK_START);
    expect(setPreferredTimeZone(zone)).toBe(true);

    const days = getWeekDays(WEEK_START);
    jest.useFakeTimers().setSystemTime(days[0]);

    const onCreateFromCalendarSlot = jest.fn();
    render(
      <TaskWeekAgenda
        filteredList={[]}
        currentDate={WEEK_START}
        weekStart={WEEK_START}
        canEditTasks
        onCreateFromCalendarSlot={onCreateFromCalendarSlot}
      />
    );

    // Third column is the clinic's Wednesday (8 July).
    const addButtons = screen.getAllByRole('button', { name: /^Add task on/ });
    fireEvent.click(addButtons[2]);

    expect(onCreateFromCalendarSlot).toHaveBeenCalledTimes(1);
    const { dueAt } = onCreateFromCalendarSlot.mock.calls[0][0];
    const parts = getDatePartsInPreferredTimeZone(dueAt);
    expect(parts).toEqual({ year: 2026, month: 7, day: 8, hour: 9, minute: 0 });
  });
});
