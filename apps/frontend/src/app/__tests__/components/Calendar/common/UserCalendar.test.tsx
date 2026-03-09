import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserCalendar from '@/app/features/appointments/components/Calendar/common/UserCalendar';

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

const mockAppointmentsForUser = jest.fn();
jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_VERTICAL_GAP_PX: 2,
  appointentsForUser: (...args: any[]) => mockAppointmentsForUser(...args),
  getFirstRelevantTimedEventStart: jest.fn(() => null),
  getTopPxForMinutes: jest.fn((minutes: number, hourHeight: number, gap: number, offset = 0) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours * (hourHeight + gap) + (mins / 60) * hourHeight + offset;
  }),
  isSameDay: () => true,
  MINUTES_PER_STEP: 5,
  PIXELS_PER_STEP: 25,
  minutesSinceStartOfDay: jest.fn((date: Date) => date.getHours() * 60 + date.getMinutes()),
  nextDay: jest.fn((date: Date) => new Date(date.getTime() + 24 * 60 * 60 * 1000)),
  scrollContainerToTarget: jest.fn(),
  startOfDayDate: jest.fn((date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  eventsForDayHour: jest.fn(() => []),
  HOURS_IN_DAY: 1,
}));

const userLabelsSpy = jest.fn();

jest.mock(
  '@/app/features/appointments/components/Calendar/common/UserLabels',
  () => (props: any) => {
    userLabelsSpy(props);
    return <div data-testid="user-labels" />;
  }
);

const slotSpy = jest.fn();

jest.mock('@/app/features/appointments/components/Calendar/common/Slot', () => (props: any) => {
  slotSpy(props);
  return <div data-testid="slot" />;
});

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      PrevDay
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Next', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      NextDay
    </button>
  ),
}));

import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

describe('UserCalendar (Appointments)', () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const setCurrentDate = jest.fn();

  const team = [
    { _id: 'u1', name: 'Alex' },
    { _id: 'u2', name: 'Sam' },
  ];

  const events: any[] = [{ id: 'a1', companion: { name: 'Rex' } }];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(team);
    mockAppointmentsForUser.mockReturnValue(events);
  });

  it('renders user labels and slots per team member', () => {
    render(
      <UserCalendar
        events={events}
        date={new Date('2025-01-06T00:00:00Z')}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByTestId('user-labels')).toBeInTheDocument();
    expect(userLabelsSpy).toHaveBeenCalledWith(expect.objectContaining({ team }));

    const slots = screen.getAllByTestId('slot');
    expect(slots.length).toBeGreaterThanOrEqual(team.length);
    expect(slots.length % team.length).toBe(0);

    expect(slotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handleViewAppointment,
        handleRescheduleAppointment,
        height: 180,
      })
    );
  });

  it('updates current date on navigation', () => {
    render(
      <UserCalendar
        events={events}
        date={new Date('2025-01-06T00:00:00Z')}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByText('PrevDay'));
    fireEvent.click(screen.getByText('NextDay'));

    const prevFn = setCurrentDate.mock.calls[0][0];
    const nextFn = setCurrentDate.mock.calls[1][0];

    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
  });
});
