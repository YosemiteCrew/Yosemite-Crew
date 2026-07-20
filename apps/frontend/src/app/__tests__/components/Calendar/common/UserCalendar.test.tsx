import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserCalendar from '@/app/features/appointments/components/Calendar/common/UserCalendar';

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Calendar/useCalendarNow', () => ({
  useCalendarNow: jest.fn(),
}));

const mockAppointmentsForUser = jest.fn();
jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_VERTICAL_GAP_PX: 2,
  appointentsForUser: (...args: any[]) => mockAppointmentsForUser(...args),
  computeUnavailableSegments: jest.fn(() => []),
  getFirstRelevantTimedEventStart: jest.fn(() => null),
  getNowTopPxForHourRange: jest.fn((_: Date, __: number, ___: number, height: number) => height),
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
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';
import {
  computeUnavailableSegments,
  getFirstRelevantTimedEventStart,
  scrollContainerToTarget,
} from '@/app/features/appointments/components/Calendar/helpers';

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
    // Default: "now" is on a different calendar day than the tested dates,
    // so nowPosition resolves to null unless a test opts in.
    (useCalendarNow as jest.Mock).mockReturnValue(new Date('2020-01-01T00:00:00Z'));
    (computeUnavailableSegments as jest.Mock).mockReturnValue([]);
    (getFirstRelevantTimedEventStart as jest.Mock).mockReturnValue(null);
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

  it('renders the team day header with no in-grid day arrows', () => {
    // The planner frame's team header is a plain date band over the practitioner
    // columns; day navigation is owned by the header toolbar's date-nav pill
    // (covered in Header.test.tsx). The task calendar still passes its own arrows.
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

    expect(screen.queryByText('PrevDay')).not.toBeInTheDocument();
    expect(screen.queryByText('NextDay')).not.toBeInTheDocument();
    expect(setCurrentDate).not.toHaveBeenCalled();
  });

  it('renders zoom-out layout with availability, unavailable segments and the now indicator', () => {
    const today = new Date('2025-06-15T10:30:00Z');
    (useCalendarNow as jest.Mock).mockReturnValue(today);

    const teamWithPractitioner = [
      { _id: 'u1', practionerId: 'p1', name: 'Alex' },
      { _id: 'u2', name: 'Sam' },
    ];
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(teamWithPractitioner);
    (computeUnavailableSegments as jest.Mock).mockReturnValue([{ startMinute: 10, endMinute: 40 }]);

    const availabilityIntervals = [{ startMinute: 60, endMinute: 120 }];
    const dropIntervals = [{ startMinute: 0, endMinute: 30 }];
    const getVisibleAvailabilityIntervals = jest.fn(() => availabilityIntervals);
    const getDropAvailabilityIntervals = jest.fn(() => dropIntervals);

    const { container } = render(
      <UserCalendar
        events={events}
        date={today}
        zoomMode="out"
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        availabilityLoaded
        getVisibleAvailabilityIntervals={getVisibleAvailabilityIntervals}
        getDropAvailabilityIntervals={getDropAvailabilityIntervals}
      />
    );

    // getVisibleAvailabilityIntervals resolved for both the practitioner id and
    // the fallback _id.
    expect(getVisibleAvailabilityIntervals).toHaveBeenCalledWith(today, 'p1');
    expect(getVisibleAvailabilityIntervals).toHaveBeenCalledWith(today, 'u2');
    expect(getDropAvailabilityIntervals).toHaveBeenCalledWith(today, 'p1');

    // Unavailable overlay segment rendered (z-1 overlay is unique to it).
    expect(container.querySelectorAll('.pointer-events-none.z-1').length).toBeGreaterThan(0);

    // Now indicator rendered because "now" is on the same calendar day.
    expect(container.querySelector('.inset-0')).toBeInTheDocument();

    // Zoom-out row height and drop intervals forwarded to the Slot.
    expect(slotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 34,
        zoomMode: 'out',
        dropAvailabilityIntervals: dropIntervals,
        unavailableSegments: [{ startMinute: 10, endMinute: 40 }],
      })
    );

    // Auto-scroll used the now-position branch.
    expect(scrollContainerToTarget as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('auto-scrolls to the first relevant event when there is no now indicator', () => {
    (getFirstRelevantTimedEventStart as jest.Mock).mockReturnValue(
      new Date('2019-05-05T09:00:00Z')
    );

    render(
      <UserCalendar
        events={events}
        date={new Date('2019-05-05T00:00:00Z')}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(getFirstRelevantTimedEventStart as jest.Mock).toHaveBeenCalled();
    expect(scrollContainerToTarget as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('does not auto-scroll while an appointment is being dragged', () => {
    render(
      <UserCalendar
        events={events}
        date={new Date('2019-05-05T00:00:00Z')}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        draggedAppointmentId="drag-1"
      />
    );

    expect(scrollContainerToTarget as jest.Mock).not.toHaveBeenCalled();
  });

  it('does not auto-scroll when skipAutoScroll is set', () => {
    render(
      <UserCalendar
        events={events}
        date={new Date('2019-05-05T00:00:00Z')}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        skipAutoScroll
      />
    );

    expect(scrollContainerToTarget as jest.Mock).not.toHaveBeenCalled();
  });

  it('does not re-scroll for the same date when the effect re-runs', () => {
    const date = new Date('2019-05-05T00:00:00Z');
    const { rerender } = render(
      <UserCalendar
        events={events}
        date={date}
        zoomMode="in"
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(scrollContainerToTarget as jest.Mock).toHaveBeenCalledTimes(1);

    // Changing the zoom changes the row height (an effect dependency) which
    // re-runs the auto-scroll effect, but the date key is unchanged so it bails.
    rerender(
      <UserCalendar
        events={events}
        date={date}
        zoomMode="out"
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(scrollContainerToTarget as jest.Mock).toHaveBeenCalledTimes(1);
  });
});
