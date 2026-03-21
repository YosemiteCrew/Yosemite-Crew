import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserCalendar from '@/app/features/appointments/components/Calendar/Task/UserCalendar';
import { Task } from '@/app/features/tasks/types/task';

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  HOURS_IN_DAY: 1,
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  eventsForUser: jest.fn(),
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_VERTICAL_GAP_PX: 0,
  MINUTES_PER_STEP: 15,
  PIXELS_PER_STEP: 60,
  nextDay: (date: Date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return next;
  },
  startOfDayDate: (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  },
  getFirstRelevantTimedEventStart: jest.fn(() => null),
  getNowTopPxForHourRange: jest.fn((_: Date, __: number, ___: number, height: number) => height),
  getTopPxForMinutes: jest.fn((minutes: number, height: number) => (minutes / 60) * height),
  minutesSinceStartOfDay: jest.fn(() => 540),
  scrollContainerToTarget: jest.fn(),
}));

const userLabelsSpy = jest.fn();
jest.mock(
  '@/app/features/appointments/components/Calendar/common/UserLabels',
  () => (props: any) => {
    userLabelsSpy(props);
    return <div data-testid="user-labels" />;
  }
);

const taskSlotSpy = jest.fn();
jest.mock('@/app/features/appointments/components/Calendar/Task/TaskSlot', () => (props: any) => {
  taskSlotSpy(props);
  return <div data-testid="task-slot" />;
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

describe('UserCalendar (Task)', () => {
  const handleViewTask = jest.fn();
  const setCurrentDate = jest.fn();

  const team = [
    { _id: 'user-1', name: 'Avery' },
    { _id: 'user-2', name: 'Sam' },
  ];
  const events: Task[] = [
    {
      name: 'Task A',
      assignedTo: 'user-1',
      dueAt: new Date('2025-01-06T10:00:00Z'),
      status: 'PENDING',
      _id: '',
      audience: 'EMPLOYEE_TASK',
      source: 'CUSTOM',
      category: '',
    } as Task,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(team);
  });

  it('renders user labels and task slots per team member', () => {
    render(
      <UserCalendar
        events={events}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
      />
    );

    expect(screen.getByTestId('user-labels')).toBeInTheDocument();
    expect(userLabelsSpy).toHaveBeenCalledWith(expect.objectContaining({ team }));

    const slots = screen.getAllByTestId('task-slot');
    expect(slots).toHaveLength(team.length);

    expect(taskSlotSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        handleViewTask,
        height: 180,
      })
    );
  });

  it('changes the current date when navigating', () => {
    render(
      <UserCalendar
        events={events}
        date={new Date(2025, 0, 6, 12)}
        handleViewTask={handleViewTask}
        setCurrentDate={setCurrentDate}
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
